import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createOwner, removeOwner, sessionCookies, type SessionCookie } from "./support/owner";
import { emptyPortfolio, query } from "./support/portfolio";

const OWNERS = [
  { githubId: "700061", login: "fixture-link-owner" },
  { githubId: "700062", login: "fixture-link-other" },
] as const;

const SCREENS = ".devos/screens";
const ENGINE = "0.2.9";
const CONTRACT = "0-draft-3";
const NOW = new Date("2026-10-26T12:00:00.000Z");
const STATES = ["empty", "pending-only", "groups", "after-approve", "repo-taken", "delete-confirm", "error"] as const;
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;
const FILM_TIMES = [0, 80, 160, 320, 640] as const;
const THEME_TIMES = [0, 450, 900, 1350, 1800] as const;

const COPY = {
  lead: "DEV_OS projects whose developer chose to link them ask here. A project's step events are stored only after you approve it.",
  empty: "No link request yet.",
  unavailable: "The link requests could not be read. Nothing is shown until they can.",
  repoTaken: "Another owner already has this repository. The request stays pending.",
  failed: "The change could not be saved. Nothing was changed.",
  declinedDone: "Declined. Its next request is refused.",
  disconnectedDone: "Disconnected. Its history stays for the record.",
  deleted: "Deleted.",
  exported: "Export downloaded. No copy is kept on the server.",
  deleteProject: "Delete this request and project LINK-LINKED, with every run and step event? This cannot be undone.",
} as const;

const ACTION_LABEL = {
  approve: "Approve",
  decline: "Decline",
  export: "Export",
  delete: "Delete",
} as const;

type CaptureState = (typeof STATES)[number];
type RowAction = keyof typeof ACTION_LABEL;

test.describe.configure({ timeout: 120_000 });

let ownerCookies: SessionCookie[] = [];
let otherCookies: SessionCookie[] = [];

test.beforeAll(async () => {
  mkdirSync(SCREENS, { recursive: true });
  await removeOwner(OWNERS);
  grantLinkSurface();
  wipeLinkRows();
  await createOwner({ githubId: "700061", login: "fixture-link-owner", allowListed: true });
  await createOwner({ githubId: "700062", login: "fixture-link-other", allowListed: false });
  ownerCookies = await sessionCookies("fixture-link-owner@example.test");
  otherCookies = await sessionCookies("fixture-link-other@example.test");
});

test.afterAll(async () => {
  grantLinkSurface();
  restoreSeed();
  await removeOwner(OWNERS);
});

test.beforeEach(() => {
  grantLinkSurface();
  insertCanonical();
});

test.afterEach(() => {
  grantLinkSurface();
});

function wipeLinkRows(): void {
  query("delete from public.link_requests");
  query("delete from public.projects where repo like 'fixture-link/%'");
}

function uuid(value: string, label: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    throw new Error(`${label} was not a uuid`);
  }
  return value;
}

function requestId(repository: string): string {
  return uuid(query(`select id from public.link_requests where repository = '${repository}'`), repository);
}

function projectId(key: string): string {
  return uuid(query(`select id from public.projects where key = '${key}'`), key);
}

function grantLinkSurface(): void {
  query("grant execute on function public.approve_link_request(uuid) to service_role");
  query("grant select on table public.link_requests to authenticated");
}

function insertPending(values: string): void {
  query(
    `insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version, first_requested_at, last_requested_at) values ${values}`,
  );
}

function insertCanonical(): void {
  wipeLinkRows();
  query(
    "insert into public.projects (key, repo, owner_github_id) values ('LINK-LINKED', 'fixture-link/linked', '900004'), ('LINK-TAKEN-OWNER', 'fixture-link/taken', '900099')",
  );
  const linked = projectId("LINK-LINKED");
  insertPending(
    `('fixture-link/alpha', '900001', 'LINK-ALPHA', '${ENGINE}', '${CONTRACT}', '2026-10-26T00:00:00Z', '2026-10-26T03:00:00Z'), ('fixture-link/bravo', '900002', 'LINK-BRAVO', '${ENGINE}', '${CONTRACT}', '2026-10-26T00:00:00Z', '2026-10-26T02:00:00Z'), ('fixture-link/taken', '900003', 'LINK-TAKEN', '${ENGINE}', '${CONTRACT}', '2026-10-26T00:00:00Z', '2026-10-26T01:00:00Z')`,
  );
  query(
    `insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version, state, project_id, first_requested_at, last_requested_at, decided_at) values ('fixture-link/linked', '900004', 'LINK-LINKED', '${ENGINE}', '${CONTRACT}', 'approved', '${linked}', '2026-10-24T00:00:00Z', '2026-10-25T00:00:00Z', '2026-10-25T12:00:00Z')`,
  );
  query(
    `insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version, state, first_requested_at, last_requested_at, decided_at) values ('fixture-link/declined', '900005', 'LINK-DECLINED', '${ENGINE}', '${CONTRACT}', 'declined', '2026-10-18T00:00:00Z', '2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z')`,
  );
}

