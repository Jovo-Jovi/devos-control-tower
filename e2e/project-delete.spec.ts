import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createOwner, removeOwner, sessionCookies, type SessionCookie } from "./support/owner";
import { query } from "./support/portfolio";

const OWNERS = [{ githubId: "700081", login: "fixture-delete-owner" }] as const;

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
  deleted: "Project DEL-HAND deleted.",
  linked:
    "This project came from a link request. Delete it in the Link requests panel on the overview.",
} as const;

type CaptureState = "hand" | "confirm" | "typed" | "refused" | "linked" | "deleted";
type ShiftEntry = { value: number; sources: string[] };
type ShiftBucket = { value: number; entries: ShiftEntry[] };
type HistoryIds = { projectId: string; runId: string; eventId: string };

test.describe.configure({ timeout: 900_000 });

let ownerCookies: SessionCookie[] = [];
const recordedProjectIds: string[] = [];

test.beforeAll(async () => {
  mkdirSync(SCREENS, { recursive: true });
  await removeOwner(OWNERS);
  cleanFixtures();
  const projectCount = Number(query("select count(*) from public.projects"));
  expect(projectCount, `projects before set-up: ${projectCount}`).toBeLessThanOrEqual(6);
  await createOwner({ githubId: "700081", login: "fixture-delete-owner", allowListed: true });
  ownerCookies = await sessionCookies("fixture-delete-owner@example.test");
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

function rememberProject(id: string): string {
  recordedProjectIds.push(id);
  return id;
}

function cleanFixtures(): void {
  const live = query(
    "select coalesce(string_agg(id::text, ','), '') from public.projects where repo like 'fixture-e2e/del-%'",
  );
  const ids = new Set(recordedProjectIds);
  for (const id of live.split(",")) {
    if (id) ids.add(assertUuid(id, "fixture project"));
  }
  if (ids.size > 0) {
    const list = [...ids].map((id) => `'${id}'`).join(", ");
    query(`delete from public.project_audit where project_id in (${list})`);
  }
  query("delete from public.link_requests where repository like 'fixture-e2e/del-%'");
  query("delete from public.projects where repo like 'fixture-e2e/del-%'");
}

function insertProject(key: string, repo: string, ownerId: string): string {
  query(`insert into public.projects (key, repo, owner_github_id) values ('${key}', '${repo}', '${ownerId}')`);
  return rememberProject(assertUuid(query(`select id from public.projects where key = '${key}'`), key));
}

function insertHistory(key: string, repo: string): HistoryIds {
  const projectId = insertProject(key, repo, "1401");
  query(
    `insert into public.runs (id, project_id, run_key, source) values (pg_catalog.gen_random_uuid(), '${projectId}', 'gha-del-1', 'ci')`,
  );
  const runId = assertUuid(
    query(`select id from public.runs where project_id = '${projectId}' and run_key = 'gha-del-1'`),
    "run",
  );
  query(
    `insert into public.events (project_id, run_id, seq, v, phase, task, step, status, at, evidence, origin, source, body_hash) values ('${projectId}', '${runId}', 1, 1, 'P04', 'T20', 'build', 'pass', '2026-10-31T00:00:00Z', null, 'reported', 'ci', '\\x01'::bytea)`,
  );
  const eventId = query(`select id::text from public.events where run_id = '${runId}'`);
  query(
    `insert into public.event_usage (event_id, agent, tool, model, account_alias, source) values (${eventId}, 'builder', 'cursor-agent', 'grok-4.7-high', 'cursor-1', 'unavailable')`,
  );
  query(
    `insert into public.observations (project_id, sha, kind, state, at, payload_ref) values ('${projectId}', '0123456789abcdef0123456789abcdef01234567', 'status', 'success', '2026-10-31T00:00:00Z', 'del-hand-obs')`,
  );
  return { projectId, runId, eventId };
}

function insertDecided(
  repository: string,
  ownerId: string,
  key: string,
  state: "approved" | "declined",
  projectId: string,
): void {
  query(
    `insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version, state, project_id, first_requested_at, last_requested_at, decided_at) values ('${repository}', '${ownerId}', '${key}', '${ENGINE}', '${CONTRACT}', '${state}', '${projectId}', '2026-10-26T00:00:00Z', '2026-10-26T03:00:00Z', now())`,
  );
}

function projectRow(page: Page, key: string) {
  return page.locator("article[data-link-request]").filter({
    has: page.locator("bdi", { hasText: new RegExp(`^${key}$`) }),
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
        const detailed = shift as PerformanceEntry & {
          value?: number;
          sources?: { node?: Node | null; previousRect?: DOMRectReadOnly; currentRect?: DOMRectReadOnly }[];
        };
        bucket.value += shift.value;
        bucket.entries.push({
          value: shift.value,
          sources: (detailed.sources ?? []).map((source) => {
            const node = source.node;
            const element =
              node && node.nodeType === Node.ELEMENT_NODE
                ? (node as Element)
                : node?.parentElement ?? null;
            const name = element
              ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className ? `.${String(element.className).split(" ")[0]}` : ""} "${(element.textContent ?? "").slice(0, 40)}"`
              : node
                ? node.nodeName
                : "none";
            const previous = source.previousRect;
            const current = source.currentRect;
            const box = (rect: DOMRectReadOnly | undefined) =>
              rect ? `${rect.x},${rect.y},${rect.width}x${rect.height}` : "?";
            return `${name} ${box(previous)} -> ${box(current)}`;
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

async function seek(page: Page, time: number) {
  await page.evaluate((ms) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = ms;
    }
  }, time);
}

async function expectFits(page: Page, width: number) {
  if (width !== 390) return;
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

async function projectTotal(page: Page): Promise<number> {
  const total = page.locator('section[aria-label="Projects"] dl').first().locator("dd");
  await expect(total).toHaveText(/^[0-9,]+$/);
  return Number((await total.innerText()).replaceAll(",", ""));
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
    if (name.startsWith("t20-")) unlinkSync(`${SCREENS}/${name}`);
  }
}

test("Delete with its key", async ({ browser }) => {
  const history = insertHistory("DEL-HAND", "fixture-e2e/del-hand");
  const auditBefore = Number(query("select count(*) from public.project_audit"));
  const { context, page } = await signedPage(browser);
  try {
    await openOverview(page);
    await expect(page.locator('[data-map-card][data-project="DEL-HAND"]')).toBeVisible({ timeout: 20_000 });
    const total = await projectTotal(page);

    await page.goto("/projects/DEL-HAND", { waitUntil: "load" });
    await expect(page.locator("[data-delete-project]")).toBeVisible();
    await page.locator('[data-action="delete-open"]').click();
    const field = page.locator('input[name="confirmation"]');
    const confirm = page.locator('[data-action="delete-confirm"]');
    await expect(page.locator("[data-delete-project-confirm]")).toBeVisible();
    await expect(field).toBeFocused();
    await expect(confirm).toBeDisabled();
    await field.fill("DEL-HAN");
    await expect(confirm).toBeDisabled();
    await field.fill("DEL-HAND");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL(/\/\?deleted=DEL-HAND$/, { timeout: 20_000 });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
    await expect(page.getByText(COPY.deleted)).toBeVisible({ timeout: 20_000 });

    expect(query(`select count(*) from public.projects where id = '${history.projectId}'`)).toBe("0");
    expect(query(`select count(*) from public.runs where id = '${history.runId}'`)).toBe("0");
    expect(query(`select count(*) from public.events where id = ${history.eventId}`)).toBe("0");
    expect(query(`select count(*) from public.event_usage where event_id = ${history.eventId}`)).toBe("0");
    expect(query(`select count(*) from public.observations where project_id = '${history.projectId}'`)).toBe("0");
    expect(Number(query("select count(*) from public.project_audit"))).toBe(auditBefore + 1);
    expect(
      query(
        `select count(*) from public.project_audit where project_id = '${history.projectId}' and action = 'deleted'`,
      ),
    ).toBe("1");

    await expect(page.locator('[data-map-card][data-project="DEL-HAND"]')).toHaveCount(0);
    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(page.locator('[data-list-card][data-project="DEL-HAND"]')).toHaveCount(0);
    expect(await projectTotal(page)).toBe(total - 1);

    const api = await page.request.get("/api/projects");
    expect(api.ok()).toBe(true);
    const body = (await api.json()) as { projects: { key: string }[] };
    expect(body.projects.some((project) => project.key === "DEL-HAND")).toBe(false);

    const missing = await page.goto("/projects/DEL-HAND", { waitUntil: "load" });
    expect(missing?.status()).toBe(404);
  } finally {
    await context.close();
  }
});

test("Keyboard", async ({ browser }) => {
  insertProject("DEL-KEYS", "fixture-e2e/del-keys", "1401");
  const auditBefore = query("select count(*) from public.project_audit");
  const { context, page } = await signedPage(browser);
  try {
    await page.goto("/projects/DEL-KEYS", { waitUntil: "load" });
    const open = page.locator('[data-action="delete-open"]');
    await expect(open).toBeVisible();
    let focused = false;
    for (let press = 0; press < 60; press += 1) {
      if (await open.evaluate((node) => node === document.activeElement)) {
        focused = true;
        break;
      }
      await page.keyboard.press("Tab");
    }
    expect(focused).toBe(true);
    await page.keyboard.press("Enter");
    const field = page.locator('input[name="confirmation"]');
    await expect(field).toBeFocused();
    await field.pressSequentially("del-keys");
    await expect(page.locator('[data-action="delete-confirm"]')).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-delete-project-confirm]")).toHaveCount(0);
    await expect(open).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-delete-project-confirm]")).toBeVisible();
    await page.locator('[data-action="delete-cancel"]').click();
    await expect(page.locator("[data-delete-project-confirm]")).toHaveCount(0);
    await expect(open).toBeFocused();
    expect(query("select count(*) from public.projects where key = 'DEL-KEYS'")).toBe("1");
    expect(query("select count(*) from public.project_audit")).toBe(auditBefore);
  } finally {
    await context.close();
  }
});

test("Linked pages keep the panel's path", async ({ browser }) => {
  const linked = insertProject("DEL-LINKED", "fixture-e2e/del-linked", "1401");
  const disconnected = insertProject("DEL-DISC", "fixture-e2e/del-disc", "1401");
  insertProject("DEL-OPEN", "fixture-e2e/del-open", "1401");
  insertDecided("fixture-e2e/del-linked", "1402", "DEL-LINKED", "approved", linked);
  insertDecided("fixture-e2e/del-disc", "1402", "DEL-DISC", "declined", disconnected);
  const { context, page } = await signedPage(browser);
  try {
    await page.goto("/projects/DEL-LINKED", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "DEL-LINKED", level: 1 })).toBeVisible();
    await expect(page.locator("[data-delete-project]")).toHaveCount(0);
    await page.goto("/projects/DEL-DISC", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "DEL-DISC", level: 1 })).toBeVisible();
    await expect(page.locator("[data-delete-project]")).toHaveCount(0);
    await page.goto("/projects/DEL-OPEN", { waitUntil: "load" });
    await expect(page.locator("[data-delete-project]")).toBeVisible();
    await openOverview(page);
    await expect(projectRow(page, "DEL-LINKED").locator('[data-action="delete"]')).toBeVisible();
  } finally {
    await context.close();
  }
});

test("Linked meanwhile", async ({ browser }) => {
  const projectId = insertProject("DEL-RACE", "fixture-e2e/del-race", "1401");
  const auditBefore = query("select count(*) from public.project_audit");
  const { context, page } = await signedPage(browser);
  try {
    await page.goto("/projects/DEL-RACE", { waitUntil: "load" });
    await page.locator('[data-action="delete-open"]').click();
    await page.locator('input[name="confirmation"]').fill("DEL-RACE");
    await expect(page.locator('[data-action="delete-confirm"]')).toBeEnabled();
    insertDecided("fixture-e2e/del-race", "1402", "DEL-RACE", "approved", projectId);
    await page.locator('[data-action="delete-confirm"]').click();
    await expect(page.locator("[data-delete-message]")).toHaveText(COPY.linked, { timeout: 20_000 });
    expect(query("select count(*) from public.projects where key = 'DEL-RACE'")).toBe("1");
    expect(
      query(
        `select state || ' ' || project_id::text from public.link_requests where repository = 'fixture-e2e/del-race'`,
      ),
    ).toBe(`approved ${projectId}`);
    expect(query("select count(*) from public.project_audit")).toBe(auditBefore);
  } finally {
    await context.close();
  }
});

test("Captures", async ({ browser }) => {
  clearCaptures();
  insertProject("DEL-CAP", "fixture-e2e/del-cap", "1401");
  insertProject("DEL-HOLD", "fixture-e2e/del-hold", "1401");
  const linkedId = query("select coalesce(id::text, '') from public.projects where key = 'DEL-LINKED'");
  if (!linkedId) {
    const created = insertProject("DEL-LINKED", "fixture-e2e/del-linked", "1401");
    insertDecided("fixture-e2e/del-linked", "1402", "DEL-LINKED", "approved", created);
  }

  const shifts: Record<CaptureState, number> = {
    hand: 0,
    confirm: 0,
    typed: 0,
    refused: 0,
    linked: 0,
    deleted: 0,
  };
  const shiftFailures: { state: string; value: number; entries: ShiftEntry[] }[] = [];

  async function noteShift(page: Page, state: CaptureState) {
    const bucket = await consumeShift(page);
    if (bucket.value > shifts[state]) shifts[state] = bucket.value;
    if (bucket.value > 0) shiftFailures.push({ state, value: bucket.value, entries: bucket.entries });
  }

  async function captureHand(page: Page, theme: (typeof THEMES)[number], width: number) {
    await page.goto("/projects/DEL-CAP", { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
    await expect(page.locator('[data-action="delete-open"]')).toBeVisible();
    await settle(page);
    await noteShift(page, "hand");
    await expectFits(page, width);
    await capture(page, `${SCREENS}/t20-hand-${theme}-${width}.png`);

    await page.locator('[data-action="delete-open"]').click();
    const field = page.locator('input[name="confirmation"]');
    await expect(page.locator("[data-delete-project-confirm]")).toBeVisible();
    await expect(field).toHaveValue("");
    await settle(page);
    await noteShift(page, "confirm");
    await expectFits(page, width);
    await capture(page, `${SCREENS}/t20-confirm-${theme}-${width}.png`);

    await field.fill("DEL-CAP");
    await expect(page.locator('[data-action="delete-confirm"]')).toBeEnabled();
    await settle(page);
    await noteShift(page, "typed");
    await expectFits(page, width);
    await capture(page, `${SCREENS}/t20-typed-${theme}-${width}.png`);
  }

  async function captureRefused(page: Page, theme: (typeof THEMES)[number], width: number) {
    query("delete from public.link_requests where repository = 'fixture-e2e/del-hold'");
    await page.goto("/projects/DEL-HOLD", { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
    await page.locator('[data-action="delete-open"]').click();
    await page.locator('input[name="confirmation"]').fill("DEL-HOLD");
    const projectId = assertUuid(query("select id from public.projects where key = 'DEL-HOLD'"), "DEL-HOLD");
    insertDecided("fixture-e2e/del-hold", "1402", "DEL-HOLD", "approved", projectId);
    await page.locator('[data-action="delete-confirm"]').click();
    await expect(page.locator("[data-delete-message]")).toHaveText(COPY.linked, { timeout: 20_000 });
    await settle(page);
    await noteShift(page, "refused");
    await expectFits(page, width);
    await capture(page, `${SCREENS}/t20-refused-${theme}-${width}.png`);
  }

  async function captureLinked(page: Page, theme: (typeof THEMES)[number], width: number) {
    await page.goto("/projects/DEL-LINKED", { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
    await expect(page.getByRole("heading", { name: "DEL-LINKED", level: 1 })).toBeVisible();
    await expect(page.locator("[data-delete-project]")).toHaveCount(0);
    await settle(page);
    await noteShift(page, "linked");
    await expectFits(page, width);
    await capture(page, `${SCREENS}/t20-linked-${theme}-${width}.png`);
  }

  async function captureDeleted(page: Page, theme: (typeof THEMES)[number], width: number) {
    insertProject("DEL-GONE", "fixture-e2e/del-gone", "1401");
    await page.goto("/projects/DEL-GONE", { waitUntil: "load" });
    await page.locator('[data-action="delete-open"]').click();
    await page.locator('input[name="confirmation"]').fill("DEL-GONE");
    await page.locator('[data-action="delete-confirm"]').click();
    await expect(page).toHaveURL(/\/\?deleted=DEL-GONE$/, { timeout: 20_000 });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
    const toast = page.getByText("Project DEL-GONE deleted.");
    await expect(toast).toBeVisible({ timeout: 20_000 });
    await settle(page);
    await noteShift(page, "deleted");
    await expectFits(page, width);
    await toast.hover();
    await capture(page, `${SCREENS}/t20-deleted-${theme}-${width}.png`);
  }

  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      const hand = await signedPage(browser, {
        viewport,
        colorScheme: theme,
        reducedMotion: "no-preference",
      });
      try {
        await captureHand(hand.page, theme, viewport.width);
      } finally {
        await hand.context.close();
      }

      const refused = await signedPage(browser, {
        viewport,
        colorScheme: theme,
        reducedMotion: "no-preference",
      });
      try {
        await captureRefused(refused.page, theme, viewport.width);
      } finally {
        await refused.context.close();
      }

      const linked = await signedPage(browser, {
        viewport,
        colorScheme: theme,
        reducedMotion: "no-preference",
      });
      try {
        await captureLinked(linked.page, theme, viewport.width);
      } finally {
        await linked.context.close();
      }

    }

    const reduced = await signedPage(browser, {
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    try {
      await reduced.page.goto("/projects/DEL-CAP", { waitUntil: "load" });
      await reduced.page.locator('[data-action="delete-open"]').click();
      await expect(reduced.page.locator("[data-delete-project-confirm]")).toBeVisible();
      await expect(reduced.page.locator('input[name="confirmation"]')).toHaveValue("");
      await settle(reduced.page);
      await noteShift(reduced.page, "confirm");
      await capture(reduced.page, `${SCREENS}/t20-confirm-reduced-${theme}-1280.png`);
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
    await filmPage.goto("/projects/DEL-CAP", { waitUntil: "load" });
    await expect(filmPage.locator('[data-action="delete-open"]')).toBeVisible();
    await filmPage.locator('[data-action="delete-open"]').click();
    await expect(filmPage.locator("[data-delete-project-confirm]")).toBeAttached();
    for (const time of FILM_TIMES) {
      await seek(filmPage, time);
      await capture(filmPage, `${SCREENS}/t20-confirm-dark-1280-film-${time}.png`, "allow");
    }
    await noteShift(filmPage, "confirm");
  } finally {
    await film.close();
  }

  cleanFixtures();
  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      const deleted = await signedPage(browser, {
        viewport,
        colorScheme: theme,
        reducedMotion: "no-preference",
      });
      try {
        await captureDeleted(deleted.page, theme, viewport.width);
      } finally {
        await deleted.context.close();
      }
    }
  }

  writeFileSync(`${SCREENS}/t20-layout-shift.json`, `${JSON.stringify(shifts, null, 2)}\n`);
  const pngs = readdirSync(SCREENS).filter((name) => name.startsWith("t20-") && name.endsWith(".png"));
  expect(pngs).toHaveLength(31);
  expect(shiftFailures, JSON.stringify(shiftFailures)).toEqual([]);
  expect(Math.max(...Object.values(shifts))).toBe(0);
});
