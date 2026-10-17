import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { LINK_STATES, type Portfolio, type PortfolioProject } from "../src/lib/portfolio/aggregate";
import { createOwner, removeOwner, sessionCookies, type SessionCookie } from "./support/owner";
import { emptyPortfolio, query, syntheticPortfolio } from "./support/portfolio";

const MAP_OWNER = [
  { githubId: "700011", login: "fixture-map-owner" },
  { githubId: "700012", login: "fixture-map-other" },
] as const;

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;

const STATES = ["loading", "map", "list", "selected", "empty", "error", "offline", "register", "register-invalid"] as const;

test.describe.configure({ timeout: 360_000 });

let ownerCookies: SessionCookie[] = [];
let otherCookies: SessionCookie[] = [];

test.beforeAll(async () => {
  mkdirSync(".devos/screens", { recursive: true });
  await removeOwner(MAP_OWNER);
  await createOwner({ githubId: "700011", login: "fixture-map-owner", allowListed: true });
  await createOwner({ githubId: "700012", login: "fixture-map-other", allowListed: false });
  ownerCookies = await sessionCookies("fixture-map-owner@example.test");
  otherCookies = await sessionCookies("fixture-map-other@example.test");
});

test.afterAll(async () => {
  await removeOwner(MAP_OWNER);
  query("delete from public.projects where key = 'E2E';");
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
    for (const animation of document.getAnimations()) {
      if (animation.playState === "finished") animation.cancel();
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

async function fulfillJson(page: Page, body: unknown, status = 200) {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/api/projects", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

function changedPortfolio(source: Portfolio): Portfolio {
  const projects: PortfolioProject[] = source.projects.map((project, index) => {
    if (index > 3 || !project.latest) return project;
    const receivedAt = new Date(Date.parse(project.latest.receivedAt) + (index + 1) * 3_600_000).toISOString();
    const latest = { ...project.latest, step: "review", status: "fail", receivedAt, at: receivedAt };
    return { ...project, latest, lastContactAt: receivedAt, lastActivityAt: receivedAt, recent: [latest, ...project.recent] };
  });
  const recentActivity = projects
    .flatMap((project) => project.recent)
    .sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt))
    .slice(0, 6);
  return { ...source, projects, recentActivity };
}

test("Gate and truth", async ({ browser }) => {
  const csp: string[] = [];
  const denied = await browser.newContext();
  await denied.addCookies(otherCookies);
  const deniedPage = await denied.newPage();
  watchCsp(deniedPage, csp);
  const forbidden = await deniedPage.request.get("/api/projects");
  expect(forbidden.status()).toBe(403);
  expect(await forbidden.json()).toEqual({ error: "forbidden" });
  const deniedResponse = await deniedPage.goto("/");
  expect(deniedPage.url()).toContain("/sign-in?reason=not_owner");
  expect(deniedResponse?.status()).toBe(403);
  await denied.close();

  const context = await browser.newContext();
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  const response = await page.request.get("/api/projects");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = (await response.json()) as Portfolio;
  const fixture = body.projects.find((project) => project.key === "FIXTURE");
  expect(fixture?.latest?.task).toBe("T02");
  expect(fixture?.latest?.phase).toBe("P01");
  expect(fixture?.execution).toBe("ci");
  expect(fixture?.tasks).toEqual({ passed: 0, seen: 1 });
  expect(fixture?.phase).toEqual({ id: "P01", passed: 0, seen: 1 });
  expect(fixture?.linkState).toBe("steady");

  const projects = Number(query("select count(*) from public.projects"));
  const epoch = query("select coalesce((extract(epoch from max(received_at)) * 1000)::bigint::text, '') from public.events");
  const hour = Number(query("select count(*) from public.events where received_at > now() - interval '1 hour'"));
  const deliveries = Number(query("select count(*) from public.webhook_deliveries where received_at >= now() - interval '24 hours'"));
  const rejections = Number(query("select count(*) from public.event_rejections where received_at >= now() - interval '24 hours'"));
  expect(body.totals.projects).toBe(projects);
  expect(body.health.stepEventsLastHour).toBe(hour);
  expect(body.health.deliveriesLast24h).toBe(deliveries);
  expect(body.health.rejectionsLast24h).toBe(rejections);
  expect(body.health.lastReceivedAt).not.toBeNull();
  expect(Math.floor(Date.parse(body.health.lastReceivedAt ?? "") / 1000)).toBe(Math.floor(Number(epoch) / 1000));
  expect(csp).toEqual([]);
  await context.close();
});

test("Map", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/");
  const card = page.locator('[data-project="FIXTURE"][data-map-card]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("GitHub Actions");
  await expect(card).toContainText("0 / 1");
  await expect(card).toContainText("checks · pass");
  await expect(card).toContainText("reported");
  await expect(card).toHaveAttribute("data-link-state", "steady");
  await expect(page.getByRole("banner").getByText("live", { exact: true })).toBeVisible();
  await expect(page.locator("[data-activity-row]").first()).toContainText("FIXTURE");
  const hour = query("select count(*) from public.events where received_at > now() - interval '1 hour'");
  const deliveries = query("select count(*) from public.webhook_deliveries where received_at >= now() - interval '24 hours'");
  const rejections = query("select count(*) from public.event_rejections where received_at >= now() - interval '24 hours'");
  await expect(page.locator('[data-health="hour"]')).toHaveText(hour);
  await expect(page.locator('[data-health="deliveries"]')).toHaveText(deliveries);
  await expect(page.locator('[data-health="rejections"]')).toHaveText(rejections);
  await expect(page.locator("[data-map] svg[viewBox='0 0 1200 660']")).toHaveAttribute("aria-hidden", "true");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 400));
  const scene = await page.evaluate(() => {
    const element = document.querySelector("[data-scene]");
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      scrollTop: document.scrollingElement?.scrollTop ?? 0,
      position: getComputedStyle(element).position,
      top: box.top,
      height: box.height,
      innerHeight: window.innerHeight,
    };
  });
  expect(scene?.scrollTop).toBeGreaterThan(0);
  expect(scene?.position).toBe("fixed");
  expect(scene?.top).toBe(0);
  expect(scene?.height).toBeGreaterThanOrEqual(scene?.innerHeight ?? 0);
  expect(csp).toEqual([]);
  await context.close();
});

