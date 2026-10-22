import { chromium, expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createOwner, removeOwner, sessionCookies, type SessionCookie } from "./support/owner";

const SCENE_FILES = [
  "bg-day",
  "bg-night",
  "bg-day-portrait",
  "bg-night-portrait",
  "planet-day",
  "planet-crimson",
];

function sceneName(url: string): string | null {
  const segment = new URL(url).pathname.split("/").pop() ?? "";
  let match: string | null = null;
  for (const name of SCENE_FILES) {
    if (segment.startsWith(name) && (match === null || name.length > match.length)) match = name;
  }
  return match;
}

function sceneCounts(urls: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of SCENE_FILES) counts[name] = 0;
  for (const url of new Set(urls)) {
    const name = sceneName(url);
    if (name) counts[name] += 1;
  }
  return counts;
}

const STATES = [
  { id: "overview", path: "/", owner: true },
  { id: "not-found", path: "/no-such-page", owner: true },
  { id: "sign-in", path: "/sign-in", owner: false },
  { id: "sign-in-denied", path: "/sign-in?reason=not_owner", owner: false },
  { id: "sign-in-error", path: "/sign-in?reason=auth_error", owner: false },
] as const;

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;

test.describe.configure({ timeout: 360_000 });

let ownerCookies: SessionCookie[] = [];
let otherCookies: SessionCookie[] = [];

test.beforeAll(async () => {
  mkdirSync(".devos/screens", { recursive: true });
  await removeOwner();
  await createOwner({ githubId: "700001", login: "fixture-owner", allowListed: true });
  await createOwner({ githubId: "700002", login: "fixture-other", allowListed: false });
  ownerCookies = await sessionCookies("fixture-owner@example.test");
  otherCookies = await sessionCookies("fixture-other@example.test");
});

test.afterAll(async () => {
  await removeOwner();
});

function watchCsp(page: Page, messages: string[]) {
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) messages.push(message.text());
  });
}

async function turnX(page: Page): Promise<number> {
  return page.locator("[data-planet-turn]").first().evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    if (transform === "none") return 0;
    const match = /matrix\(([^)]+)\)/.exec(transform);
    if (!match) return Number.NaN;
    return Number(match[1].split(",")[4]);
  });
}

async function armShift(context: BrowserContext) {
  await context.addInitScript(() => {
    function describeShiftNode(node: Node | null): string {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return "";
      const element = node as Element;
      const id = element.id ? `#${element.id}` : "";
      const classes = [...element.classList].map((name) => `.${name}`).join("");
      const data = [...element.attributes]
        .filter((attribute) => attribute.name.startsWith("data-"))
        .map((attribute) => `[${attribute.name}]`)
        .join("");
      return `${element.tagName.toLowerCase()}${id}${classes}${data}`;
    }

    const bucket: { value: number; entries: { value: number; sources: string[] }[] } = { value: 0, entries: [] };
    Object.assign(window, { __layoutShift: bucket });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value?: number; sources?: { node?: Node | null }[] };
        if (typeof shift.value !== "number") continue;
        bucket.value += shift.value;
        bucket.entries.push({
          value: shift.value,
          sources: (shift.sources ?? []).flatMap((source) => {
            const described = describeShiftNode(source.node ?? null);
            return described ? [described] : [];
          }),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function readShift(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __layoutShift: { value: number } }).__layoutShift.value);
}

async function finishFinite(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getTiming();
      if (timing && timing.iterations !== Infinity && typeof timing.duration === "number") animation.finish();
    }
  });
}

async function settle(page: Page) {
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getTiming();
      if (timing && timing.iterations !== Infinity && typeof timing.duration === "number") animation.finish();
    }
  });
}

async function seek(page: Page, time: number) {
  await page.evaluate((ms) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = ms;
    }
  }, time);
}