function insertPendingOnly(): void {
  wipeLinkRows();
  insertPending(
    `('fixture-link/alpha', '900001', 'LINK-ALPHA', '${ENGINE}', '${CONTRACT}', '2026-10-26T00:00:00Z', '2026-10-26T03:00:00Z'), ('fixture-link/bravo', '900002', 'LINK-BRAVO', '${ENGINE}', '${CONTRACT}', '2026-10-26T00:00:00Z', '2026-10-26T02:00:00Z'), ('fixture-link/taken', '900003', 'LINK-TAKEN', '${ENGINE}', '${CONTRACT}', '2026-10-26T00:00:00Z', '2026-10-26T01:00:00Z')`,
  );
}

function insertAfterApprove(): void {
  wipeLinkRows();
  query(
    "insert into public.projects (key, repo, owner_github_id) values ('LINK-ALPHA', 'fixture-link/alpha', '900001'), ('LINK-LINKED', 'fixture-link/linked', '900004'), ('LINK-TAKEN-OWNER', 'fixture-link/taken', '900099')",
  );
  const alpha = projectId("LINK-ALPHA");
  const linked = projectId("LINK-LINKED");
  insertPending(
    `('fixture-link/bravo', '900002', 'LINK-BRAVO', '${ENGINE}', '${CONTRACT}', '2026-10-26T00:00:00Z', '2026-10-26T02:00:00Z'), ('fixture-link/taken', '900003', 'LINK-TAKEN', '${ENGINE}', '${CONTRACT}', '2026-10-26T00:00:00Z', '2026-10-26T01:00:00Z')`,
  );
  query(
    `insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version, state, project_id, first_requested_at, last_requested_at, decided_at) values ('fixture-link/alpha', '900001', 'LINK-ALPHA', '${ENGINE}', '${CONTRACT}', 'approved', '${alpha}', '2026-10-26T00:00:00Z', '2026-10-26T03:00:00Z', '2026-10-26T04:00:00Z'), ('fixture-link/linked', '900004', 'LINK-LINKED', '${ENGINE}', '${CONTRACT}', 'approved', '${linked}', '2026-10-24T00:00:00Z', '2026-10-25T00:00:00Z', '2026-10-25T12:00:00Z')`,
  );
  query(
    `insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version, state, first_requested_at, last_requested_at, decided_at) values ('fixture-link/declined', '900005', 'LINK-DECLINED', '${ENGINE}', '${CONTRACT}', 'declined', '2026-10-18T00:00:00Z', '2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z')`,
  );
}

function restoreSeed(): void {
  wipeLinkRows();
  query(
    "insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version) values ('fixture-dev/demo-shop', '0', 'DEMO-SHOP', '0.2.9', '0-draft-3')",
  );
  query(
    "insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version, state, decided_at) values ('fixture-dev/declined-app', '0', 'DECLINED-APP', '0.2.9', '0-draft-3', 'declined', '2026-10-20T00:00:00Z')",
  );
}

function attachHistory(key: string): string {
  const id = projectId(key);
  query(
    `insert into public.runs (id, project_id, run_key, source) values (gen_random_uuid(), '${id}', 'fixture-link-run', 'ci')`,
  );
  const run = uuid(
    query(`select id from public.runs where project_id = '${id}' and run_key = 'fixture-link-run'`),
    "run",
  );
  query(
    `insert into public.events (project_id, run_id, seq, v, step, status, at, origin, source, body_hash) values ('${id}', '${run}', 1, 1, 'build', 'pass', '2026-10-25T12:00:00Z', 'reported', 'ci', decode('00', 'hex'))`,
  );
  return id;
}

function prepare(state: CaptureState): void {
  grantLinkSurface();
  if (state === "empty") {
    wipeLinkRows();
    return;
  }
  if (state === "pending-only") {
    insertPendingOnly();
    return;
  }
  if (state === "after-approve") {
    insertAfterApprove();
    return;
  }
  insertCanonical();
  if (state === "error") query("revoke select on table public.link_requests from authenticated");
}

function requestRow(page: Page, repository: string): Locator {
  return page.locator("article[data-link-request]").filter({
    has: page.locator("bdi", { hasText: new RegExp(`^${repository.replaceAll("/", "\\/")}$`) }),
  });
}

async function openGroup(page: Page, name: "linked" | "declined") {
  const toggle = page.locator(`[data-group=${name}] [data-group-toggle]`);
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
}

async function openDecided(page: Page, name: "linked" | "declined", repository: string) {
  await openGroup(page, name);
  const row = requestRow(page, repository);
  const line = row.locator("[data-request-line]");
  if ((await line.getAttribute("aria-expanded")) === "false") await line.click();
  return row;
}

function fact(row: Locator, label: string): Locator {
  return row.locator(`xpath=.//dt[normalize-space()="${label}"]/following-sibling::dd[1]`);
}

async function expectFact(row: Locator, label: string, value: string) {
  await expect(fact(row, label)).toHaveText(value);
}

