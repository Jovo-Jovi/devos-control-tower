import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createOwner, removeOwner, sessionCookies, type SessionCookie } from "./support/owner";
import { query } from "./support/portfolio";

const OWNERS = [{ githubId: "700071", login: "fixture-link-flow-owner" }] as const;

const SCREENS = ".devos/screens";
const ENGINE = "0.2.9";
const CONTRACT = "0-draft-3";
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;
const FILM_TIMES = [0, 80, 160, 320, 640] as const;

const COPY = {
  linked: "Linked as LINK-FLOW.",
  disconnectedDone: "Disconnected. Its history stays for the record.",
  disconnected: "disconnected",
  projectLinked: "This project is already linked by another request. The request stays pending.",
  deletedProject: "Deleted. Its project and every run and step event went with it.",
  rejections: "Rejected requests, last 24 h",
} as const;

type CaptureState = "map" | "list" | "detail" | "project" | "project-linked";
type ShiftEntry = { value: number; sources: string[] };
type ShiftBucket = { value: number; entries: ShiftEntry[] };

test.describe.configure({ timeout: 600_000 });

let ownerCookies: SessionCookie[] = [];
const recordedRequestIds: string[] = [];

test.beforeAll(async () => {
  mkdirSync(SCREENS, { recursive: true });
  await removeOwner(OWNERS);
  cleanFixtures();
  const projectCount = Number(query("select count(*) from public.projects"));
  expect(projectCount, `projects before set-up: ${projectCount}`).toBeLessThanOrEqual(6);
  await createOwner({ githubId: "700071", login: "fixture-link-flow-owner", allowListed: true });
  ownerCookies = await sessionCookies("fixture-link-flow-owner@example.test");
});

test.afterAll(async () => {
  try {
    cleanFixtures();
  } finally {
    await removeOwner(OWNERS);
  }
});

function assertUuid(value: string, label: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    throw new Error(`${label} was not a uuid`);
  }
  return value;
}

function rememberRequest(repository: string): void {
  recordedRequestIds.push(assertUuid(query(`select id from public.link_requests where repository = '${repository}'`), repository));
}

function cleanFixtures(): void {
  const found = query(
    "select coalesce(string_agg(id::text, ','), '') from public.link_requests where repository like 'fixture-e2e/%'",
  );
  const ids = new Set(recordedRequestIds);
  for (const id of found.split(",")) {
    if (id) ids.add(assertUuid(id, "link request"));
  }
  if (ids.size > 0) {
    const list = [...ids].map((id) => `'${id}'`).join(", ");
    query(`delete from public.link_audit where request_id in (${list})`);
  }
  query("delete from public.link_requests where repository like 'fixture-e2e/%'");
  query("delete from public.projects where repo like 'fixture-e2e/%'");
}

function insertPending(repository: string, ownerId: string, key: string): void {
  query(
    `insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version, first_requested_at, last_requested_at) values ('${repository}', '${ownerId}', '${key}', '${ENGINE}', '${CONTRACT}', '2026-10-26T00:00:00Z', '2026-10-26T03:00:00Z')`,
  );
  rememberRequest(repository);
}

function insertProject(key: string, repo: string, ownerId: string): string {
  query(`insert into public.projects (key, repo, owner_github_id) values ('${key}', '${repo}', '${ownerId}')`);
  return assertUuid(query(`select id from public.projects where key = '${key}'`), key);
}

function insertDecided(
  repository: string,
  ownerId: string,
  key: string,
  state: "approved" | "declined",
  projectId: string,
): void {
  query(
    `insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version, state, project_id, first_requested_at, last_requested_at, decided_at) values ('${repository}', '${ownerId}', '${key}', '${ENGINE}', '${CONTRACT}', '${state}', '${projectId}', '2026-10-26T00:00:00Z', '2026-10-26T03:00:00Z', '2026-10-26T04:00:00Z')`,
  );
  rememberRequest(repository);
}

