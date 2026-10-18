import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createOwner, removeOwner, sessionCookies } from "./support/owner";

const SIGN_IN_OWNER = { githubId: "700041", login: "fixture-sign-in-owner" };
const FILM_TIMES = [0, 80, 160, 320, 640] as const;
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;
const STATES = ["signed-out", "redirecting", "checking", "denied", "error"] as const;

test.describe.configure({ timeout: 360_000 });

test.beforeAll(async () => {
  mkdirSync(".devos/screens", { recursive: true });
  await removeOwner([SIGN_IN_OWNER]);
  await createOwner({ ...SIGN_IN_OWNER, allowListed: true });
});

test.afterAll(async () => {
  await removeOwner([SIGN_IN_OWNER]);
});

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

async function readShiftSources(page: Page): Promise<{ value: number; sources: string[] }[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __layoutShift: { entries: { value: number; sources: string[] }[] } }).__layoutShift
        .entries,
  );
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

function holdAnimations(context: BrowserContext) {
  return context.addInitScript(() => {
    const hold = () => {
      for (const animation of document.getAnimations()) {
        if (animation.playState === "running") animation.pause();
      }
      requestAnimationFrame(hold);
    };
    requestAnimationFrame(hold);
  });
}

function watchTransitions(context: BrowserContext) {
  return context.addInitScript(() => {
    window.addEventListener("pagereveal", (event) => {
      const transition = (
        event as Event & { viewTransition?: { ready: Promise<void>; skipTransition: () => void } | null }
      ).viewTransition;
      if (!transition) {
        Object.assign(window, {
          __viewTransition: null,
          __vtNames: [],
          __vtDurations: [],
          __vtNull: true,
          __vtReady: true,
        });
        return;
      }
      void transition.ready.then(
        () => {
          const names: string[] = [];
          const durations: { pseudo: string; duration: number }[] = [];
          for (const animation of document.getAnimations()) {
            animation.pause();
            const effect = animation.effect;
            if (!effect || !("pseudoElement" in effect)) continue;
            const pseudo = (effect as KeyframeEffect).pseudoElement;
            if (!pseudo) continue;
            names.push(pseudo);
            const duration = effect.getTiming().duration;
            durations.push({ pseudo, duration: typeof duration === "number" ? duration : -1 });
          }
          Object.assign(window, {
            __viewTransition: transition,
            __vtNames: names,
            __vtDurations: durations,
            __vtNull: false,
            __vtReady: true,
          });
        },
        () => {
          Object.assign(window, {
            __viewTransition: null,
            __vtNames: [],
            __vtDurations: [],
            __vtNull: true,
            __vtReady: true,
          });
        },
      );
    });
  });
}

async function releaseTransition(page: Page) {
  await page.evaluate(() => {
    const transition = (window as unknown as { __viewTransition?: { skipTransition: () => void } | null })
      .__viewTransition;
    try {
      transition?.skipTransition();
    } catch {
      // The transition has already finished.
    }
  });
}

function expectSameBox(
  before: { x: number; y: number; width: number; height: number },
  after: { x: number; y: number; width: number; height: number },
) {
  expect(Math.abs(before.x - after.x)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(before.width - after.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(before.height - after.height)).toBeLessThanOrEqual(0.5);
}

async function placement(page: Page) {
  return page.evaluate(() => {
    const turn = document.querySelector("[data-planet-turn]");
    const globe = turn?.parentElement?.parentElement ?? null;
    const card = document.querySelector("[data-sign-in-card]");
    const g = globe?.getBoundingClientRect();
    const c = card?.getBoundingClientRect();
    if (!g || !c || g.width <= 0) {
      return { width: g?.width ?? 0, ok: false, shares: false, top: 0, globeBottom: 0, right: 0, globeLeft: 0 };
    }
    const shares = c.top < g.bottom && c.bottom > g.top;
    const ok = shares ? c.right <= g.left + 0.5 : c.top + 0.5 >= g.bottom;
    return { width: g.width, ok, shares, top: c.top, globeBottom: g.bottom, right: c.right, globeLeft: g.left };
  });
}

async function productMarks(page: Page) {
  return page.evaluate(() => {
    const found: { inCard: boolean; inNav: boolean }[] = [];
    for (const element of document.querySelectorAll("*")) {
      if (getComputedStyle(element).viewTransitionName !== "product-mark") continue;
      found.push({
        inCard: Boolean(element.closest("[data-sign-in-card]")),
        inNav: Boolean(element.closest("nav")),
      });
    }
    return found;
  });
}

async function hasViewTransitionRule(page: Page) {
  return page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of rules) {
        const text = rule.cssText.replace(/\s+/g, "");
        if (text.includes("@view-transition") && text.includes("navigation:auto")) return true;
      }
    }
    return false;
  });
}

