import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createOwner, removeOwner, sessionCookies, type SessionCookie } from "./support/owner";
import { query } from "./support/portfolio";

const OWNERS = [
  { githubId: "700021", login: "fixture-usage-owner" },
  { githubId: "700022", login: "fixture-usage-other" },
] as const;

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;

const STATES = ["usage", "empty", "error"] as const;

const format = new Intl.NumberFormat("en");

test.describe.configure({ timeout: 360_000 });

let ownerCookies: SessionCookie[] = [];
let otherCookies: SessionCookie[] = [];

test.beforeAll(async () => {
  mkdirSync(".devos/screens", { recursive: true });
  await removeOwner(OWNERS);
  await createOwner({ githubId: "700021", login: "fixture-usage-owner", allowListed: true });
  await createOwner({ githubId: "700022", login: "fixture-usage-other", allowListed: false });
  ownerCookies = await sessionCookies("fixture-usage-owner@example.test");
  otherCookies = await sessionCookies("fixture-usage-other@example.test");
});

test.afterAll(async () => {
  await removeOwner(OWNERS);
  query("grant select on public.usage_by_attempt to authenticated");
});

function watchCsp(page: Page, messages: string[]) {
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) messages.push(message.text());
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

function countEnded(step: string): number {
  return Number(
    query(
      `select count(*) from public.events e join public.projects p on p.id = e.project_id where p.key = 'USAGE' and e.step = '${step}' and e.status in ('pass', 'fail', 'waiting')`,
    ),
  );
}

function countMeasured(step: string, agent: string): number {
  return Number(
    query(
      `select count(*) from public.events e join public.projects p on p.id = e.project_id where p.key = 'USAGE' and e.step = '${step}' and e.status in ('pass', 'fail', 'waiting') and exists (select 1 from public.event_usage u where u.event_id = e.id and u.agent = '${agent}') and not exists (select 1 from public.event_usage u where u.event_id = e.id and u.agent = '${agent}' and u.source <> 'measured')`,
    ),
  );
}

test("Gate", async ({ request, browser }) => {
  const csp: string[] = [];
  const signedOut = await request.get("/projects/USAGE/usage", { maxRedirects: 0 });
  expect(signedOut.status()).toBe(302);
  expect(signedOut.headers().location ?? "").toMatch(/\/sign-in$/);

  const denied = await browser.newContext();
  await denied.addCookies(otherCookies);
  const deniedPage = await denied.newPage();
  watchCsp(deniedPage, csp);
  const deniedResponse = await deniedPage.goto("/projects/USAGE/usage");
  expect(deniedPage.url()).toContain("/sign-in?reason=not_owner");
  expect(deniedResponse?.status()).toBe(403);
  await denied.close();

  const context = await browser.newContext();
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  const missing = await page.goto("/projects/NOPE/usage");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  const lower = await page.goto("/projects/nope/usage");
  expect(lower?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  expect(csp).toEqual([]);
  await context.close();
});

test("Truth", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/projects/USAGE/usage");
  await expect(page.getByRole("heading", { name: "Usage", level: 1 })).toBeVisible();

  const reviewer = `reviewer: ${format.format(countMeasured("review", "reviewer"))} of ${format.format(countEnded("review"))} attempts measured`;
  const builder = `builder: ${format.format(countMeasured("build", "builder"))} of ${format.format(countEnded("build"))} attempts measured`;
  await expect(page.locator("[data-coverage='reviewer']")).toHaveText(reviewer);
  await expect(page.locator("[data-coverage='builder']")).toHaveText(builder);

  const sums = query(
    "select sum(input)::text || '|' || sum(output)::text || '|' || sum(cache_read)::text || '|' || sum(cache_write)::text from public.usage_by_attempt where project_key = 'USAGE' and agent = 'reviewer' and source = 'measured'",
  )
    .split("|")
    .map((value) => format.format(Number(value)));
  await expect(page.locator("[data-usage-total='reviewer-input']")).toHaveText(sums[0] ?? "");
  await expect(page.locator("[data-usage-total='reviewer-output']")).toHaveText(sums[1] ?? "");
  await expect(page.locator("[data-usage-total='reviewer-cacheRead']")).toHaveText(sums[2] ?? "");
  await expect(page.locator("[data-usage-total='reviewer-cacheWrite']")).toHaveText(sums[3] ?? "");
  for (const field of ["input", "output", "cacheRead", "cacheWrite"]) {
    await expect(page.locator(`[data-usage-total='builder-${field}']`)).toHaveText("—");
  }

  const models = Number(
    query("select count(*) from (select distinct agent, model from public.usage_by_attempt where project_key = 'USAGE') s"),
  );
  await expect(page.locator("[data-model-row]")).toHaveCount(models);

  const open = Number(query("select count(*) from public.usage_by_attempt where project_key = 'USAGE' and status <> 'fail'"));
  const failed = Number(query("select count(*) from public.usage_by_attempt where project_key = 'USAGE' and status = 'fail'"));
  await expect(page.locator("[data-failed-attempts] [data-attempt-row]")).toHaveCount(failed);
  const outside = await page.locator("[data-attempt-row]").evaluateAll((rows) => rows.filter((row) => !row.closest("[data-failed-attempts]")).length);
  expect(outside).toBe(open);

  const stored = query(
    "select run_key || '|' || agent || '|' || model || '|' || account_alias || '|' || coalesce(input::text, 'null') || '|' || coalesce(output::text, 'null') || '|' || coalesce(cache_read::text, 'null') || '|' || coalesce(cache_write::text, 'null') from public.usage_by_attempt where project_key = 'USAGE' order by run_key, agent, model, account_alias",
  ).split("\n");
  for (const line of stored) {
    const [runKey, agent, model, alias, input, output, cacheRead, cacheWrite] = line.split("|");
    const row = page
      .locator("[data-attempt-row]")
      .filter({ hasText: runKey })
      .filter({ hasText: agent })
      .filter({ hasText: model })
      .filter({ hasText: alias });
    const cells = row.locator("td");
    const expected = [input, output, cacheRead, cacheWrite].map((value) => (value === "null" ? "—" : format.format(Number(value))));
    for (let index = 0; index < expected.length; index += 1) {
      const text = (await cells.nth(index + 4).innerText()).trim();
      expect(text).toBe(expected[index]);
      if ([input, output, cacheRead, cacheWrite][index] === "null") expect(text).not.toBe("0");
    }
  }

  const attemptRows = page.locator("[data-attempt-row]");
  const rowCount = await attemptRows.count();
  for (let index = 0; index < rowCount; index += 1) {
    const row = attemptRows.nth(index);
    await expect(row.getByText("reported", { exact: true })).toBeVisible();
    expect(await row.locator("time").getAttribute("title")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
  }
  await expect(page.locator("[data-usage-legend]")).toBeVisible();

  await page.goto("/projects/FIXTURE/usage");
  await expect(page.locator("[data-attempt-row]")).toHaveCount(1);
  expect(csp).toEqual([]);
  await context.close();
});

test("States", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/projects/QUIET/usage");
  await expect(page.locator("[data-coverage='reviewer']")).toHaveText("reviewer: 0 of 0 attempts measured");
  await expect(page.locator("[data-coverage='builder']")).toHaveText("builder: 0 of 0 attempts measured");
  await expect(page.getByText("No usage recorded yet.")).toBeVisible();
  await expect(page.locator("[data-usage-table]")).toHaveCount(0);

  try {
    query("revoke select on public.usage_by_attempt from authenticated");
    await page.goto("/projects/USAGE/usage");
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await expect(page.getByText("This could not be shown.")).toBeVisible();
    await expect(page.locator("[data-coverage]")).toHaveCount(0);
    await expect(page.locator("[data-usage-total]")).toHaveCount(0);
    await expect(page.locator("[data-attempt-row]")).toHaveCount(0);
  } finally {
    query("grant select on public.usage_by_attempt to authenticated");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects/USAGE/usage");
  await expect(page.locator("[data-attempt-row]").first()).toBeVisible();
  const fit = await page.evaluate(() => {
    const root = document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    const tables = [...document.querySelectorAll("[data-usage-table]")].every((element) => element.scrollWidth <= element.clientWidth);
    return root && tables;
  });
  expect(fit).toBe(true);
  expect(csp).toEqual([]);
  await context.close();
});

test("Way in", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/");
  await page.locator("[data-project='USAGE']:visible").click();
  const link = page.getByRole("dialog").getByRole("link", { name: "Usage", exact: true });
  await expect(link).toHaveAttribute("href", "/projects/USAGE/usage");
  await link.click();
  await expect(page.getByRole("heading", { name: "Usage", level: 1 })).toBeVisible();
  expect(csp).toEqual([]);
  await context.close();
});