function insertProjectLinkedCase(): void {
  const projectId = insertProject("LINK-PL", "fixture-e2e/pl-a", "1302");
  insertDecided("fixture-e2e/pl-a", "1302", "LINK-PL", "approved", projectId);
  insertPending("fixture-e2e/pl-b", "1302", "LINK-PLB");
  query("update public.projects set repo = 'fixture-e2e/pl-b' where key = 'LINK-PL'");
}

function insertDisconnectedFlow(): void {
  const projectId = insertProject("LINK-FLOW", "fixture-e2e/flow", "1301");
  insertDecided("fixture-e2e/flow", "1301", "LINK-FLOW", "declined", projectId);
}

function requestRow(page: Page, repository: string): Locator {
  return page.locator("article[data-link-request]").filter({
    has: page.locator("bdi", { hasText: new RegExp(`^${repository.replaceAll("/", "\\/")}$`) }),
  });
}

async function armShift(context: BrowserContext) {
  await context.addInitScript(() => {
    const bucket: ShiftBucket = { value: 0, entries: [] };
    Object.assign(window, { __layoutShift: bucket });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value?: number;
          hadRecentInput?: boolean;
          sources?: { node?: Node | null }[];
        };
        if (shift.hadRecentInput) continue;
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

async function consumeShift(page: Page): Promise<ShiftBucket> {
  return page.evaluate(() => {
    const bucket = (window as unknown as { __layoutShift: ShiftBucket }).__layoutShift;
    const snapshot = { value: bucket.value, entries: bucket.entries.slice() };
    bucket.value = 0;
    bucket.entries = [];
    return snapshot;
  });
}

async function settle(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getComputedTiming();
      if (!timing || timing.iterations === Infinity || !Number.isFinite(timing.endTime)) continue;
      try {
        animation.finish();
      } catch {
        // A view-transition animation rejects finish() once the transition has ended.
      }
    }
  });
}

async function waitForRoutePaint(page: Page) {
  await page.waitForFunction(() => {
    const names = new Set(["view-rise", "view-fade", "view-fade-in"]);
    return document.getAnimations().every((animation) => {
      const name = "animationName" in animation ? String((animation as CSSAnimation).animationName) : "";
      return !names.has(name) || animation.playState !== "running";
    });
  });
  await settle(page);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
      }),
  );
}

async function seek(page: Page, time: number) {
  await page.evaluate((ms) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = ms;
    }
  }, time);
}

async function expectMapFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function capture(page: Page, path: string, animations: "allow" | "disabled" = "disabled") {
  const data = await page.screenshot({ path, fullPage: true, animations });
  expect(data.byteLength).toBeGreaterThan(20_000);
}

async function openOverview(page: Page) {
  await page.goto("/", { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
  await expect(page.locator("[data-link-requests]")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
}

async function signedPage(
  browser: Browser,
  options: {
    viewport?: { width: number; height: number };
    colorScheme?: "light" | "dark";
    reducedMotion?: "reduce" | "no-preference";
  } = {},
) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1280, height: 900 },
    colorScheme: options.colorScheme,
    reducedMotion: options.reducedMotion,
  });
  await armShift(context);
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  return { context, page };
}

function clearCaptures() {
  mkdirSync(SCREENS, { recursive: true });
  for (const name of readdirSync(SCREENS)) {
    if (name.startsWith("t18-")) unlinkSync(`${SCREENS}/${name}`);
  }
}

