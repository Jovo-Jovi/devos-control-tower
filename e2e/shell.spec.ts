import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createOwner, removeOwner, sessionCookies, type SessionCookie } from "./support/owner";

const SCENE_FILES = [
  "sky-day",
  "sky-night",
  "sky-clouds",
  "planet-land",
  "planet-clouds",
  "planet-lights",
  "planet-sphere-map",
];

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
    const bucket = { value: 0 };
    Object.assign(window, { __layoutShift: bucket });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value?: number };
        if (typeof shift.value === "number") bucket.value += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function readShift(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __layoutShift: { value: number } }).__layoutShift.value);
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
  await expect(nav.getByRole("link")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Control Tower", { exact: true })).toBeVisible();
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
  await expect(signIn.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(signIn.getByText("The Tower admits one GitHub account: its owner.")).toBeVisible();
  await expect(signIn.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  await expect
    .poll(() => SCENE_FILES.every((name) => media.filter((url) => url.includes(name)).length === 1), { timeout: 5_000 })
    .toBe(true);
  expect(csp).toEqual([]);
  await signedOut.close();
});

test("Evidence", async ({ browser }) => {
  const csp: string[] = [];
  const shifts: Record<string, number> = {};

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
          shifts[`${state.id}-${theme}-${viewport.width}${suffix}`] = await readShift(page);
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
        (window as unknown as { __layoutShift: { value: number } }).__layoutShift.value = 0;
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
      shifts[`theme-to-${choice}-${viewport.width}`] = await readShift(page);
    }
    await context.close();
  }

  writeFileSync(".devos/screens/v3-layout-shift.json", `${JSON.stringify(shifts, null, 2)}\n`);
  expect(Object.keys(shifts)).toHaveLength(44);
  for (const value of Object.values(shifts)) expect(value).toBe(0);
  expect(csp).toEqual([]);
});