test("Link states and overflow", async ({ browser }) => {
  const csp: string[] = [];
  const now = new Date();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await fulfillJson(page, syntheticPortfolio(now, 8));
  await page.goto("/");
  await expect(page.locator("[data-map-card]")).toHaveCount(8);
  for (const state of LINK_STATES) {
    const card = page.locator(`[data-map-card][data-link-state="${state}"]`);
    await expect(card).toHaveCount(1);
    const slot = await card.getAttribute("data-slot");
    await expect(page.locator(`g[data-slot="${slot}"]`)).toHaveAttribute("data-link-state", state);
  }
  await expect(page.getByRole("button", { name: "All 8" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Active 3" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Waiting 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "At a gate 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Failed 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stale or silent 2" })).toBeVisible();
  await page.getByRole("button", { name: "At a gate 1" }).click();
  await expect(page.locator("[data-map-card][data-dimmed='filter']")).toHaveCount(7);
  await expect(page.locator("[data-map-card]:not([data-dimmed])")).toHaveCount(1);
  await expect(page.locator("[data-map-card]:not([data-dimmed])")).toHaveAttribute("data-link-state", "gate");

  await fulfillJson(page, syntheticPortfolio(now, 10));
  await page.reload();
  await expect(page.locator("[data-map-card]")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "+3 more · List" })).toBeVisible();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator("[data-list-card]")).toHaveCount(10);
  expect(csp).toEqual([]);
  await context.close();
});

test("Selected", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await fulfillJson(page, syntheticPortfolio(new Date(), 8));
  await page.goto("/");
  const card = page.locator("[data-map-card]").first();
  await card.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("fixture-org/alpha");
  await expect(dialog).toContainText("GitHub Actions");
  await expect(page.locator("[data-map-card][data-dimmed='panel']")).toHaveCount(7);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeFocused();
  expect(csp).toEqual([]);
  await context.close();
});

test("States and live changes", async ({ browser }) => {
  const csp: string[] = [];
  const now = new Date();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.clock.install({ time: now });

  await page.route("**/api/projects", () => undefined);
  await page.goto("/");
  await expect(page.locator("[aria-busy='true']")).toBeVisible();

  await fulfillJson(page, emptyPortfolio(now));
  await page.reload();
  await expect(page.getByText("No project yet. Register the first one.")).toBeVisible();

  await fulfillJson(page, { error: "unavailable" }, 503);
  await page.reload();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "The Tower could not read its own database. No number is shown until it can.",
  );
  const mainText = await page.locator("main").innerText();
  expect(mainText).not.toMatch(/\d/);

  const eight = syntheticPortfolio(now, 8);
  let calls = 0;
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/api/projects", (route) => {
    calls += 1;
    if (calls === 1) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(eight) });
    }
    return route.abort();
  });
  await page.reload();
  await expect(page.locator("[data-map-card]")).toHaveCount(8);
  await page.clock.fastForward(30_000);
  await expect(page.getByRole("banner").locator("[data-status='offline']").getByText("offline", { exact: true })).toBeVisible();
  await expect(page.getByText("offline · last known state")).toBeVisible();
  await expect(page.locator("[data-map-card]")).toHaveCount(8);

  const next = changedPortfolio(eight);
  calls = 0;
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/api/projects", (route) => {
    calls += 1;
    const body = calls === 1 ? eight : next;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.reload();
  await expect(page.locator('[data-project="ALPHA"]').first()).toContainText("checks · started");
  await page.clock.fastForward(30_000);
  for (const key of ["ALPHA", "BRAVO", "CHARLIE", "DELTA"]) {
    await expect(page.locator(`[data-project="${key}"]`).first()).toContainText("review · fail");
  }
  await expect(page.locator("[data-activity-row]").first()).toContainText("DELTA");
  expect(await page.locator("[data-signal]").count()).toBeLessThanOrEqual(3);
  expect(csp).toEqual([]);
  await context.close();
});