test("Approve and decline", async ({ browser }) => {
  insertPending("fixture-e2e/flow", "1301", "LINK-FLOW");
  const { context, page } = await signedPage(browser);
  try {
    await openOverview(page);
    const row = requestRow(page, "fixture-e2e/flow");
    await expect(row).toBeVisible();
    await row.locator("[data-action=approve]").click();
    await expect(page.getByText(COPY.linked)).toBeVisible({ timeout: 20_000 });
    await expect(row).toHaveAttribute("data-request-state", "approved");
    await row.locator("[data-action=decline]").click();
    await expect(page.getByText(COPY.disconnectedDone)).toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
    const mapCard = page.locator('[data-map-card][data-project="LINK-FLOW"]');
    await expect(mapCard).toBeVisible({ timeout: 20_000 });
    await expect(mapCard).toHaveAttribute("data-link-state", "disconnected");
    await expect(mapCard.locator("[data-disconnected]")).toHaveText(COPY.disconnected);

    const slot = await mapCard.getAttribute("data-slot");
    const blade = page.locator(`g[data-slot="${slot}"]`);
    await expect(blade).toHaveAttribute("data-link-state", "disconnected");
    await expect(blade.locator("circle[data-kind]")).toHaveCount(0);

    const disconnectedRow = page.locator('[aria-label="System overview"] li').filter({ hasText: "disconnected" });
    await expect
      .poll(async () => Number((await disconnectedRow.locator("span").nth(1).innerText()).replaceAll(",", "")))
      .toBeGreaterThanOrEqual(1);
    await expect(page.getByText(COPY.rejections)).toBeVisible();

    await page.getByRole("button", { name: "List", exact: true }).click();
    const listCard = page.locator('[data-list-card][data-project="LINK-FLOW"]');
    await expect(listCard).toBeVisible();
    await expect(listCard).toHaveAttribute("data-link-state", "disconnected");
    await expect(listCard.locator("[data-disconnected]")).toHaveText(COPY.disconnected);

    await page.getByRole("button", { name: "Tower map", exact: true }).click();
    await expect(mapCard).toBeVisible();
    await mapCard.click();
    await expect(page.getByRole("dialog").locator("[data-disconnected]")).toHaveText(COPY.disconnected);
    await page.getByRole("dialog").getByRole("link", { name: "Project page" }).click();
    await expect(page).toHaveURL(/\/projects\/LINK-FLOW$/);
    await expect(page.locator("[data-disconnected]")).toHaveText(COPY.disconnected);
  } finally {
    await context.close();
  }
});

test("project_linked and delete", async ({ browser }) => {
  insertProjectLinkedCase();
  const { context, page } = await signedPage(browser);
  try {
    await openOverview(page);
    const pending = requestRow(page, "fixture-e2e/pl-b");
    await expect(pending).toBeVisible();
    const before = query("select count(*) from public.link_audit");
    await pending.locator("[data-action=approve]").click();
    await expect(pending.locator("[data-row-message]")).toHaveText(COPY.projectLinked, { timeout: 20_000 });
    await expect(pending).toHaveAttribute("data-request-state", "pending");
    await expect(
      page.locator("[data-group=pending] article[data-link-request]").filter({
        has: page.locator("bdi", { hasText: /^fixture-e2e\/pl-b$/ }),
      }),
    ).toHaveAttribute("data-request-state", "pending");
    expect(query("select count(*) from public.link_audit")).toBe(before);

    const linked = requestRow(page, "fixture-e2e/pl-a");
    await linked.locator("[data-action=delete]").click();
    await expect(linked.getByRole("button", { name: "Delete for good", exact: true })).toBeVisible();
    await linked.locator("[data-action=confirm]").click();
    await expect(page.getByText(COPY.deletedProject)).toBeVisible({ timeout: 20_000 });
  } finally {
    await context.close();
  }
});