async function expectTime(row: Locator, label: string, iso: string) {
  const when = fact(row, label).locator("time");
  await expect(when).toHaveAttribute("datetime", iso);
  await expect(when).not.toHaveText("");
}

async function expectActions(row: Locator, actions: readonly RowAction[]) {
  await expect(row.locator("[data-action]")).toHaveCount(actions.length);
  for (const action of actions) {
    await expect(row.getByRole("button", { name: ACTION_LABEL[action], exact: true })).toBeVisible();
  }
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

async function readShift(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __layoutShift: { value: number } }).__layoutShift.value);
}

async function shiftDetail(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify((window as unknown as { __layoutShift: { value: number; entries: unknown[] } }).__layoutShift),
  );
}

async function settle(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getTiming();
      if (timing && timing.iterations !== Infinity && typeof timing.duration === "number") animation.finish();
    }
  });
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

async function expectConfirmClear(row: Locator) {
  const decided = (await row.getAttribute("data-request-state")) !== "pending";
  const dl = await row.locator("dl").boundingBox();
  const message = await row.locator(decided ? "[data-request-details] > p" : ":scope > p").boundingBox();
  const confirm = await row.locator("[data-delete-confirm]").boundingBox();
  const box = await row.boundingBox();
  expect(dl, "definition list box").not.toBeNull();
  expect(message, "row message box").not.toBeNull();
  expect(confirm, "confirmation box").not.toBeNull();
  expect(box, "row box").not.toBeNull();
  if (!dl || !message || !confirm || !box) return;
  const dlBottom = dl.y + dl.height;
  const messageBottom = message.y + message.height;
  const confirmBottom = confirm.y + confirm.height;
  const rowBottom = box.y + box.height;
  expect(confirm.y, `confirmation top ${confirm.y} covers the fields ending at ${dlBottom}`).toBeGreaterThanOrEqual(
    dlBottom,
  );
  expect(
    confirm.y,
    `confirmation top ${confirm.y} covers the row message ending at ${messageBottom}`,
  ).toBeGreaterThanOrEqual(messageBottom);
  expect(confirmBottom, `confirmation bottom ${confirmBottom} leaves the row ending at ${rowBottom}`).toBeLessThanOrEqual(
    rowBottom,
  );
}

async function expectNoScroll(page: Page) {
  const fit = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(fit).toBe(true);
}

async function capture(page: Page, path: string) {
  const data = await page.screenshot({ path, fullPage: true, animations: "allow" });
  expect(data.length).toBeGreaterThan(20_000);
}

async function openHome(page: Page) {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/api/projects", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyPortfolio(NOW)),
    }),
  );
  await page.goto("/", { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-scene-ready"));
  await expect(page.getByText("No project yet. Register the first one.")).toBeVisible();
}

async function openOwner(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  await openHome(page);
  await expect(page.locator("[data-link-requests]")).toHaveAttribute("data-state", "ready");
  return { context, page };
}

async function reveal(page: Page, state: CaptureState) {
  const panel = page.locator("[data-link-requests]");
  if (state === "empty") {
    await expect(panel).toHaveAttribute("data-state", "empty");
    await expect(page.getByText(COPY.empty)).toBeVisible();
    await expect(page.locator("[data-group]")).toHaveCount(0);
    return;
  }
  if (state === "error") {
    await expect(panel).toHaveAttribute("data-state", "unavailable");
    await expect(page.getByText(COPY.unavailable)).toBeVisible();
    await expect(page.locator("[data-group]")).toHaveCount(0);
    return;
  }
  await expect(panel).toHaveAttribute("data-state", "ready");
  if (state === "pending-only") {
    await expect(page.locator("[data-group=pending] h3")).toHaveText("Pending 3");
    await openGroup(page, "linked");
    await openGroup(page, "declined");
    await expect(page.locator("[data-group=linked]")).toContainText("None");
    await expect(page.locator("[data-group=declined]")).toContainText("None");
    return;
  }
  if (state === "groups") {
    await expect(page.locator("[data-group=pending] h3")).toHaveText("Pending 3");
    await expect(page.locator("[data-group=linked] h3")).toHaveText("Linked by request 1");
    await expect(page.locator("[data-group=declined] h3")).toHaveText("Declined 1");
    return;
  }
  if (state === "after-approve") {
    await openGroup(page, "linked");
    const row = requestRow(page, "fixture-link/alpha");
    await expect(row).toHaveAttribute("data-request-state", "approved");
    await expect(page.locator("[data-group=linked]").locator("bdi", { hasText: "LINK-ALPHA" })).toBeVisible();
    return;
  }
  if (state === "repo-taken") {
    const row = requestRow(page, "fixture-link/taken");
    await row.locator("[data-action=approve]").click();
    await expect(row.locator("[data-row-message]")).toHaveText(COPY.repoTaken, { timeout: 20_000 });
    await expect(row).toHaveAttribute("data-request-state", "pending");
    return;
  }
  const row = await openDecided(page, "linked", "fixture-link/linked");
  await row.locator("[data-action=delete]").click();
  await expect(row.getByRole("button", { name: "Delete for good", exact: true })).toBeVisible();
  await expect(row).toContainText(COPY.deleteProject);
  await expectConfirmClear(row);
}

function clearCaptures() {
  mkdirSync(SCREENS, { recursive: true });
  for (const name of readdirSync(SCREENS)) {
    if (name.startsWith("t16-")) unlinkSync(`${SCREENS}/${name}`);
  }
}

async function filmApprove(browser: Browser, csp: string[]) {
  insertCanonical();
  const context = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1280, height: 900 },
    reducedMotion: "no-preference",
  });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  try {
    await openHome(page);
    await settle(page);
    await armHoldNew(page);
    const row = requestRow(page, "fixture-link/alpha");
    await row.locator("[data-action=approve]").click();
    const toast = page.getByText("Linked as LINK-ALPHA.");
    await expect(toast).toBeVisible({ timeout: 20_000 });
    await openGroup(page, "linked");
    await expect(row).toHaveAttribute("data-request-state", "approved");
    await expect(
      page.locator(`[data-group=linked] article[data-link-request="${requestId("fixture-link/alpha")}"]`),
    ).toBeVisible();
    await expect(toast).toBeInViewport();
    await toast.hover();
    for (const time of FILM_TIMES) {
      await seekNew(page, time);
      await capture(page, `${SCREENS}/t16-approve-dark-1280-film-${String(time).padStart(3, "0")}.png`);
    }
    await expect(toast).toBeVisible();
  } finally {
    await context.close();
  }
}