test("Gate and shell", async ({ browser }) => {
  const csp: string[] = [];
  const denied = await browser.newContext();
  await denied.addCookies(otherCookies);
  const deniedPage = await denied.newPage();
  watchCsp(deniedPage, csp);
  const deniedResponse = await deniedPage.goto("/");
  expect(deniedPage.url()).toContain("/sign-in?reason=not_owner");
  expect(deniedResponse?.status()).toBe(403);
  await denied.close();

  const context = await browser.newContext();
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByText("Discover · Monitor · Trace · Verify")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Sections" });
  await expect(nav.getByRole("link")).toHaveCount(2);
  await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Register project" })).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("banner").getByText("Control Tower", { exact: true })).toBeVisible();
  const theme = page.getByRole("group", { name: "Theme" });
  await expect(theme.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
  await expect(theme.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "false");
  await expect(theme.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("bdi", { hasText: "fixture-owner" })).toBeVisible();
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.locator("[data-scene]")).toHaveAttribute("aria-hidden", "true");

  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    eyebrow: getComputedStyle(document.querySelector("main p") as Element).fontFamily,
  }));
  expect(fonts.body).toMatch(/Inter/);
  expect(fonts.eyebrow).toMatch(/Geist[ _]Mono/);
  expect(csp).toEqual([]);
  await context.close();
});

test("Theme switch, nothing stored", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext({ colorScheme: "light" });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/");
  const urlBefore = page.url();
  const storageBefore = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  const cookieNamesBefore = (await context.cookies()).map((cookie) => cookie.name).sort();

  await page.getByRole("button", { name: "Dark" }).click();
  const dark = await page.locator("[data-planet-turn]").first().evaluate((element) => {
    const transition = element.getAnimations().find((animation) => animation.effect?.getTiming().duration === 1800);
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      pressed: document.querySelector('[data-theme-option="dark"]')?.getAttribute("aria-pressed"),
      canvas: getComputedStyle(document.documentElement).getPropertyValue("--color-canvas").trim(),
      duration: transition?.effect?.getTiming().duration ?? null,
      running: transition?.playState ?? null,
    };
  });
  expect(dark).toEqual({
    theme: "dark",
    pressed: "true",
    canvas: "#050507",
    duration: 1800,
    running: "running",
  });

  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightCanvas = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-canvas").trim(),
  );
  expect(lightCanvas).toBe("#eef4fb");

  await page.getByRole("button", { name: "Auto" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  const storageAfter = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  const cookieNamesAfter = (await context.cookies()).map((cookie) => cookie.name).sort();
  expect(storageAfter).toEqual(storageBefore);
  expect(storageAfter).toEqual({ local: 0, session: 0 });
  expect(cookieNamesAfter).toEqual(cookieNamesBefore);
  expect(page.url()).toBe(urlBefore);

  await page.getByRole("button", { name: "Dark" }).click();
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await expect(page.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
  await context.close();

  const darkScheme = await browser.newContext({ colorScheme: "dark" });
  await darkScheme.addCookies(ownerCookies);
  const darkPage = await darkScheme.newPage();
  watchCsp(darkPage, csp);
  await darkPage.goto("/");
  const autoCanvas = await darkPage.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-canvas").trim(),
  );
  expect(autoCanvas).toBe("#050507");
  await darkPage.getByRole("button", { name: "Light" }).click();
  const forcedLight = await darkPage.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-canvas").trim(),
  );
  expect(forcedLight).toBe("#eef4fb");
  expect(csp).toEqual([]);
  await darkScheme.close();
});

test("Reduced motion and hidden", async ({ browser }) => {
  const csp: string[] = [];
  const reduced = await browser.newContext({ colorScheme: "light", reducedMotion: "reduce" });
  await reduced.addCookies(ownerCookies);
  const reducedPage = await reduced.newPage();
  watchCsp(reducedPage, csp);
  await reducedPage.goto("/");
  expect(await reducedPage.evaluate(() => document.getAnimations().length)).toBe(0);
  await reducedPage.getByRole("button", { name: "Dark" }).click();
  expect(await reducedPage.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await turnX(reducedPage)).toBeCloseTo(-340, 0);
  await reduced.close();

  const context = await browser.newContext({ colorScheme: "light", reducedMotion: "no-preference" });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
  const infiniteBefore = await page.evaluate(
    () => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations === Infinity).length,
  );
  expect(infiniteBefore).toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-scene-paused", "");
  const paused = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations === Infinity)
      .every((animation) => animation.playState === "paused"),
  );
  expect(paused).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("html")).not.toHaveAttribute("data-scene-paused");
  expect(csp).toEqual([]);
  await context.close();
});

