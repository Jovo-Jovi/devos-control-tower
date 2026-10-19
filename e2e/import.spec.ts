import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createOwner, removeOwner, sessionCookies, type SessionCookie } from "./support/owner";
import { query } from "./support/portfolio";

const OWNERS = [
  { githubId: "700051", login: "fixture-import-owner" },
  { githubId: "700052", login: "fixture-import-other" },
] as const;

const IMPORT_PATH = "/projects/IMPORTFX/import";
const SYNTHETIC = "tests/fixtures/history-synthetic.jsonl";
const INVALID = "tests/fixtures/history-invalid.jsonl";
const EMPTY_FILE = "/tmp/t10-empty.jsonl";
const TRACE_FILE = "/tmp/t10-trace.jsonl";
const FILE_INPUT = 'input[name="history"]';
const SCREENS = ".devos/screens";
const STATES = ["idle", "uploading", "result", "error"] as const;
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;
const FILM_TIMES = [0, 80, 160, 320, 640] as const;
const THEME_TIMES = [0, 450, 900, 1350, 1800] as const;

type ImportStateName = (typeof STATES)[number];

test.describe.configure({ timeout: 600_000 });

let ownerCookies: SessionCookie[] = [];
let otherCookies: SessionCookie[] = [];

test.beforeAll(async () => {
  mkdirSync(SCREENS, { recursive: true });
  await removeOwner(OWNERS);
  query("delete from public.projects where key = 'IMPORTFX'");
  await createOwner({ githubId: "700051", login: "fixture-import-owner", allowListed: true });
  await createOwner({ githubId: "700052", login: "fixture-import-other", allowListed: false });
  query(
    "insert into public.projects (key, repo, owner_github_id) values ('IMPORTFX', 'fixture-org/import-repo', '700051')",
  );
  ownerCookies = await sessionCookies("fixture-import-owner@example.test");
  otherCookies = await sessionCookies("fixture-import-other@example.test");
  writeFileSync(EMPTY_FILE, "");
  const first = readFileSync(SYNTHETIC, "utf8")
    .split("\n")
    .find((line) => line.length > 0);
  if (!first?.includes('"project":"IMPORTFX"')) throw new Error("synthetic fixture has no IMPORTFX line");
  writeFileSync(TRACE_FILE, `${first.replace('"project":"IMPORTFX"', '"project":"TRACE"')}\n`);
});

test.afterAll(async () => {
  query("delete from public.projects where key = 'IMPORTFX'");
  await removeOwner(OWNERS);
});

function clearImportRuns(): void {
  query("delete from public.runs where project_id in (select id from public.projects where key = 'IMPORTFX')");
}

function importEventCount(): string {
  return query(
    "select count(*) from public.events e join public.projects p on p.id = e.project_id where p.key = 'IMPORTFX'",
  );
}

function watchCsp(page: Page, messages: string[]) {
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) messages.push(message.text());
  });
}

async function armShift(context: BrowserContext) {
  await context.addInitScript(() => {
    const bucket: { value: number; entries: { value: number; sources: string[] }[] } = { value: 0, entries: [] };
    Object.assign(window, { __layoutShift: bucket });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value?: number; sources?: { node?: Node | null }[] };
        if (typeof shift.value !== "number" || shift.value === 0) continue;
        bucket.value += shift.value;
        bucket.entries.push({
          value: shift.value,
          sources: (shift.sources ?? []).flatMap((source) => {
            const node = source.node;
            if (!node || node.nodeType !== Node.ELEMENT_NODE) return [];
            const element = node as Element;
            return [`${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`];
          }),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function readShift(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __layoutShift: { value: number } }).__layoutShift.value);
}

async function shiftDetail(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify((window as unknown as { __layoutShift: { value: number; entries: unknown[] } }).__layoutShift),
  );
}

async function resetShift(page: Page) {
  await page.evaluate(() => {
    const bucket = (window as unknown as { __layoutShift?: { value: number; entries: unknown[] } }).__layoutShift;
    if (!bucket) return;
    bucket.value = 0;
    bucket.entries = [];
  });
}