async function filmTheme(browser: Browser, csp: string[]) {
  insertCanonical();
  const context = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 1280, height: 900 },
    reducedMotion: "no-preference",
  });
  await context.addCookies(ownerCookies);
  const page = await context.newPage();
  watchCsp(page, csp);
  try {
    await openHome(page);
    await reveal(page, "groups");
    await settle(page);
    await armHoldNew(page);
    await page.locator('[data-theme-option="dark"]').click();
    for (const time of THEME_TIMES) {
      await seekNew(page, time);
      await capture(page, `${SCREENS}/t16-theme-to-dark-1280-${String(time).padStart(4, "0")}.png`);
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  } finally {
    await context.close();
  }
}

test("Groups and fields", async ({ browser }) => {
  const outsider = await browser.newContext();
  await outsider.addCookies(otherCookies);
  const outsiderPage = await outsider.newPage();
  await outsiderPage.goto("/", { waitUntil: "load" });
  await expect(outsiderPage).toHaveURL(/\/sign-in\?reason=not_owner/);
  await expect(outsiderPage.locator("[data-link-requests]")).toHaveCount(0);
  await outsider.close();

  const { context, page } = await openOwner(browser);
  try {
    await expect(page.getByRole("heading", { level: 2, name: "Link requests" })).toBeVisible();
    await expect(page.getByText(COPY.lead)).toBeVisible();
    const groups = page.locator("[data-group]");
    await expect(groups).toHaveCount(3);
    await expect(groups.nth(0)).toHaveAttribute("data-group", "pending");
    await expect(groups.nth(1)).toHaveAttribute("data-group", "linked");
    await expect(groups.nth(2)).toHaveAttribute("data-group", "declined");
    await expect(groups.nth(0).locator("h3")).toHaveText("Pending 3");
    await expect(groups.nth(1).locator("h3")).toHaveText("Linked by request 1");
    await expect(groups.nth(2).locator("h3")).toHaveText("Declined 1");

    const pending = [
      ["fixture-link/alpha", "900001", "LINK-ALPHA", "2026-10-26T00:00:00.000Z", "2026-10-26T03:00:00.000Z"],
      ["fixture-link/bravo", "900002", "LINK-BRAVO", "2026-10-26T00:00:00.000Z", "2026-10-26T02:00:00.000Z"],
      ["fixture-link/taken", "900003", "LINK-TAKEN", "2026-10-26T00:00:00.000Z", "2026-10-26T01:00:00.000Z"],
    ] as const;
    const articles = page.locator("[data-group=pending] article");
    await expect(articles).toHaveCount(3);
    for (const [index, [repository, owner, key, first, last]] of pending.entries()) {
      const row = articles.nth(index);
      await expect(row.locator("bdi").first()).toHaveText(repository);
      await expect(row).toHaveAttribute("data-request-state", "pending");
      await expect(row.locator("bdi")).toHaveText([repository, key]);
      await expectFact(row, "Owner id", owner);
      await expectFact(row, "Engine", ENGINE);
      await expectFact(row, "Contract", CONTRACT);
      await expectTime(row, "First request", first);
      await expectTime(row, "Last request", last);
      await expect(row.locator("dt", { hasText: "Decided" })).toHaveCount(0);
      await expect(row.locator("dt", { hasText: "Project" })).toHaveCount(0);
      await expectActions(row, ["approve", "decline", "export", "delete"]);
    }

    const linked = await openDecided(page, "linked", "fixture-link/linked");
    await expect(linked).toHaveAttribute("data-request-state", "approved");
    const linkedLine = linked.locator("[data-request-line]");
    await expect(linkedLine).toHaveAttribute("aria-expanded", "true");
    await expect(linkedLine.locator("bdi")).toHaveText(["fixture-link/linked", "LINK-LINKED"]);
    await expectFact(linked, "Owner id", "900004");
    await expectFact(linked, "Proposed key", "LINK-LINKED");
    await expectFact(linked, "Engine", ENGINE);
    await expectFact(linked, "Contract", CONTRACT);
    await expectTime(linked, "First request", "2026-10-24T00:00:00.000Z");
    await expectTime(linked, "Last request", "2026-10-25T00:00:00.000Z");
    await expectTime(linked, "Decided", "2026-10-25T12:00:00.000Z");
    await expect(linked.locator("dt", { hasText: "Repository" })).toHaveCount(0);
    await expect(linked.locator("dt", { hasText: "Project" })).toHaveCount(0);
    await expect(linked.getByText("disconnected", { exact: true })).toHaveCount(0);
    await expectActions(linked, ["decline", "export", "delete"]);

    const declined = await openDecided(page, "declined", "fixture-link/declined");
    await expect(declined).toHaveAttribute("data-request-state", "declined");
    const declinedLine = declined.locator("[data-request-line]");
    await expect(declinedLine).toHaveAttribute("aria-expanded", "true");
    await expect(declinedLine.locator("bdi")).toHaveText(["fixture-link/declined"]);
    await expectFact(declined, "Owner id", "900005");
    await expectFact(declined, "Proposed key", "LINK-DECLINED");
    await expectFact(declined, "Engine", ENGINE);
    await expectFact(declined, "Contract", CONTRACT);
    await expectTime(declined, "First request", "2026-10-18T00:00:00.000Z");
    await expectTime(declined, "Last request", "2026-10-19T00:00:00.000Z");
    await expectTime(declined, "Decided", "2026-10-20T00:00:00.000Z");
    await expect(declined.locator("dt", { hasText: "Repository" })).toHaveCount(0);
    await expect(declined.locator("dt", { hasText: "Project" })).toHaveCount(0);
    await expect(declined.getByText("disconnected", { exact: true })).toHaveCount(0);
    await expectActions(declined, ["export", "delete"]);
  } finally {
    await context.close();
  }
});