test("Captures", async ({ browser }) => {
  clearCaptures();
  cleanFixtures();
  insertDisconnectedFlow();
  insertProjectLinkedCase();

  const shifts: Record<CaptureState, number> = {
    map: 0,
    list: 0,
    detail: 0,
    project: 0,
    "project-linked": 0,
  };
  const shiftFailures: { state: string; value: number; entries: ShiftEntry[] }[] = [];

  async function noteShift(page: Page, state: CaptureState) {
    const bucket = await consumeShift(page);
    if (bucket.value > shifts[state]) shifts[state] = bucket.value;
    if (bucket.value > 0) shiftFailures.push({ state, value: bucket.value, entries: bucket.entries });
  }

  async function captureFlow(page: Page, theme: (typeof THEMES)[number], width: number) {
    await openOverview(page);
    await expect(page.locator('[data-project="LINK-FLOW"]:visible').first()).toBeVisible({ timeout: 20_000 });
    await settle(page);
    await noteShift(page, "map");
    await expectMapFits(page);
    await capture(page, `${SCREENS}/t18-map-${theme}-${width}.png`);

    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(page.locator('[data-list-card][data-project="LINK-FLOW"]')).toBeVisible();
    await settle(page);
    await noteShift(page, "list");
    await capture(page, `${SCREENS}/t18-list-${theme}-${width}.png`);

    await page.locator('[data-project="LINK-FLOW"]:visible').first().click();
    await expect(page.getByRole("dialog").locator("[data-disconnected]")).toHaveText(COPY.disconnected);
    await settle(page);
    await noteShift(page, "detail");
    await capture(page, `${SCREENS}/t18-detail-${theme}-${width}.png`);

    await page.getByRole("dialog").getByRole("link", { name: "Project page" }).click();
    await expect(page.locator("[data-project-meta] [data-disconnected]")).toHaveText(COPY.disconnected);
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
    await waitForRoutePaint(page);
    await noteShift(page, "project");
    await capture(page, `${SCREENS}/t18-project-${theme}-${width}.png`);

    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
    await waitForRoutePaint(page);
    await expect(page.locator("[data-link-requests]")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
    const pending = requestRow(page, "fixture-e2e/pl-b");
    const before = query("select count(*) from public.link_audit");
    await pending.locator("[data-action=approve]").click();
    await expect(pending.locator("[data-row-message]")).toHaveText(COPY.projectLinked, { timeout: 20_000 });
    await expect(pending).toHaveAttribute("data-request-state", "pending");
    expect(query("select count(*) from public.link_audit")).toBe(before);
    await settle(page);
    await noteShift(page, "project-linked");
    await capture(page, `${SCREENS}/t18-project-linked-${theme}-${width}.png`);
  }

  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      const { context, page } = await signedPage(browser, {
        viewport,
        colorScheme: theme,
        reducedMotion: "no-preference",
      });
      try {
        await captureFlow(page, theme, viewport.width);
      } finally {
        await context.close();
      }
    }

    const reduced = await signedPage(browser, {
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    try {
      await openOverview(reduced.page);
      await expect(reduced.page.locator('[data-project="LINK-FLOW"]:visible').first()).toBeVisible({
        timeout: 20_000,
      });
      await settle(reduced.page);
      await noteShift(reduced.page, "map");
      await expectMapFits(reduced.page);
      await capture(reduced.page, `${SCREENS}/t18-map-reduced-${theme}-1280.png`);
    } finally {
      await reduced.context.close();
    }
  }

  const film = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1280, height: 900 },
    reducedMotion: "no-preference",
  });
  await armShift(film);
  await film.addCookies(ownerCookies);
  const filmPage = await film.newPage();
  await filmPage.addInitScript(() => {
    const hold = () => {
      for (const animation of document.getAnimations()) {
        if (animation.playState === "running") animation.pause();
      }
      requestAnimationFrame(hold);
    };
    requestAnimationFrame(hold);
  });
  try {
    await filmPage.goto("/", { waitUntil: "load" });
    await expect(filmPage.locator('[data-map-card][data-project="LINK-FLOW"]')).toBeVisible({ timeout: 20_000 });
    for (const time of FILM_TIMES) {
      await seek(filmPage, time);
      await capture(filmPage, `${SCREENS}/t18-map-dark-1280-film-${time}.png`, "allow");
    }
    await expectMapFits(filmPage);
    await noteShift(filmPage, "map");
  } finally {
    await film.close();
  }

  writeFileSync(`${SCREENS}/t18-layout-shift.json`, `${JSON.stringify(shifts, null, 2)}\n`);
  const pngs = readdirSync(SCREENS).filter((name) => name.startsWith("t18-") && name.endsWith(".png"));
  expect(pngs).toHaveLength(27);
  expect(shiftFailures, JSON.stringify(shiftFailures)).toEqual([]);
  expect(Math.max(...Object.values(shifts))).toBe(0);
});