test("Not found and sign-in on the scene", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext();
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  const missing = await page.goto("/no-such-page");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to overview" })).toHaveAttribute("href", "/");
  await context.close();

  const signedOut = await browser.newContext();
  const signIn = await signedOut.newPage();
  watchCsp(signIn, csp);
  const media: string[] = [];
  signIn.on("response", (response) => {
    if (response.url().includes("/_next/static/media/") && response.status() === 200) media.push(response.url());
  });
  const response = await signIn.goto("/sign-in");
  expect(response?.status()).toBe(200);
  await expect(signIn.locator("[data-scene]")).toHaveAttribute("aria-hidden", "true");
  await expect(signIn.getByRole("heading", { name: "Control Tower" })).toBeVisible();
  await expect(signIn.getByText("The Tower admits one GitHub account: its owner.")).toBeVisible();
  await expect(signIn.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  await expect
    .poll(() => {
      const counts = sceneCounts(media);
      const landscape = ["bg-day", "bg-night", "planet-day", "planet-crimson"];
      return (
        landscape.every((name) => counts[name] === 1) &&
        counts["bg-day-portrait"] === 0 &&
        counts["bg-night-portrait"] === 0
      );
    }, { timeout: 5_000 })
    .toBe(true);
  expect(csp).toEqual([]);
  await signedOut.close();
});

test("Evidence", async ({ browser }) => {
  const csp: string[] = [];
  const shifts: Record<string, number> = {};
  const shiftSources: Record<string, { value: number; sources: string[] }[]> = {};

  for (const theme of ["light", "dark"] as const) {
    for (const viewport of VIEWPORTS) {
      for (const reduced of [false, true]) {
        const context = await browser.newContext({
          colorScheme: theme,
          viewport,
          reducedMotion: reduced ? "reduce" : "no-preference",
        });
        await armShift(context);
        const page = await context.newPage();
        watchCsp(page, csp);
        for (const state of STATES) {
          if (state.owner) await context.addCookies(ownerCookies);
          else await context.clearCookies();
          await page.goto(state.path, { waitUntil: "load" });
          await settle(page);
          const suffix = reduced ? "-reduced" : "";
          await page.screenshot({
            path: `.devos/screens/v3-${state.id}-${theme}-${viewport.width}${suffix}.png`,
          });
          const shiftKey = `${state.id}-${theme}-${viewport.width}${suffix}`;
          shifts[shiftKey] = await readShift(page);
          shiftSources[shiftKey] = await page.evaluate(
            () =>
              (window as unknown as { __layoutShift: { entries: { value: number; sources: string[] }[] } }).__layoutShift
                .entries,
          );
        }
        await context.close();
      }

      const film = await browser.newContext({ colorScheme: theme, viewport, reducedMotion: "no-preference" });
      await film.addCookies(ownerCookies);
      const filmPage = await film.newPage();
      watchCsp(filmPage, csp);
      await filmPage.addInitScript(() => {
        const hold = () => {
          for (const animation of document.getAnimations()) {
            if (animation.playState === "running") animation.pause();
          }
          requestAnimationFrame(hold);
        };
        requestAnimationFrame(hold);
      });
      await filmPage.goto("/", { waitUntil: "load" });
      for (const time of [0, 80, 160, 320, 640]) {
        await seek(filmPage, time);
        await filmPage.screenshot({
          path: `.devos/screens/v3-overview-${theme}-${viewport.width}-film-${String(time).padStart(3, "0")}.png`,
        });
      }
      await film.close();
    }
  }

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      colorScheme: "light",
      viewport,
      reducedMotion: "no-preference",
    });
    await armShift(context);
    await context.addCookies(ownerCookies);
    const page = await context.newPage();
    watchCsp(page, csp);
    await page.goto("/", { waitUntil: "load" });
    await settle(page);
    for (const choice of ["dark", "light"] as const) {
      await page.evaluate(() => {
        const bucket = (window as unknown as { __layoutShift: { value: number; entries: unknown[] } }).__layoutShift;
        bucket.value = 0;
        bucket.entries = [];
        for (const animation of document.getAnimations()) {
          const timing = animation.effect?.getTiming();
          if (timing?.iterations !== Infinity && animation.playState === "paused") animation.finish();
        }
      });
      await page.evaluate((name) => {
        const button = document.querySelector<HTMLButtonElement>(`[data-theme-option="${name}"]`);
        if (!button) throw new Error(`missing ${name}`);
        button.click();
        for (const animation of document.getAnimations()) animation.pause();
      }, choice);
      for (const time of [0, 450, 900, 1350, 1800]) {
        await seek(page, time);
        await page.screenshot({
          path: `.devos/screens/v3-theme-to-${choice}-${viewport.width}-${String(time).padStart(4, "0")}.png`,
        });
      }
      const themeKey = `theme-to-${choice}-${viewport.width}`;
      shifts[themeKey] = await readShift(page);
      shiftSources[themeKey] = await page.evaluate(
        () =>
          (window as unknown as { __layoutShift: { entries: { value: number; sources: string[] }[] } }).__layoutShift
            .entries,
      );
    }
    await context.close();
  }

  writeFileSync(".devos/screens/v3-layout-shift.json", `${JSON.stringify(shifts, null, 2)}\n`);
  writeFileSync(".devos/screens/v3-layout-shift-sources.json", `${JSON.stringify(shiftSources, null, 2)}\n`);
  expect(Object.keys(shifts)).toHaveLength(44);
  for (const value of Object.values(shifts)) expect(value).toBe(0);
  expect(csp).toEqual([]);
});