test("Approve", async ({ browser }) => {
  const id = requestId("fixture-link/alpha");
  const { context, page } = await openOwner(browser);
  try {
    const row = page.locator(`article[data-link-request="${id}"]`);
    await row.locator("[data-action=approve]").click();
    const toast = page.getByText("Linked as LINK-ALPHA.");
    await expect(toast).toBeVisible({ timeout: 20_000 });
    await expect(toast).toBeInViewport();
    await openGroup(page, "linked");
    await expect(row).toHaveAttribute("data-request-state", "approved");
    await expect(page.locator("[data-group=linked]").locator(`article[data-link-request="${id}"]`)).toBeVisible();
    expect(query("select key || ' ' || repo || ' ' || owner_github_id from public.projects where key = 'LINK-ALPHA'")).toBe(
      "LINK-ALPHA fixture-link/alpha 900001",
    );
  } finally {
    await context.close();
  }
});

test("Repository already taken", async ({ browser }) => {
  const id = requestId("fixture-link/taken");
  const { context, page } = await openOwner(browser);
  try {
    const row = page.locator(`article[data-link-request="${id}"]`);
    await row.locator("[data-action=approve]").click();
    await expect(row.locator("[data-row-message]")).toHaveText(COPY.repoTaken, { timeout: 20_000 });
    await expect(row).toHaveAttribute("data-request-state", "pending");
    await expect(page.locator("[data-group=pending]").locator(`article[data-link-request="${id}"]`)).toBeVisible();
    expect(query("select count(*) from public.projects where repo = 'fixture-link/taken'")).toBe("1");
    expect(query("select key || ' ' || owner_github_id from public.projects where repo = 'fixture-link/taken'")).toBe(
      "LINK-TAKEN-OWNER 900099",
    );
    expect(query("select count(*) from public.projects where key = 'LINK-TAKEN'")).toBe("0");
  } finally {
    await context.close();
  }
});

test("Decline", async ({ browser }) => {
  const pendingId = requestId("fixture-link/bravo");
  const linkedId = requestId("fixture-link/linked");
  const { context, page } = await openOwner(browser);
  try {
    const pending = page.locator(`article[data-link-request="${pendingId}"]`);
    await pending.locator("[data-action=decline]").click();
    await expect(page.getByText(COPY.declinedDone)).toBeVisible({ timeout: 20_000 });
    await openGroup(page, "declined");
    await expect(pending).toHaveAttribute("data-request-state", "declined");
    await expect(page.locator("[data-group=declined]").locator(`article[data-link-request="${pendingId}"]`)).toBeVisible();
    await expect(pending.getByText("disconnected", { exact: true })).toHaveCount(0);

    await openDecided(page, "linked", "fixture-link/linked");
    const linked = page.locator(`article[data-link-request="${linkedId}"]`);
    await linked.locator("[data-action=decline]").click();
    await expect(page.getByText(COPY.disconnectedDone)).toBeVisible({ timeout: 20_000 });
    await openGroup(page, "declined");
    await expect(linked).toHaveAttribute("data-request-state", "declined");
    await expect(page.locator("[data-group=declined]").locator(`article[data-link-request="${linkedId}"]`)).toBeVisible();
    await expect(linked.getByText("disconnected", { exact: true })).toBeVisible();
    expect(query("select count(*) from public.projects where key = 'LINK-LINKED'")).toBe("1");
    expect(query("select state from public.link_requests where repository = 'fixture-link/linked'")).toBe("declined");
  } finally {
    await context.close();
  }
});