async function expectNoShift(page: Page, label: string) {
  const value = await readShift(page);
  expect(value, `${label} ${await shiftDetail(page)}`).toBe(0);
  return value;
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

async function sceneReady(page: Page) {
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
}

async function seek(page: Page, time: number) {
  await page.evaluate((ms) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = ms;
    }
  }, time);
}

async function armHoldNew(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      (animation as Animation & { held?: boolean }).held = true;
    }
    const hold = () => {
      for (const animation of document.getAnimations()) {
        const marked = animation as Animation & { held?: boolean };
        if (marked.held) continue;
        if (animation.playState === "running") animation.pause();
      }
      requestAnimationFrame(hold);
    };
    requestAnimationFrame(hold);
  });
}

async function seekNew(page: Page, time: number) {
  await page.evaluate((ms) => {
    for (const animation of document.getAnimations()) {
      const marked = animation as Animation & { held?: boolean };
      if (marked.held) continue;
      animation.pause();
      animation.currentTime = ms;
    }
  }, time);
}

function pauseOnPaint() {
  const hold = () => {
    for (const animation of document.getAnimations()) {
      if (animation.playState === "running") animation.pause();
    }
    requestAnimationFrame(hold);
  };
  requestAnimationFrame(hold);
}

async function holdImport(page: Page): Promise<() => void> {
  let finish = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    finish = () => resolve();
  });
  let used = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!used && request.method() === "POST" && typeof request.headers()["next-action"] === "string") {
      used = true;
      await gate;
    }
    try {
      await route.continue();
    } catch (error) {
      if (!page.isClosed()) throw error;
    }
  });
  return finish;
}

async function ownerContext(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  return { context, page };
}

async function chooseFile(page: Page, file: string) {
  await page.setInputFiles(FILE_INPUT, file);
}

async function submit(page: Page, held: boolean) {
  await page.getByRole("button", { name: "Import", exact: true }).click(held ? { noWaitAfter: true } : undefined);
}

async function expectNoScroll(page: Page) {
  const fit = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(fit).toBe(true);
}

async function capture(page: Page, path: string) {
  const data = await page.screenshot({ path, fullPage: true, animations: "allow" });
  expect(data.length).toBeGreaterThan(20_000);
}

async function expectResultCounts(page: Page, stored: string, duplicate: string, conflict: string) {
  const table = page.locator("[data-import-result]");
  await expect(table).toBeVisible({ timeout: 20_000 });
  await expect(table.locator("tr").nth(0).locator("td")).toHaveText(stored, { timeout: 20_000 });
  await expect(table.locator("tr").nth(1).locator("td")).toHaveText(duplicate);
  await expect(table.locator("tr").nth(2).locator("td")).toHaveText(conflict);
}