test("Scene art v3.1", async ({ browser }) => {
  const csp: string[] = [];
  const beforeHydration = { javaScriptEnabled: false, viewport: { width: 1280, height: 900 } } as const;

  const lightOff = await browser.newContext({ ...beforeHydration, colorScheme: "light" });
  const lightPage = await lightOff.newPage();
  watchCsp(lightPage, csp);
  const lightNames: string[] = [];
  lightPage.on("request", (request) => {
    const name = sceneName(request.url());
    if (name) lightNames.push(name);
  });
  await lightPage.goto("/sign-in", { waitUntil: "networkidle" });
  expect(lightNames).toEqual(expect.arrayContaining(["bg-day", "planet-day"]));
  expect(lightNames.every((name) => name === "bg-day" || name === "planet-day")).toBe(true);
  await lightOff.close();

  const darkOff = await browser.newContext({ ...beforeHydration, colorScheme: "dark" });
  const darkPage = await darkOff.newPage();
  watchCsp(darkPage, csp);
  const darkNames: string[] = [];
  darkPage.on("request", (request) => {
    const name = sceneName(request.url());
    if (name) darkNames.push(name);
  });
  await darkPage.goto("/sign-in", { waitUntil: "networkidle" });
  expect(darkNames).toEqual(expect.arrayContaining(["bg-night", "planet-crimson"]));
  expect(darkNames.every((name) => name === "bg-night" || name === "planet-crimson")).toBe(true);
  await darkOff.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  const phonePage = await phone.newPage();
  watchCsp(phonePage, csp);
  const phoneMedia: string[] = [];
  phonePage.on("response", (response) => {
    if (response.url().includes("/_next/static/media/") && response.status() === 200) phoneMedia.push(response.url());
  });
  await phonePage.goto("/sign-in");
  await phonePage.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
  await expect
    .poll(() => {
      const counts = sceneCounts(phoneMedia);
      return (
        counts["bg-day-portrait"] === 1 &&
        counts["bg-night-portrait"] === 1 &&
        counts["planet-day"] === 1 &&
        counts["planet-crimson"] === 1 &&
        counts["bg-day"] === 0 &&
        counts["bg-night"] === 0
      );
    }, { timeout: 5_000 })
    .toBe(true);
  await phone.close();

  const structure = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  const structurePage = await structure.newPage();
  watchCsp(structurePage, csp);
  await structurePage.goto("/sign-in");
  await expect(structurePage.locator("[data-starfield]")).toHaveCount(1);
  await expect(structurePage.locator("[data-scene] circle")).toHaveCount(0);
  await expect(
    structurePage.locator("[data-scene] polygon, [data-scene] polyline, [data-scene] rect, [data-scene] ellipse"),
  ).toHaveCount(0);
  await expect(structurePage.locator("[data-planet-globe]")).toHaveCount(2);
  await expect(structurePage.locator("feDisplacementMap")).toHaveCount(0);
  await expect(structurePage.locator("[data-planet-canvas]")).toHaveCount(2);
  await expect(structurePage.locator('[data-planet-crimson-mask] [data-planet-canvas="crimson"]')).toHaveCount(1);
  const dayPlate = await structurePage.locator('[data-scene-plate="day"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationIterationCount: style.animationIterationCount,
      animationDirection: style.animationDirection,
    };
  });
  expect(dayPlate.backgroundSize).toBe("cover");
  expect(dayPlate.backgroundPosition).toBe("50% 100%");
  expect(dayPlate.animationName).toBe("none");
  const nearClouds = await structurePage.locator('[data-cloud-track="near"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationTimingFunction: style.animationTimingFunction,
      animationIterationCount: style.animationIterationCount,
    };
  });
  expect(nearClouds.animationName).not.toBe("none");
  expect(nearClouds.animationDuration).toBe("240s");
  expect(nearClouds.animationTimingFunction).toBe("linear");
  expect(nearClouds.animationIterationCount).toBe("infinite");
  const nightPlate = await structurePage.locator('[data-scene-plate="night"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      backgroundPosition: style.backgroundPosition,
    };
  });
  expect(nightPlate.animationName).toBe("none");
  expect(nightPlate.backgroundPosition).toBe("50% 100%");
  await structure.close();

  const roll = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  await roll.addCookies(ownerCookies);
  const rollPage = await roll.newPage();
  watchCsp(rollPage, csp);
  await rollPage.goto("/");
  await rollPage.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
  const mask = rollPage.locator("[data-planet-crimson-mask]");
  expect(await mask.evaluate((element) => getComputedStyle(element).maskPosition)).toBe("300px -90px");
  expect(await mask.evaluate((element) => getComputedStyle(element).maskSize)).toBe("520px 520px");
  await rollPage.getByRole("button", { name: "Dark" }).click();
  const rolling = await mask.evaluate((element) =>
    element.getAnimations().some((animation) => {
      return animation.effect?.getTiming().duration === 1800 && animation.playState === "running";
    }),
  );
  expect(rolling).toBe(true);
  await finishFinite(rollPage);
  expect(await mask.evaluate((element) => getComputedStyle(element).maskPosition)).toBe("-90px -90px");
  await rollPage.getByRole("button", { name: "Light" }).click();
  await finishFinite(rollPage);
  expect(await mask.evaluate((element) => getComputedStyle(element).maskPosition)).toBe("300px -90px");
  expect(csp).toEqual([]);
  await roll.close();
});