test("Export", async ({ browser }) => {
  const id = requestId("fixture-link/bravo");
  const { context, page } = await openOwner(browser);
  try {
    expect(query(`select count(*) from public.link_audit where request_id = '${id}' and action = 'exported'`)).toBe("0");
    const row = page.locator(`article[data-link-request="${id}"]`);
    const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
    await row.locator("[data-action=export]").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("link-request-LINK-BRAVO.json");
    const file = await download.path();
    if (!file) throw new Error("download was not saved");
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("export was not an object");
    const body = parsed as { request?: { repository?: string } };
    expect(body.request?.repository).toBe("fixture-link/bravo");
    expect("result" in parsed).toBe(false);
    expect(query(`select count(*) from public.link_audit where request_id = '${id}' and action = 'exported'`)).toBe("1");
    await expect(page.getByText(COPY.exported)).toBeVisible();
    const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
    expect(storage).toEqual({ local: 0, session: 0 });
  } finally {
    await context.close();
  }
});

test("Delete", async ({ browser }) => {
  const id = requestId("fixture-link/linked");
  const kept = attachHistory("LINK-LINKED");
  const { context, page } = await openOwner(browser);
  try {
    const row = await openDecided(page, "linked", "fixture-link/linked");
    await row.locator("[data-action=delete]").click();
    await expect(row.locator("[data-action=cancel]")).toBeFocused();
    await expect(row).toContainText(COPY.deleteProject);
    await expectConfirmClear(row);
    await row.locator("[data-action=cancel]").click();
    await expect(row.locator("[data-action=delete]")).toBeVisible();
    await expect(row.locator("[data-action=confirm]")).toHaveCount(0);
    expect(query(`select count(*) from public.link_requests where id = '${id}'`)).toBe("1");
    expect(query(`select count(*) from public.projects where id = '${kept}'`)).toBe("1");
    expect(query(`select count(*) from public.runs where project_id = '${kept}'`)).toBe("1");
    expect(query(`select count(*) from public.events where project_id = '${kept}'`)).toBe("1");

    await row.locator("[data-action=delete]").click();
    await row.locator("[data-action=confirm]").click();
    await expect(page.getByText(COPY.deleted)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`article[data-link-request="${id}"]`)).toHaveCount(0);
    expect(query(`select count(*) from public.link_requests where id = '${id}'`)).toBe("0");
    expect(query(`select count(*) from public.projects where id = '${kept}'`)).toBe("0");
    expect(query(`select count(*) from public.runs where project_id = '${kept}'`)).toBe("0");
    expect(query(`select count(*) from public.events where project_id = '${kept}'`)).toBe("0");
  } finally {
    await context.close();
  }
});

test("Failure shows only the catalogue message", async ({ browser }) => {
  const id = requestId("fixture-link/alpha");
  const { context, page } = await openOwner(browser);
  try {
    query("revoke execute on function public.approve_link_request(uuid) from service_role");
    const row = page.locator(`article[data-link-request="${id}"]`);
    await row.locator("[data-action=approve]").click();
    await expect(row.locator("[data-row-message]")).toHaveText(COPY.failed, { timeout: 20_000 });
    await expect(row).toHaveAttribute("data-request-state", "pending");
    await expect(page.locator("[data-group=pending]").locator(`article[data-link-request="${id}"]`)).toBeVisible();
    expect(query("select state from public.link_requests where repository = 'fixture-link/alpha'")).toBe("pending");
    expect(query("select count(*) from public.projects where key = 'LINK-ALPHA'")).toBe("0");
    const text = await page.locator("[data-link-requests]").innerText();
    expect(text).not.toMatch(/42501|permission denied|duplicate key/i);
  } finally {
    grantLinkSurface();
    await context.close();
  }
});