async function readLive<T>(page: Page, expression: string): Promise<T> {
  const session = await page.context().newCDPSession(page);
  try {
    const response = await session.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text ?? "page read failed");
    }
    return response.result.value as T;
  } finally {
    await session.detach();
  }
}

async function untilLive<T>(page: Page, expression: string, ready: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 8_000;
  let latest: T | undefined;
  while (Date.now() < deadline) {
    latest = await readLive<T>(page, expression);
    if (ready(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`timed out reading the page: ${JSON.stringify(latest)}`);
}

async function openChecking(page: Page) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/auth/confirm**", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/auth/callback?code=t09-synthetic-code", { waitUntil: "commit" });
  return release;
}

async function showChecking(page: Page) {
  await page.route("**/auth/confirm**", async (route) => {
    await route.abort("aborted");
  });
  await page.goto("/auth/callback?code=t09-synthetic-code", { waitUntil: "commit" });
  await expect(page.getByText("Checking your access…")).toBeVisible();
}

async function boxOf(locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("sign-in controls are missing");
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

async function showRedirecting(page: Page) {
  let openGate = () => {};
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  let arrived = () => {};
  const held = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  let finished = () => {};
  const aborted = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route("**/auth/v1/authorize**", async (route) => {
    arrived();
    await gate;
    await route.abort().catch(() => undefined);
    finished();
  });
  const button = page.locator("[data-sign-in-button]");
  const card = page.locator("[data-sign-in-card]");
  const before = { button: await boxOf(button), card: await boxOf(card) };
  await button.click({ noWaitAfter: true, timeout: 8_000 });
  const status = button.locator("[role='status']");
  await expect(status).not.toHaveAttribute("aria-hidden", "true");
  await expect(status).toContainText("Opening GitHub…");
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(button).toBeDisabled();
  const after = {
    ...before,
    button: await boxOf(button),
    card: await boxOf(card),
    status: (await status.textContent()) ?? "",
    hidden: await status.getAttribute("aria-hidden"),
    busy: await button.getAttribute("aria-busy"),
    disabled: await button.isDisabled(),
  };
  await Promise.race([
    held,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("authorize route was not held")), 8_000)),
  ]);
  return {
    release: async () => {
      openGate();
      await aborted;
    },
    before,
    after,
  };
}

test("unsigned visitors are sent to sign-in and the read API refuses them", async ({ request }) => {
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(302);
  expect(home.headers().location ?? "").toMatch(/\/sign-in$/);

  const missing = await request.get("/denied-does-not-exist", { maxRedirects: 0 });
  expect(missing.status()).toBe(302);
  expect(missing.headers().location ?? "").toMatch(/\/sign-in$/);

  const signOut = await request.post("/auth/sign-out", { maxRedirects: 0 });
  expect(signOut.status()).toBe(303);
  expect(signOut.headers().location ?? "").toMatch(/\/sign-in$/);

  const projects = await request.get("/api/projects");
  expect(projects.status()).toBe(401);
  expect(await projects.json()).toEqual({ error: "unauthenticated" });

  const denied = await request.get("/sign-in?reason=not_owner", { maxRedirects: 0 });
  expect(denied.status()).toBe(403);
  const deniedBody = await denied.text();
  expect(deniedBody).toContain("This GitHub account is not the owner. Signed out.");

  const signedOut = await request.get("/sign-in", { maxRedirects: 0 });
  expect(signedOut.status()).toBe(200);
  expect(await signedOut.text()).toContain('<html lang="en" dir="ltr"');

  const authError = await request.get("/sign-in?reason=auth_error", { maxRedirects: 0 });
  expect(authError.status()).toBe(200);
  expect(await authError.text()).toContain('<html lang="en" dir="ltr"');

  const checking = await request.get("/auth/callback?code=t09-synthetic-code", { maxRedirects: 0 });
  expect(checking.status()).toBe(200);
  expect(await checking.text()).toContain("Checking your access…");

  const callback = await request.get("/auth/callback", { maxRedirects: 0 });
  expect(callback.status()).toBe(200);

  const confirm = await request.get("/auth/confirm", { maxRedirects: 0 });
  expect(confirm.status()).toBe(303);
  expect(confirm.headers().location ?? "").toMatch(/\/sign-in\?reason=auth_error$/);

  const confirmCode = await request.get("/auth/confirm?code=t09-synthetic-code", { maxRedirects: 0 });
  expect(confirmCode.status()).toBe(303);
  expect(confirmCode.headers().location ?? "").toMatch(/\/sign-in\?reason=auth_error$/);
});