test("Register", async ({ browser }) => {
  const csp: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  await page.goto("/projects/new");
  await expect(page.getByRole("link", { name: "Register project" })).toHaveAttribute("aria-current", "page");
  const before = query("select count(*) from public.projects");
  await page.getByLabel("Key").fill("bad");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByLabel("Key")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Use 2 to 32 characters: a capital letter, then capitals, digits, - or _.")).toBeVisible();
  expect(query("select count(*) from public.projects")).toBe(before);

  await page.getByLabel("Key").fill("TAKEN");
  await page.getByLabel("Repository").fill("fixture-org/fixture-repo");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByText("This repository is already registered.")).toBeVisible();

  await page.getByLabel("Key").fill("E2E");
  await page.getByLabel("Repository").fill("fixture-org/e2e-repo");
  await page.getByLabel("Stale after (minutes)").fill("60");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL(/\/\?registered=E2E$/);
  await expect(page.getByRole("status")).toHaveText("Project E2E registered.");
  await expect(page.locator("[data-project='E2E']:visible")).toBeVisible();
  expect(query("select owner_github_id from public.projects where key = 'E2E'")).toBe("700011");
  query("delete from public.projects where key = 'E2E';");
  expect(csp).toEqual([]);
  await context.close();
});

test("Evidence", async ({ browser }) => {
  const csp: string[] = [];
  const shifts: Record<string, number> = {};
  const now = new Date();
  const eight = syntheticPortfolio(now, 8);

  async function show(page: Page, state: (typeof STATES)[number]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    if (state === "register" || state === "register-invalid") {
      await page.goto("/projects/new", { waitUntil: "load" });
      if (state === "register-invalid") {
        await page.getByLabel("Key").fill("bad");
        await page.getByRole("button", { name: "Register", exact: true }).click();
        await expect(page.getByLabel("Key")).toHaveAttribute("aria-invalid", "true");
      }
      return;
    }
    if (state === "loading") {
      await page.route("**/api/projects", () => undefined);
      await page.goto("/", { waitUntil: "load" });
      await expect(page.locator("[aria-busy='true']")).toBeVisible();
      return;
    }
    if (state === "empty") {
      await fulfillJson(page, emptyPortfolio(now));
      await page.goto("/", { waitUntil: "load" });
      await expect(page.getByText("No project yet. Register the first one.")).toBeVisible();
      return;
    }
    if (state === "error") {
      await fulfillJson(page, { error: "unavailable" }, 503);
      await page.goto("/", { waitUntil: "load" });
      await expect(page.locator("main").getByRole("alert")).toBeVisible();
      return;
    }
    let calls = 0;
    await page.route("**/api/projects", (route) => {
      calls += 1;
      if (state === "offline" && calls > 1) return route.abort();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(eight) });
    });
    await page.goto("/", { waitUntil: "load" });
    const alpha = page.locator("[data-project='ALPHA']:visible");
    await expect(alpha.first()).toBeVisible();
    if (state === "list") await page.getByRole("button", { name: "List", exact: true }).click();
    if (state === "selected") await alpha.first().click();
    if (state === "offline") {
      await page.clock.fastForward(30_000);
      await expect(page.getByText("offline · last known state")).toBeVisible();
    }
    if (state === "selected") await expect(page.getByRole("dialog")).toBeVisible();
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
        await page.clock.install({ time: now });
        watchCsp(page, csp);
        for (const state of STATES) {
          await show(page, state);
          await settle(page);
          if (reduced) expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
          const suffix = reduced ? "-reduced" : "";
          await page.screenshot({ path: `.devos/screens/t05-${state}-${theme}-${viewport.width}${suffix}.png` });
          shifts[`${state}-${theme}-${viewport.width}${suffix}`] = await readShift(page);
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
      await fulfillJson(filmPage, eight);
      await filmPage.goto("/", { waitUntil: "load" });
      await expect(filmPage.locator("[data-project='ALPHA']:visible").first()).toBeVisible();
      for (const time of [0, 80, 160, 320, 640]) {
        await seek(filmPage, time);
        await filmPage.screenshot({
          path: `.devos/screens/t05-map-${theme}-${viewport.width}-film-${String(time).padStart(3, "0")}.png`,
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
    await fulfillJson(page, eight);
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
          path: `.devos/screens/t05-theme-to-${choice}-${viewport.width}-${String(time).padStart(4, "0")}.png`,
        });
      }
      shifts[`theme-to-${choice}-${viewport.width}`] = await readShift(page);
    }
    await context.close();
  }

  writeFileSync(".devos/screens/t05-layout-shift.json", `${JSON.stringify(shifts, null, 2)}\n`);
  expect(Object.keys(shifts)).toHaveLength(76);
  for (const value of Object.values(shifts)) expect(value).toBe(0);
  expect(csp).toEqual([]);
});