const GLOBE_SIZES = [
  { width: 1280, height: 900, dpr: 2, backing: 680 },
  { width: 390, height: 844, dpr: 3, backing: 632 },
] as const;

async function hideShell(page: Page) {
  await page.evaluate(() => {
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child.matches("[data-scene]")) continue;
      child.style.visibility = "hidden";
    }
  });
}

async function centreCrop(page: Page) {
  const box = await page.locator('[data-planet-canvas="day"]').boundingBox();
  if (!box) throw new Error("day canvas has no box");
  return page.screenshot({
    clip: {
      x: box.x + box.width / 4,
      y: box.y + box.height / 4,
      width: box.width / 2,
      height: box.height / 2,
    },
  });
}

async function openGlobe(
  gl: Browser,
  baseURL: string,
  csp: string[],
  theme: "light" | "dark",
  size: (typeof GLOBE_SIZES)[number],
  reducedMotion: "no-preference" | "reduce",
  blockWebgl: boolean,
) {
  const context = await gl.newContext({
    baseURL,
    colorScheme: theme,
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.dpr,
    reducedMotion,
  });
  if (blockWebgl) {
    await context.addInitScript(() => {
      const prototype = HTMLCanvasElement.prototype;
      const original = prototype.getContext;
      prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement["getContext"]>) {
        const kind = String(args[0]);
        if (kind === "webgl" || kind === "webgl2" || kind === "experimental-webgl") return null;
        return original.apply(this, args);
      } as HTMLCanvasElement["getContext"];
    });
  }
  await context.addCookies(ownerCookies);
  await armShift(context);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
  return { context, page };
}