test("sign-in renders its three states and the header baseline", async ({ page }) => {
  const cspMessages: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("Content Security Policy")) cspMessages.push(text);
  });

  const signedOut = await page.goto("/sign-in");
  expect(signedOut?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Control Tower" })).toBeVisible();
  await expect(page.getByText("The Tower admits one GitHub account: its owner.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();

  const headers = signedOut?.headers() ?? {};
  expect(headers["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=(), interest-cohort=()");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["cache-control"] ?? "").toContain("private, no-store");
  const policy = headers["content-security-policy"] ?? "";
  expect(policy).toContain("default-src 'self'");
  expect(policy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(policy).toMatch(/style-src 'self' 'nonce-[^']+'/);
  expect(policy).not.toContain("'unsafe-inline'");
  expect(policy).toContain("img-src 'self' data: https://avatars.githubusercontent.com");
  expect(policy).toContain("font-src 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("base-uri 'self'");
  expect(policy).toContain("form-action 'self'");

  const denied = await page.goto("/sign-in?reason=not_owner");
  expect(denied?.status()).toBe(403);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Control Tower" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use another account" })).toBeVisible();
  await expect(page.getByText("This GitHub account is not the owner. Signed out.")).toBeVisible();

  const errored = await page.goto("/sign-in?reason=auth_error");
  expect(errored?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Control Tower" })).toBeVisible();
  await expect(page.getByText("Sign-in did not complete: no session was returned. Try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(cspMessages).toEqual([]);
});

test("Redirecting and checking", async ({ page }) => {
  await page.goto("/sign-in");
  await settle(page);
  const pressed = await showRedirecting(page);
  expect(pressed.after.status).toContain("Opening GitHub…");
  expect(pressed.after.busy).toBe("true");
  expect(pressed.after.disabled).toBe(true);
  expectSameBox(pressed.before.button, pressed.after.button);
  expectSameBox(pressed.before.card, pressed.after.card);
  await pressed.release();

  const release = await openChecking(page);
  const seen = await untilLive<{ state: string; text: string; name: string }>(
    page,
    `(() => {
      const card = document.querySelector("[data-sign-in-card]");
      const mark = card ? card.querySelector("svg") : null;
      return {
        state: card ? card.getAttribute("data-state") ?? "" : "",
        text: document.body.innerText,
        name: mark ? getComputedStyle(mark).viewTransitionName : "",
      };
    })()`,
    (value) => value.state === "checking" && value.text.includes("Checking your access"),
  );
  expect(seen.state).toBe("checking");
  expect(seen.text).toContain("Checking your access…");
  expect(seen.text).not.toContain("t09-synthetic-code");
  expect(seen.name).toBe("product-mark");
  release();
  await page.waitForURL(/\/sign-in\?reason=auth_error$/);
});

test("Shared mark and transitions", async ({ browser }) => {
  const cookies = await sessionCookies("fixture-sign-in-owner@example.test");
  const context = await browser.newContext();
  await watchTransitions(context);
  await context.addCookies(cookies);
  const page = await context.newPage();
  await page.goto("/sign-in");
  await settle(page);
  const onCard = await productMarks(page);
  expect(onCard).toEqual([{ inCard: true, inNav: false }]);
  expect(await hasViewTransitionRule(page)).toBe(true);

  await page.evaluate(() => {
    location.assign("/");
  });
  await page.waitForURL(/\/$/);
  const success = await readTransition(page);
  expect(success.missing).toBe(false);
  expect(success.names).toContain("::view-transition-group(product-mark)");
  const onOverview = await productMarks(page);
  expect(onOverview).toEqual([{ inCard: false, inNav: true }]);
  expect(await hasViewTransitionRule(page)).toBe(true);
  await releaseTransition(page);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/sign-in$/);
  const signedOut = await readTransition(page);
  expect(signedOut.missing).toBe(false);
  expect(signedOut.names).toContain("::view-transition-new(root)");
  await context.close();

  const reducedCookies = await sessionCookies("fixture-sign-in-owner@example.test");
  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  await watchTransitions(reduced);
  await reduced.addCookies(reducedCookies);
  const reducedPage = await reduced.newPage();
  await reducedPage.goto("/sign-in");
  await reducedPage.evaluate(() => {
    location.assign("/");
  });
  await reducedPage.waitForURL(/\/$/);
  const reducedTransition = await readTransition(reducedPage);
  expect(reducedTransition.missing).toBe(false);
  expect(reducedTransition.names.some((name) => name.includes("::view-transition-group("))).toBe(false);
  const oldOrNew = reducedTransition.durations.filter(
    (entry) => entry.pseudo.includes("view-transition-old") || entry.pseudo.includes("view-transition-new"),
  );
  expect(oldOrNew.length).toBeGreaterThan(0);
  for (const entry of oldOrNew) expect(entry.duration).toBe(160);
  await reduced.close();
});

test("Evidence", async ({ browser }) => {
  const shifts: Record<string, number> = {};
  const shiftSources: Record<string, { value: number; sources: string[] }[]> = {};

  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      for (const reduced of [false, true]) {
        const context = await browser.newContext({
          colorScheme: theme,
          viewport,
          reducedMotion: reduced ? "reduce" : "no-preference",
        });
        await armShift(context);
        const page = await context.newPage();
        const suffix = reduced ? "-reduced" : "";
        for (const state of STATES) {
          await page.evaluate(() => {
            const bucket = (window as unknown as { __layoutShift?: { value: number; entries: unknown[] } }).__layoutShift;
            if (!bucket) return;
            bucket.value = 0;
            bucket.entries = [];
          }).catch(() => undefined);
          const release = await captureState(page, state);
          if (reduced) {
            const text = await page.evaluate(() => document.body.innerText);
            for (const line of expectedLines(state)) expect(text).toContain(line);
            expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
            const transform = await page
              .locator("[data-sign-in-card]")
              .evaluate((element) => getComputedStyle(element).transform);
            expect(transform).toBe("none");
          }
          const where = await placement(page);
          expect(where.width).toBeGreaterThan(0);
          expect(where.ok).toBe(true);
          const key = `${state}-${theme}-${viewport.width}${suffix}`;
          await page.screenshot({ path: `.devos/screens/t09-${key}.png` });
          shifts[key] = await readShift(page);
          shiftSources[key] = await readShiftSources(page);
          await release();
        }
        await context.close();
      }

      const film = await browser.newContext({ colorScheme: theme, viewport, reducedMotion: "no-preference" });
      await holdAnimations(film);
      const filmPage = await film.newPage();
      for (const state of ["signed-out", "denied", "error", "checking"] as const) {
        await captureState(filmPage, state, { film: true });
        await expect(filmPage.getByRole("heading", { name: "Control Tower" })).toBeVisible();
        for (const time of FILM_TIMES) {
          await seek(filmPage, time);
          await filmPage.screenshot({
            path: `.devos/screens/t09-${state}-${theme}-${viewport.width}-film-${String(time).padStart(3, "0")}.png`,
          });
        }
      }
      await film.close();

      const press = await browser.newContext({ colorScheme: theme, viewport, reducedMotion: "no-preference" });
      const pressPage = await press.newPage();
      await pressPage.goto("/sign-in", { waitUntil: "load" });
      await settle(pressPage);
      await pressPage.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          (animation as Animation & { held?: boolean }).held = true;
        }
        const hold = () => {
          for (const animation of document.getAnimations()) {
            if ((animation as Animation & { held?: boolean }).held) continue;
            if (animation.playState === "running") animation.pause();
          }
          requestAnimationFrame(hold);
        };
        requestAnimationFrame(hold);
      });
      const pressed = await showRedirecting(pressPage);
      for (const time of FILM_TIMES) {
        await pressPage.evaluate((ms) => {
          for (const animation of document.getAnimations()) {
            if ((animation as Animation & { held?: boolean }).held) continue;
            animation.pause();
            animation.currentTime = ms;
          }
        }, time);
        await pressPage.screenshot({
          path: `.devos/screens/t09-redirecting-${theme}-${viewport.width}-film-${String(time).padStart(3, "0")}.png`,
        });
      }
      await pressed.release();
      await press.close();
    }
  }

  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      const cookies = await sessionCookies("fixture-sign-in-owner@example.test");
      const context = await browser.newContext({ colorScheme: theme, viewport });
      await armShift(context);
      await watchTransitions(context);
      await context.addCookies(cookies);
      const page = await context.newPage();
      await page.goto("/sign-in", { waitUntil: "load" });
      await settle(page);
      await page.evaluate(() => {
        location.assign("/");
      });
      await page.waitForURL(/\/$/);
      await filmTransition(page, `t09-to-success-${theme}-${viewport.width}`);
      const successKey = `to-success-${theme}-${viewport.width}`;
      shifts[successKey] = await readShift(page);
      shiftSources[successKey] = await readShiftSources(page);
      await releaseTransition(page);

      await page.getByRole("button", { name: "Sign out" }).click();
      await page.waitForURL(/\/sign-in$/);
      await filmTransition(page, `t09-to-signed-out-${theme}-${viewport.width}`);
      const signedOutKey = `to-signed-out-${theme}-${viewport.width}`;
      shifts[signedOutKey] = await readShift(page);
      shiftSources[signedOutKey] = await readShiftSources(page);
      await context.close();
    }
  }

  writeFileSync(".devos/screens/t09-layout-shift.json", `${JSON.stringify(shifts, null, 2)}\n`);
  writeFileSync(".devos/screens/t09-layout-shift-sources.json", `${JSON.stringify(shiftSources, null, 2)}\n`);
  expect(Object.keys(shifts)).toHaveLength(48);
  for (const value of Object.values(shifts)) expect(value).toBe(0);
});

