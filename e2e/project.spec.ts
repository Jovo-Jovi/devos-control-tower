import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createOwner, removeOwner, sessionCookies, type SessionCookie } from "./support/owner";
import { query } from "./support/portfolio";

const OWNERS = [
  { githubId: "700031", login: "fixture-project-owner" },
  { githubId: "700032", login: "fixture-project-other" },
] as const;

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;

const STATES = ["project", "empty", "error"] as const;

test.describe.configure({ timeout: 360_000 });

let ownerCookies: SessionCookie[] = [];
let otherCookies: SessionCookie[] = [];

test.beforeAll(async () => {
  mkdirSync(".devos/screens", { recursive: true });
  await removeOwner(OWNERS);
  await createOwner({ githubId: "700031", login: "fixture-project-owner", allowListed: true });
  await createOwner({ githubId: "700032", login: "fixture-project-other", allowListed: false });
  ownerCookies = await sessionCookies("fixture-project-owner@example.test");
  otherCookies = await sessionCookies("fixture-project-other@example.test");
});

test.afterAll(async () => {
  await removeOwner(OWNERS);
  query("grant select on public.observations to authenticated");
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

test("Gate", async ({ request, browser }) => {
  const csp: string[] = [];
  const signedOut = await request.get("/projects/TRACE", { maxRedirects: 0 });
  expect(signedOut.status()).toBe(302);
  expect(signedOut.headers().location ?? "").toMatch(/\/sign-in$/);

  const denied = await browser.newContext();
  await denied.addCookies(otherCookies);
  const deniedPage = await denied.newPage();
  watchCsp(deniedPage, csp);
  const deniedResponse = await deniedPage.goto("/projects/TRACE");
  expect(deniedPage.url()).toContain("/sign-in?reason=not_owner");
  expect(deniedResponse?.status()).toBe(403);
  await denied.close();

  const context = await browser.newContext();
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  const missing = await page.goto("/projects/NOPE");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  const lower = await page.goto("/projects/nope");
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
  await page.goto("/projects/TRACE");
  await expect(page.getByRole("heading", { name: "TRACE", level: 1 })).toBeVisible();

  const phases = query(
    "select string_agg(phase, ',' order by phase) from (select distinct e.phase from public.events e join public.projects p on p.id = e.project_id where p.key = 'TRACE' and e.task is not null and e.phase is not null) s",
  );
  await expect(page.locator("[data-phase]")).toHaveText(phases.split(","));

  const tasks = query(
    "select string_agg(task || ' ' || step || ' · ' || status || ' ' || origin, E'\\n' order by task) from (select distinct on (e.task) e.task, e.step, e.status, e.origin from public.events e join public.runs r on r.id = e.run_id join public.projects p on p.id = e.project_id where p.key = 'TRACE' and e.task is not null order by e.task, r.created_at desc, r.run_key desc, e.seq desc) s",
  );
  for (const line of tasks.split("\n")) {
    const task = line.split(" ")[0] ?? "";
    await expect(page.locator(`[data-task-row="${task}"]`)).toContainText(line);
  }

  const runOrder = query(
    "select string_agg(r.run_key, ',' order by r.created_at desc, r.run_key desc) from public.runs r join public.projects p on p.id = r.project_id where p.key = 'TRACE'",
  );
  const runs = await page.locator("[data-run]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-run")));
  expect(runs.join(",")).toBe(runOrder);

  for (const runKey of runOrder.split(",")) {
    const seqs = query(
      `select coalesce(string_agg(e.seq::text, ',' order by e.seq), '') from public.events e join public.runs r on r.id = e.run_id join public.projects p on p.id = e.project_id where p.key = 'TRACE' and r.run_key = '${runKey}'`,
    );
    const shown = await page
      .locator(`[data-run="${runKey}"] [data-seq]`)
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-seq")));
    expect(shown.join(",")).toBe(seqs);
  }

  const stepEvents = Number(
    query("select count(*) from public.events e join public.projects p on p.id = e.project_id where p.key = 'TRACE'"),
  );
  await expect(page.locator("[data-step-event]")).toHaveCount(stepEvents);
  const origins = query(
    "select string_agg(origin || ':' || n, ',' order by origin) from (select e.origin, count(*) as n from public.events e join public.projects p on p.id = e.project_id where p.key = 'TRACE' group by e.origin) s",
  );
  const shownOrigins = await page.locator("[data-step-event] [data-origin]").evaluateAll((elements) => {
    const counts = new Map<string, number>();
    for (const element of elements) {
      const origin = element.getAttribute("data-origin") ?? "";
      counts.set(origin, (counts.get(origin) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([origin, count]) => `${origin}:${count}`)
      .join(",");
  });
  expect(shownOrigins).toBe(origins);

  await expect(page.locator('[data-run="gha-301-1"] [data-seq="3"]')).toContainText("verified");
  await expect(page.locator('[data-run="gha-301-1"] [data-seq-gap]')).toHaveCount(1);
  await expect(page.locator('[data-run="gha-301-1"] [data-seq-gap]')).toHaveText("Missing before seq 5: 1");
  await expect(page.locator('[data-run="gha-302-1"] [data-seq="1"]')).toContainText("unfinished");
  await expect(page.locator('[data-run="gha-302-1"] [data-seq="1"] [data-live-dot]')).toHaveCount(0);
  await expect(page.locator('[data-run="gha-301-1"] [data-seq="1"] [data-live-dot]')).toHaveCount(0);
  await expect(page.locator('[data-run="gha-301-1"] [data-seq="5"] a')).toHaveAttribute(
    "href",
    "https://github.com/fixture-org/trace-repo/blob/c0ffee1/docs/reviews/T01-a1.md",
  );
  await expect(page.locator('[data-run="gha-301-1"] [data-seq="2"] a')).toHaveAttribute(
    "href",
    "https://github.com/fixture-org/trace-repo/commit/c0ffee1",
  );

  const titles = await page.locator("[data-step-event] time").evaluateAll((elements) => elements.map((element) => element.getAttribute("title")));
  expect(titles).toHaveLength(stepEvents);
  for (const title of titles) expect(title).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  const observed = query(
    "select kind || '|' || coalesce(context, '') || '|' || state || '|' || left(sha, 7) from public.observations o join public.projects p on p.id = o.project_id where p.key = 'TRACE' order by o.received_at desc, o.id desc",
  );
  const observationRows = observed.split("\n");
  await expect(page.locator("[data-observation]")).toHaveCount(observationRows.length);
  for (const [index, line] of observationRows.entries()) {
    const [kind, context, state, sha] = line.split("|");
    const row = page.locator("[data-observation]").nth(index);
    await expect(row).toContainText(context ? `${kind} · ${context} · ${state}` : `${kind} · ${state}`);
    await expect(row).toContainText(sha ?? "");
    await expect(row.locator("[data-origin='observed']")).toHaveCount(1);
  }

  await expect(page.getByText("Last contact", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Last activity", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Usage", exact: true })).toHaveAttribute("href", "/projects/TRACE/usage");
  expect(csp).toEqual([]);
  await context.close();
});

test("States", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/projects/QUIET");
  await expect(page.getByText("No step event recorded yet.")).toBeVisible();
  await expect(page.getByText("No observation yet.")).toBeVisible();
  await expect(page.locator("[data-run]")).toHaveCount(0);
  await expect(page.locator("[data-phase-rail]")).toHaveCount(0);
  await expect(page.getByText("No contact yet", { exact: true })).toHaveCount(1);

  try {
    query("revoke select on public.observations from authenticated");
    await page.goto("/projects/TRACE");
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await expect(page.getByText("This could not be shown.")).toBeVisible();
    await expect(page.locator("[data-phase-rail]")).toHaveCount(0);
    await expect(page.locator("[data-run]")).toHaveCount(0);
    await expect(page.locator("[data-observation]")).toHaveCount(0);
  } finally {
    query("grant select on public.observations to authenticated");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects/TRACE");
  await expect(page.locator("[data-step-event]").first()).toBeVisible();
  const fit = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
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
  await expect(page.locator('[data-project="TRACE"][data-map-card]')).toBeVisible();
  const inside = await page.locator('[data-project="TRACE"][data-map-card]').evaluate((card) => {
    const fact = card.querySelector("[data-card-fact]");
    if (!fact) return false;
    const outer = card.getBoundingClientRect();
    return [...fact.children].every((child) => {
      const box = child.getBoundingClientRect();
      return (
        box.top >= outer.top - 0.5 &&
        box.bottom <= outer.bottom + 0.5 &&
        box.left >= outer.left - 0.5 &&
        box.right <= outer.right + 0.5
      );
    });
  });
  expect(inside).toBe(true);
  await page.locator('[data-project="TRACE"][data-map-card]').click();
  const link = page.getByRole("dialog").getByRole("link", { name: "Project page", exact: true });
  await expect(link).toHaveAttribute("href", "/projects/TRACE");
  await link.click();
  await expect(page.getByRole("heading", { name: "TRACE", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Usage", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Usage", level: 1 })).toBeVisible();
  expect(csp).toEqual([]);
  await context.close();
});

test("Evidence", async ({ browser }) => {
  const csp: string[] = [];
  const shifts: Record<string, number> = {};

  async function show(page: Page, state: (typeof STATES)[number]) {
    if (state === "empty") {
      await page.goto("/projects/QUIET", { waitUntil: "load" });
      await expect(page.getByText("No step event recorded yet.")).toBeVisible();
      return;
    }
    if (state === "error") {
      query("revoke select on public.observations from authenticated");
      await page.goto("/projects/TRACE", { waitUntil: "load" });
      await expect(page.locator("main").getByRole("alert")).toBeVisible();
      return;
    }
    await page.goto("/projects/TRACE", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "TRACE", level: 1 })).toBeVisible();
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
              path: `.devos/screens/t07-${state}-${theme}-${viewport.width}${suffix}.png`,
              fullPage: true,
            });
          } finally {
            if (state === "error") query("grant select on public.observations to authenticated");
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
      await filmPage.goto("/projects/TRACE", { waitUntil: "load" });
      await expect(filmPage.getByRole("heading", { name: "TRACE", level: 1 })).toBeVisible();
      for (const time of [0, 80, 160, 320, 640]) {
        await seek(filmPage, time);
        await filmPage.screenshot({
          path: `.devos/screens/t07-project-${theme}-${viewport.width}-film-${String(time).padStart(3, "0")}.png`,
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
    await page.goto("/projects/TRACE", { waitUntil: "load" });
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
          path: `.devos/screens/t07-theme-to-${choice}-${viewport.width}-${String(time).padStart(4, "0")}.png`,
        });
      }
      shifts[`theme-to-${choice}-${viewport.width}`] = await readShift(page);
    }
    await context.close();
  }

  writeFileSync(".devos/screens/t07-layout-shift.json", `${JSON.stringify(shifts, null, 2)}\n`);
  expect(Object.keys(shifts)).toHaveLength(28);
  for (const value of Object.values(shifts)) expect(value).toBe(0);
  expect(csp).toEqual([]);
});