async function backingOf(canvas: ReturnType<Page["locator"]>) {
  return canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: (element as HTMLCanvasElement).width,
      height: (element as HTMLCanvasElement).height,
      backing: Math.round(rect.width * window.devicePixelRatio),
    };
  });
}

async function expectStillGlobe(page: Page) {
  await hideShell(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );
  const first = await centreCrop(page);
  await page.waitForTimeout(1000);
  const second = await centreCrop(page);
  expect(Buffer.compare(first, second)).toBe(0);
}

test("Sharp globe", async () => {
  test.setTimeout(180_000);
  const csp: string[] = [];
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("missing baseURL");
  const gl = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  try {
    for (const theme of ["light", "dark"] as const) {
      for (const size of GLOBE_SIZES) {
        const motion = await openGlobe(gl, baseURL, csp, theme, size, "no-preference", false);
        const canvases = motion.page.locator("[data-planet-canvas]");
        await expect(canvases).toHaveCount(2);
        for (const canvas of await canvases.all()) {
          await expect
            .poll(async () => canvas.getAttribute("data-planet-renderer"), { timeout: 15_000 })
            .not.toBeNull();
          const renderer = await canvas.getAttribute("data-planet-renderer");
          if (renderer !== "webgl") {
            const probe = await motion.page.evaluate(() => {
              const created = document.createElement("canvas");
              const context = created.getContext("webgl");
              return context === null ? "null" : String(context);
            });
            throw new Error(
              `motion renderer is ${String(renderer)}; document.createElement("canvas").getContext("webgl") returned ${probe}`,
            );
          }
          await expect(canvas).toHaveAttribute("data-planet-drawn", "");
          await expect(canvas).toHaveAttribute("data-planet-renderer", "webgl");
          await expect(canvas).toHaveAttribute("data-planet-running", "");
          const metrics = await backingOf(canvas);
          expect(metrics.width).toBe(size.backing);
          expect(metrics.height).toBe(size.backing);
          expect(metrics.width).toBe(metrics.backing);
          expect(metrics.height).toBe(metrics.backing);
        }
        await hideShell(motion.page);
        const first = await centreCrop(motion.page);
        await motion.page.waitForTimeout(1000);
        const second = await centreCrop(motion.page);
        expect(Buffer.compare(first, second)).not.toBe(0);
        await motion.context.close();

        const reduced = await openGlobe(gl, baseURL, csp, theme, size, "reduce", false);
        const reducedCanvases = reduced.page.locator("[data-planet-canvas]");
        await expect(reducedCanvases).toHaveCount(2);
        for (const canvas of await reducedCanvases.all()) {
          await expect(canvas).toHaveAttribute("data-planet-drawn", "", { timeout: 15_000 });
          await expect(canvas).toHaveAttribute("data-planet-renderer", "webgl");
          await expect(canvas).not.toHaveAttribute("data-planet-running");
        }
        await expectStillGlobe(reduced.page);
        await reduced.context.close();

        const flat = await openGlobe(gl, baseURL, csp, theme, size, "no-preference", true);
        const flatCanvases = flat.page.locator("[data-planet-canvas]");
        await expect(flatCanvases).toHaveCount(2);
        for (const canvas of await flatCanvases.all()) {
          await expect(canvas).toHaveAttribute("data-planet-drawn", "", { timeout: 15_000 });
          await expect(canvas).toHaveAttribute("data-planet-renderer", "2d");
          await expect(canvas).not.toHaveAttribute("data-planet-running");
          const metrics = await backingOf(canvas);
          expect(metrics.width).toBe(size.backing);
          expect(metrics.height).toBe(size.backing);
          expect(metrics.width).toBe(metrics.backing);
          expect(metrics.height).toBe(metrics.backing);
        }
        await expectStillGlobe(flat.page);
        await flat.context.close();
      }
    }
  } finally {
    await gl.close();
  }
  expect(csp).toEqual([]);
});
