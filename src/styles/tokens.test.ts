import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Rgb = { r: number; g: number; b: number; a: number };

const LIGHT_BACKDROPS = ["#eef4fb", "#c4d4e7", "#a7c7ee"];
const DARK_BACKDROPS = ["#050507", "#3d070a"];

const STATED: Record<string, number> = {
  "light ink": 12.98,
  "light muted": 5.56,
  "light accent": 5.28,
  "light line-strong": 3.74,
  "dark ink": 16.73,
  "dark muted": 7.58,
  "dark accent": 6.75,
  "dark line-strong": 3.22,
  "light waiting": 5.53,
  "light stale": 6.66,
  "dark started": 6.66,
  "dark waiting": 9.77,
  "light accent-ink": 6.7,
  "dark accent-ink": 7.06,
  "light action-ink": 16.47,
  "dark action-ink": 15.76,
};

function blockAfter(css: string, marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`missing ${marker}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed ${marker}`);
}

function declarations(block: string): Map<string, string> {
  const cleaned = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const map = new Map<string, string>();
  for (const part of cleaned.split(";")) {
    const match = /(--[\w-]+)\s*:\s*([^;]+)/.exec(part);
    if (!match) continue;
    map.set(match[1], match[2].trim());
  }
  return map;
}

function parseColor(input: string): Rgb {
  const text = input.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const value = hex[1];
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(text);
  if (!rgb) throw new Error(`unparsed colour ${text}`);
  return {
    r: Number(rgb[1]),
    g: Number(rgb[2]),
    b: Number(rgb[3]),
    a: rgb[4] === undefined ? 1 : Number(rgb[4]),
  };
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(color: Rgb): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function contrast(foreground: Rgb, background: Rgb): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function over(foreground: Rgb, background: Rgb): Rgb {
  const alpha = foreground.a;
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  };
}

function worst(text: Rgb, glasses: Rgb[], backdrops: Rgb[]): number {
  let lowest = Number.POSITIVE_INFINITY;
  for (const glass of glasses) {
    for (const backdrop of backdrops) {
      lowest = Math.min(lowest, contrast(text, over(glass, backdrop)));
    }
  }
  return lowest;
}

// §1's published figures match `--glass` over the canvas and the scene backdrops.
// `--glass-strong` is checked against the same thresholds; on the dark horizon it is
// not the figure §1 prints (its green channel lifts the composite).

function logPair(name: string, value: number): void {
  const stated = STATED[name];
  const suffix = stated === undefined ? "" : ` (stated ${stated.toFixed(2)})`;
  console.log(`${name} ${value.toFixed(2)}${suffix}`);
}

describe("tokens.css", () => {
  const css = readFileSync("src/styles/tokens.css", "utf8");
  const light = declarations(blockAfter(css, ":root {"));
  const media = blockAfter(css, "@media (prefers-color-scheme: dark)");
  const autoDark = declarations(blockAfter(media, ':root:not([data-theme="light"])'));
  const forcedDark = declarations(blockAfter(css, ':root[data-theme="dark"]'));

  it("gives Auto dark and data-theme dark the same names and values", () => {
    expect([...autoDark.keys()].sort()).toEqual([...forcedDark.keys()].sort());
    for (const [name, value] of autoDark) {
      expect(forcedDark.get(name), name).toBe(value);
    }
  });

  it("recomputes the §1 contrast pairs", () => {
    const themes = [
      { name: "light", tokens: light, backdrops: LIGHT_BACKDROPS },
      { name: "dark", tokens: forcedDark, backdrops: DARK_BACKDROPS },
    ] as const;

    for (const theme of themes) {
      const color = (name: string) => parseColor(theme.tokens.get(name) ?? "");
      const glasses = [color("--glass"), color("--glass-strong")];
      const glassOnly = [color("--glass")];
      const backdrops = theme.backdrops.map((backdrop) => parseColor(backdrop));
      const pairs: [string, Rgb, number][] = [
        ["ink", color("--color-ink"), 4.5],
        ["muted", color("--color-ink-muted"), 4.5],
        ["accent", color("--color-accent"), 4.5],
        ["line-strong", color("--color-line-strong"), 3],
      ];

      for (const [pair, text, threshold] of pairs) {
        const name = `${theme.name} ${pair}`;
        const statedCase = worst(text, glassOnly, backdrops);
        const eitherGlass = worst(text, glasses, backdrops);
        logPair(name, statedCase);
        expect(statedCase, name).toBeGreaterThanOrEqual(threshold);
        expect(eitherGlass, `${name} glass-strong`).toBeGreaterThanOrEqual(threshold);
        expect(Math.abs(statedCase - STATED[name]), name).toBeLessThanOrEqual(0.02);
      }

      for (const status of ["started", "revise", "pass", "skipped", "waiting", "fail", "stale"]) {
        const value = contrast(color(`--color-${status}`), color(`--color-${status}-bg`));
        const name = `${theme.name} ${status}`;
        logPair(name, value);
        expect(value, name).toBeGreaterThanOrEqual(4.5);
        if (STATED[name] !== undefined) {
          expect(Math.abs(value - STATED[name]), name).toBeLessThanOrEqual(0.02);
        }
      }

      const accentInk = contrast(color("--color-accent-ink"), color("--color-accent"));
      const actionInk = contrast(color("--color-action-ink"), color("--color-action"));
      logPair(`${theme.name} accent-ink`, accentInk);
      logPair(`${theme.name} action-ink`, actionInk);
      expect(accentInk).toBeGreaterThanOrEqual(4.5);
      expect(actionInk).toBeGreaterThanOrEqual(4.5);
      expect(Math.abs(accentInk - STATED[`${theme.name} accent-ink`])).toBeLessThanOrEqual(0.02);
      expect(Math.abs(actionInk - STATED[`${theme.name} action-ink`])).toBeLessThanOrEqual(0.02);
    }
  });
});
