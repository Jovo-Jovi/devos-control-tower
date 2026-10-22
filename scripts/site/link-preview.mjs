import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BYTE_LIMIT = 300_000;
const QUALITY_START = 85;
const QUALITY_FLOOR = 40;
const QUALITY_STEP = 5;

function option(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`missing value for ${flag}`);
    process.exit(1);
  }
  return value;
}

async function settle(page) {
  await page.locator("[data-sign-in-card]").waitFor();
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.waitForFunction(
    () =>
      document.documentElement.hasAttribute("data-scene-ready") &&
      document.querySelector('[data-planet-canvas="crimson"][data-planet-drawn]') !== null,
  );
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve(undefined));
        });
      }),
  );
}

async function capture(page) {
  let quality = QUALITY_START;
  let buffer = await page.screenshot({ type: "jpeg", quality });
  while (buffer.length > BYTE_LIMIT) {
    if (quality <= QUALITY_FLOOR) {
      console.error(
        `link-preview.jpg is ${buffer.length} bytes at quality ${quality}, above ${BYTE_LIMIT}`,
      );
      process.exit(1);
    }
    quality -= QUALITY_STEP;
    buffer = await page.screenshot({ type: "jpeg", quality });
  }
  return { buffer, quality };
}

const base = option("--base", "http://127.0.0.1:3100");
const out = path.resolve(option("--out", "src/assets/link-preview.jpg"));
const target = new URL("/sign-in", base);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(target.href, { waitUntil: "load" });
  await settle(page);
  const { buffer, quality } = await capture(page);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, buffer);
  console.log(`bytes ${buffer.length}`);
  console.log(`quality ${quality}`);
} finally {
  await browser.close();
}