test("Captures", async ({ browser }) => {
  test.setTimeout(900_000);
  clearCaptures();
  const shifts: Record<string, number> = Object.fromEntries(STATES.map((state) => [state, 0]));
  const csp: string[] = [];
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          colorScheme: theme,
          viewport,
          reducedMotion: "no-preference",
        });
        await armShift(context);
        await context.addCookies(ownerCookies);
        const page = await context.newPage();
        watchCsp(page, csp);
        try {
          for (const state of STATES) {
            prepare(state);
            try {
              await openHome(page);
              await reveal(page, state);
              await settle(page);
              if (viewport.width === 390) await expectNoScroll(page);
              const value = await readShift(page);
              shifts[state] = Math.max(shifts[state] ?? 0, value);
              expect(value, `${state} ${theme} ${viewport.width} ${await shiftDetail(page)}`).toBe(0);
              await capture(page, `${SCREENS}/t16-${state}-${theme}-${viewport.width}.png`);
            } finally {
              grantLinkSurface();
              insertCanonical();
            }
          }
        } finally {
          await context.close();
        }
      }
    }

    for (const theme of THEMES) {
      insertCanonical();
      const context = await browser.newContext({
        colorScheme: theme,
        viewport: { width: 1280, height: 900 },
        reducedMotion: "reduce",
      });
      await context.addCookies(ownerCookies);
      const page = await context.newPage();
      watchCsp(page, csp);
      try {
        await openHome(page);
        await reveal(page, "groups");
        expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
        await capture(page, `${SCREENS}/t16-groups-reduced-${theme}-1280.png`);
      } finally {
        await context.close();
      }
    }

    await filmApprove(browser, csp);
    await filmTheme(browser, csp);
    expect(csp).toEqual([]);
    const shots = readdirSync(SCREENS).filter((name) => name.startsWith("t16-") && name.endsWith(".png"));
    expect(shots).toHaveLength(40);
  } finally {
    grantLinkSurface();
    insertCanonical();
    writeFileSync(`${SCREENS}/t16-layout-shift.json`, `${JSON.stringify(shifts, null, 2)}\n`);
  }
  expect(Object.keys(shifts)).toHaveLength(7);
  for (const value of Object.values(shifts)) expect(value).toBe(0);
});

const COLLAPSED_STATES = ["collapsed", "group-open", "line-open", "declined-open"] as const;

function clearT21Captures() {
  mkdirSync(SCREENS, { recursive: true });
  for (const name of readdirSync(SCREENS)) {
    if (name.startsWith("t21-")) unlinkSync(`${SCREENS}/${name}`);
  }
}

async function controlledBody(toggle: Locator) {
  const id = await toggle.getAttribute("aria-controls");
  expect(id, "aria-controls").toBeTruthy();
  const body = toggle.page().locator(`[id="${id}"]`);
  await expect(body).toHaveCount(1);
  return body;
}

async function reachCollapsedState(page: Page, state: (typeof COLLAPSED_STATES)[number]) {
  await openHome(page);
  await expect(page.locator("[data-link-requests]")).toHaveAttribute("data-state", "ready");
  if (state === "collapsed") return;
  if (state === "declined-open") {
    await page.locator("[data-group=declined] [data-group-toggle]").click();
    const line = requestRow(page, "fixture-link/declined").locator("[data-request-line]");
    await line.click();
    await expect(line).toHaveAttribute("aria-expanded", "true");
    return;
  }
  const toggle = page.locator("[data-group=linked] [data-group-toggle]");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  if (state === "line-open") {
    const line = requestRow(page, "fixture-link/alpha").locator("[data-request-line]");
    await line.click();
    await expect(line).toHaveAttribute("aria-expanded", "true");
  }
}