function expectedLines(state: (typeof STATES)[number]): string[] {
  if (state === "signed-out") {
    return ["Control Tower", "The Tower admits one GitHub account: its owner.", "Continue with GitHub"];
  }
  if (state === "redirecting") return ["Control Tower", "Opening GitHub…"];
  if (state === "checking") return ["Control Tower", "Checking your access…"];
  if (state === "denied") {
    return ["Control Tower", "Use another account", "This GitHub account is not the owner. Signed out."];
  }
  return ["Control Tower", "Sign-in did not complete: no session was returned. Try again.", "Try again"];
}

async function captureState(
  page: Page,
  state: (typeof STATES)[number],
  options?: { film?: boolean },
): Promise<() => Promise<void>> {
  if (state === "signed-out" || state === "redirecting") {
    await page.goto("/sign-in", { waitUntil: "load" });
    if (options?.film) return async () => undefined;
    await settle(page);
    if (state === "redirecting") {
      const pressed = await showRedirecting(page);
      await settle(page);
      return pressed.release;
    }
    return async () => undefined;
  }
  if (state === "denied") {
    await page.goto("/sign-in?reason=not_owner", { waitUntil: "load" });
    if (!options?.film) await settle(page);
    return async () => undefined;
  }
  if (state === "error") {
    await page.goto("/sign-in?reason=auth_error", { waitUntil: "load" });
    if (!options?.film) await settle(page);
    return async () => undefined;
  }
  await showChecking(page);
  if (!options?.film) await settle(page);
  return async () => undefined;
}

async function readTransition(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __vtReady?: boolean }).__vtReady === true);
  return page.evaluate(() => {
    const record = window as unknown as {
      __vtNull: boolean;
      __vtNames: string[];
      __vtDurations: { pseudo: string; duration: number }[];
    };
    return { missing: record.__vtNull, names: record.__vtNames, durations: record.__vtDurations };
  });
}

async function filmTransition(page: Page, prefix: string) {
  const recorded = await readTransition(page);
  expect(recorded.missing).toBe(false);
  for (const time of FILM_TIMES) {
    await seek(page, time);
    await page.screenshot({ path: `.devos/screens/${prefix}-${String(time).padStart(3, "0")}.png` });
  }
}