test("Evidence", async ({ browser }) => {
  const csp: string[] = [];
  const shifts: Record<string, number> = {};

  async function show(page: Page, state: (typeof STATES)[number]) {
    if (state === "empty") {
      await page.goto("/projects/QUIET/usage", { waitUntil: "load" });
      await expect(page.getByText("No usage recorded yet.")).toBeVisible();
      return;
    }
    if (state === "error") {
      query("revoke select on public.usage_by_attempt from authenticated");
      await page.goto("/projects/USAGE/usage", { waitUntil: "load" });
      await expect(page.locator("main").getByRole("alert")).toBeVisible();
      return;
    }
    await page.goto("/projects/USAGE/usage", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "Usage", level: 1 })).toBeVisible();
  }

  for (const theme of ["light", "dark"] as const) {
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
        for (const state of STATES) {
          try {
            await show(page, state);
            await settle(page);
            if (reduced) expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
            const suffix = reduced ? "-reduced" : "";
            shifts[`${state}-${theme}-${viewport.width}${suffix}`] = await readShift(page);
            await page.screenshot({
              path: `.devos/screens/t06-${state}-${theme}-${viewport.width}${suffix}.png`,
              fullPage: true,
            });
          } finally {
            if (state === "error") query("grant select on public.usage_by_attempt to authenticated");
          }
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
      await filmPage.goto("/projects/USAGE/usage", { waitUntil: "load" });
      await expect(filmPage.getByRole("heading", { name: "Usage", level: 1 })).toBeVisible();
      for (const time of [0, 80, 160, 320, 640]) {
        await seek(filmPage, time);
        await filmPage.screenshot({
          path: `.devos/screens/t06-usage-${theme}-${viewport.width}-film-${String(time).padStart(3, "0")}.png`,
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
    await page.goto("/projects/USAGE/usage", { waitUntil: "load" });
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
          path: `.devos/screens/t06-theme-to-${choice}-${viewport.width}-${String(time).padStart(4, "0")}.png`,
        });
      }
      shifts[`theme-to-${choice}-${viewport.width}`] = await readShift(page);
    }
    await context.close();
  }

  writeFileSync(".devos/screens/t06-layout-shift.json", `${JSON.stringify(shifts, null, 2)}\n`);
  expect(Object.keys(shifts)).toHaveLength(28);
  for (const value of Object.values(shifts)) expect(value).toBe(0);
  expect(csp).toEqual([]);
});