test("Collapsed groups", async ({ browser }) => {
  insertAfterApprove();
  const { context, page } = await openOwner(browser);
  try {
    const pending = page.locator("[data-group=pending] article");
    await expect(pending).toHaveCount(2);
    await expectActions(pending.nth(0), ["approve", "decline", "export", "delete"]);
    await expectActions(pending.nth(1), ["approve", "decline", "export", "delete"]);

    const linkedToggle = page.locator("[data-group=linked] [data-group-toggle]");
    const declinedToggle = page.locator("[data-group=declined] [data-group-toggle]");
    await expect(linkedToggle).toHaveAttribute("aria-expanded", "false");
    await expect(declinedToggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("[data-group=linked] h3")).toHaveText("Linked by request 2");
    await expect(page.locator("[data-group=declined] h3")).toHaveText("Declined 1");
    for (const toggle of [linkedToggle, declinedToggle]) {
      const body = await controlledBody(toggle);
      await expect(body).toBeHidden();
      await expect(body.locator("article")).toHaveCount(0);
    }
    const cookieNames = (await context.cookies()).map((cookie) => cookie.name).sort();

    let linkedFocused = false;
    for (let press = 0; press < 80; press += 1) {
      linkedFocused = await linkedToggle.evaluate((element) => element === document.activeElement);
      if (linkedFocused) break;
      await page.keyboard.press("Tab");
    }
    expect(linkedFocused).toBe(true);
    await page.keyboard.press("Enter");
    await expect(linkedToggle).toHaveAttribute("aria-expanded", "true");
    const lines = page.locator("[data-group=linked] [data-group-body] [data-request-line]");
    await expect(lines).toHaveCount(2);
    const alphaLine = lines.nth(0);
    const linkedLine = lines.nth(1);
    await expect(alphaLine).toHaveAttribute("aria-expanded", "false");
    await expect(linkedLine).toHaveAttribute("aria-expanded", "false");
    await expect(alphaLine.locator("bdi")).toHaveText(["fixture-link/alpha", "LINK-ALPHA"]);
    await expect(linkedLine.locator("bdi")).toHaveText(["fixture-link/linked", "LINK-LINKED"]);
    await expect(alphaLine.locator("time")).toHaveAttribute("datetime", "2026-10-26T04:00:00.000Z");
    await expect(linkedLine.locator("time")).toHaveAttribute("datetime", "2026-10-25T12:00:00.000Z");
    await expect(alphaLine.locator("xpath=ancestor::article[1]").locator("[data-action]")).toHaveCount(0);
    await expect(linkedLine.locator("xpath=ancestor::article[1]").locator("[data-action]")).toHaveCount(0);

    await alphaLine.focus();
    await page.keyboard.press("Enter");
    await expect(alphaLine).toHaveAttribute("aria-expanded", "true");
    await expect(alphaLine).toBeFocused();
    const alpha = requestRow(page, "fixture-link/alpha");
    await expect(alpha.locator("[data-request-details] dt")).toHaveText([
      "Owner id",
      "Proposed key",
      "Engine",
      "Contract",
      "First request",
      "Last request",
      "Decided",
    ]);
    await expectActions(alpha, ["decline", "export", "delete"]);
    await page.keyboard.press("Space");
    await expect(alphaLine).toHaveAttribute("aria-expanded", "false");
    await expect(alphaLine).toBeFocused();

    const declined = await openDecided(page, "declined", "fixture-link/declined");
    await expectActions(declined, ["export", "delete"]);

    const storage = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    }));
    expect(storage.local).toBe(0);
    expect(storage.session).toBe(0);
    const address = new URL(page.url());
    expect(address.pathname).toBe("/");
    expect(address.search).toBe("");
    expect((await context.cookies()).map((cookie) => cookie.name).sort()).toEqual(cookieNames);

    await page.reload({ waitUntil: "load" });
    await expect(page.locator("[data-link-requests]")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("[data-group=linked] [data-group-toggle]")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("[data-group=declined] [data-group-toggle]")).toHaveAttribute("aria-expanded", "false");
  } finally {
    await context.close();
  }
});

test("Captures of the collapsed groups", async ({ browser }) => {
  test.setTimeout(900_000);
  clearT21Captures();
  insertAfterApprove();
  const shifts: Record<string, number> = Object.fromEntries(COLLAPSED_STATES.map((state) => [state, 0]));
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          colorScheme: theme,
          viewport,
          reducedMotion: "no-preference",
        });
        await armShift(context);
        await context.addCookies(ownerCookies);
        const page = await context.newPage();
        try {
          for (const state of COLLAPSED_STATES) {
            await reachCollapsedState(page, state);
            await settle(page);
            if (viewport.width === 390) await expectNoScroll(page);
            const value = await readShift(page);
            shifts[state] = Math.max(shifts[state] ?? 0, value);
            expect(value, `${state} ${theme} ${viewport.width} ${await shiftDetail(page)}`).toBe(0);
            await capture(page, `${SCREENS}/t21-${state}-${theme}-${viewport.width}.png`);
          }
        } finally {
          await context.close();
        }
      }
    }

    for (const theme of THEMES) {
      const context = await browser.newContext({
        colorScheme: theme,
        viewport: { width: 1280, height: 900 },
        reducedMotion: "reduce",
      });
      await context.addCookies(ownerCookies);
      const page = await context.newPage();
      try {
        await reachCollapsedState(page, "group-open");
        expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
        await capture(page, `${SCREENS}/t21-group-open-reduced-${theme}-1280.png`);
      } finally {
        await context.close();
      }
    }

    const film = await browser.newContext({
      colorScheme: "dark",
      viewport: { width: 1280, height: 900 },
      reducedMotion: "no-preference",
    });
    await film.addCookies(ownerCookies);
    const filmPage = await film.newPage();
    try {
      await openHome(filmPage);
      await expect(filmPage.locator("[data-link-requests]")).toHaveAttribute("data-state", "ready");
      await settle(filmPage);
      await armHoldNew(filmPage);
      await filmPage.locator("[data-group=linked] [data-group-toggle]").click();
      await expect(filmPage.locator("[data-group=linked] [data-group-toggle]")).toHaveAttribute("aria-expanded", "true");
      for (const time of FILM_TIMES) {
        await seekNew(filmPage, time);
        await capture(filmPage, `${SCREENS}/t21-group-open-dark-1280-film-${time}.png`);
      }
    } finally {
      await film.close();
    }

    const shots = readdirSync(SCREENS).filter((name) => name.startsWith("t21-") && name.endsWith(".png"));
    expect(shots).toHaveLength(23);
  } finally {
    writeFileSync(`${SCREENS}/t21-layout-shift.json`, `${JSON.stringify(shifts, null, 2)}\n`);
  }
  expect(Object.keys(shifts)).toHaveLength(4);
  for (const value of Object.values(shifts)) expect(value).toBe(0);
});