async function openImport(page: Page) {
  await page.goto(IMPORT_PATH, { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Import history", level: 1 })).toBeVisible();
  await sceneReady(page);
}

async function showState(page: Page, state: ImportStateName, film: boolean): Promise<() => Promise<void>> {
  clearImportRuns();
  if (state === "idle") {
    await openImport(page);
    if (film) await sceneReady(page);
    else await settle(page);
    return async () => undefined;
  }

  if (!page.url().includes(IMPORT_PATH)) {
    await openImport(page);
    await settle(page);
  }
  await resetShift(page);
  if (film) await armHoldNew(page);

  if (state === "uploading") {
    const release = await holdImport(page);
    try {
      await chooseFile(page, SYNTHETIC);
      await submit(page, true);
      await expect(page.getByText("Importing…")).toBeVisible();
      await expect(page.locator("[data-upload-line]")).toBeVisible();
      const button = page.getByRole("button", { name: "Import", exact: true });
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute("aria-busy", "true");
    } catch (error) {
      release();
      await page.unroute("**/*");
      throw error;
    }
    return async () => {
      release();
      await expect(page.locator("[data-upload-line]")).toHaveCount(0);
      await expect(page.locator("[data-import-result]")).toBeVisible({ timeout: 30_000 });
      await page.unroute("**/*");
    };
  }

  if (state === "result") {
    await chooseFile(page, SYNTHETIC);
    await submit(page, false);
    await expectResultCounts(page, "8", "0", "0");
    await expect(page.locator("[data-import-result]")).toContainText("import-0a1b2c3");
    if (!film) await settle(page);
    return async () => undefined;
  }

  await chooseFile(page, INVALID);
  await submit(page, false);
  await expect(page.locator("[data-import-error]")).toContainText("Line 3");
  if (!film) await settle(page);
  return async () => undefined;
}

test("Gate", async ({ request, browser }) => {
  const csp: string[] = [];
  const signedOut = await request.get("/projects/TRACE/import", { maxRedirects: 0 });
  expect(signedOut.status()).toBe(302);
  expect(signedOut.headers().location ?? "").toMatch(/\/sign-in$/);

  const denied = await browser.newContext();
  await denied.addCookies(otherCookies);
  const deniedPage = await denied.newPage();
  watchCsp(deniedPage, csp);
  const deniedResponse = await deniedPage.goto("/projects/TRACE/import");
  expect(deniedPage.url()).toContain("/sign-in?reason=not_owner");
  expect(deniedResponse?.status()).toBe(403);
  await denied.close();

  const context = await browser.newContext();
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  const missing = await page.goto("/projects/NOPE/import");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  const lower = await page.goto("/projects/nope/import");
  expect(lower?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  expect(csp).toEqual([]);
  await context.close();
});

test("Refusal", async ({ browser }) => {
  const csp: string[] = [];
  const { context, page } = await ownerContext(browser, { width: 1280, height: 900 });
  watchCsp(page, csp);
  try {
    await openImport(page);
    await chooseFile(page, INVALID);
    await submit(page, false);
    await expect(page.locator("[data-import-error]")).toContainText("Line 3");
    expect(importEventCount()).toBe("0");

    await chooseFile(page, EMPTY_FILE);
    await submit(page, false);
    await expect(page.locator("[data-import-error]")).toHaveText("The file is empty. Nothing was imported.");
    expect(importEventCount()).toBe("0");

    await chooseFile(page, TRACE_FILE);
    await submit(page, false);
    await expect(page.locator("[data-import-error]")).toContainText("Line 1");
    expect(importEventCount()).toBe("0");
    expect(csp).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Import", async ({ browser }) => {
  const csp: string[] = [];
  const { context, page } = await ownerContext(browser, { width: 1280, height: 900 });
  watchCsp(page, csp);
  try {
    clearImportRuns();
    await openImport(page);
    await chooseFile(page, SYNTHETIC);
    await submit(page, false);
    await expectResultCounts(page, "8", "0", "0");
    await expect(page.locator("[data-import-result]")).toContainText("import-0a1b2c3");
    await expect(page.locator('[data-import-result] [data-origin="imported"]')).toHaveText("imported");

    expect(
      query(
        "select origin || ':' || source || ':' || count(*) from public.events e join public.projects p on p.id = e.project_id where p.key = 'IMPORTFX' group by origin, source",
      ),
    ).toBe("imported:import:8");
    expect(
      query(
        "select r.run_key || '|' || r.source from public.runs r join public.projects p on p.id = r.project_id where p.key = 'IMPORTFX'",
      ),
    ).toBe("import-0a1b2c3|import");

    await chooseFile(page, SYNTHETIC);
    await submit(page, false);
    await expectResultCounts(page, "0", "8", "0");
    expect(importEventCount()).toBe("8");

    await page.goto("/projects/IMPORTFX");
    await expect(page.getByRole("link", { name: "Import history", exact: true })).toHaveAttribute(
      "href",
      "/projects/IMPORTFX/import",
    );
    await expect(page.locator('[data-run="import-0a1b2c3"]')).toBeVisible();
    await expect(page.locator("[data-step-event]")).toHaveCount(8);
    await expect(page.locator('[data-step-event] [data-origin="imported"]')).toHaveCount(8);
    expect(csp).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Truth", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  let release = (): void => undefined;
  try {
    await openImport(page);
    release = await holdImport(page);
    const namesBefore = (await context.cookies()).map((cookie) => cookie.name).sort();
    await chooseFile(page, SYNTHETIC);
    await submit(page, true);
    await expect(page.getByText("Importing…")).toBeVisible();
    await expect(page.locator("[data-upload-line]")).toBeVisible();
    const button = page.getByRole("button", { name: "Import", exact: true });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");

    release();
    await expect(page.locator("[data-import-result]")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-upload-line]")).toHaveCount(0);

    const storage = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    }));
    expect(storage).toEqual({ local: 0, session: 0 });
    const namesAfter = (await context.cookies()).map((cookie) => cookie.name).sort();
    expect(namesAfter).toEqual(namesBefore);
    expect(csp).toEqual([]);
  } finally {
    release();
    await context.close();
  }
});

test("Evidence", async ({ browser }) => {
  const csp: string[] = [];
  const shifts: Record<string, number> = {};

  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      for (const reduced of [false, true]) {
        const context = await browser.newContext({
          colorScheme: theme,
          viewport,
          reducedMotion: reduced ? "reduce" : "no-preference",
        });
        await armShift(context);
        await context.addCookies(ownerCookies);
        const page = await context.newPage();
        watchCsp(page, csp);
        try {
          for (const state of STATES) {
            const release = await showState(page, state, false);
            try {
              if (viewport.width === 390) await expectNoScroll(page);
              const key = `${state}-${theme}-${viewport.width}`;
              if (reduced) await expectNoShift(page, key);
              else shifts[key] = await expectNoShift(page, key);
              const suffix = reduced ? "-reduced" : "";
              await capture(page, `${SCREENS}/t10-${key}${suffix}.png`);
            } finally {
              await release();
            }
          }
        } finally {
          await context.close();
        }
      }

      const film = await browser.newContext({ colorScheme: theme, viewport, reducedMotion: "no-preference" });
      await film.addCookies(ownerCookies);
      const idlePage = await film.newPage();
      watchCsp(idlePage, csp);
      await idlePage.addInitScript(pauseOnPaint);
      clearImportRuns();
      await openImport(idlePage);
      await sceneReady(idlePage);
      await expect(idlePage.locator("[data-import-form]")).toBeVisible();
      for (const time of FILM_TIMES) {
        await seek(idlePage, time);
        if (viewport.width === 390) await expectNoScroll(idlePage);
        await capture(
          idlePage,
          `${SCREENS}/t10-idle-${theme}-${viewport.width}-film-${String(time).padStart(3, "0")}.png`,
        );
      }
      await idlePage.close();

      const filmPage = await film.newPage();
      watchCsp(filmPage, csp);
      for (const state of ["uploading", "result", "error"] as const) {
        await openImport(filmPage);
        await settle(filmPage);
        const release = await showState(filmPage, state, true);
        try {
          await filmPage.waitForFunction(
            () =>
              document.getAnimations().some((animation) => !(animation as Animation & { held?: boolean }).held),
          );
          for (const time of FILM_TIMES) {
            await seekNew(filmPage, time);
            if (viewport.width === 390) await expectNoScroll(filmPage);
            await capture(
              filmPage,
              `${SCREENS}/t10-${state}-${theme}-${viewport.width}-film-${String(time).padStart(3, "0")}.png`,
            );
          }
        } finally {
          await release();
        }
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
    try {
      await openImport(page);
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
        for (const time of THEME_TIMES) {
          await seek(page, time);
          if (viewport.width === 390) await expectNoScroll(page);
          await capture(
            page,
            `${SCREENS}/t10-theme-to-${choice}-${viewport.width}-${String(time).padStart(4, "0")}.png`,
          );
        }
        await expectNoShift(page, `theme-to-${choice}-${viewport.width}`);
      }
    } finally {
      await context.close();
    }
  }

  writeFileSync(`${SCREENS}/t10-layout-shift.json`, `${JSON.stringify(shifts, null, 2)}\n`);
  expect(Object.keys(shifts)).toHaveLength(16);
  for (const value of Object.values(shifts)) expect(value).toBe(0);
  expect(csp).toEqual([]);
});
