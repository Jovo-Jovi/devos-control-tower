import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test.beforeAll(() => {
  mkdirSync(".devos/screens", { recursive: true });
});

test("unsigned visitors are sent to sign-in and the read API refuses them", async ({ request }) => {
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(302);
  expect(home.headers().location ?? "").toMatch(/\/sign-in$/);

  const projects = await request.get("/api/projects");
  expect(projects.status()).toBe(401);
  expect(await projects.json()).toEqual({ error: "unauthenticated" });
});

test("sign-in renders its three states and the header baseline", async ({ page }) => {
  const signedOut = await page.goto("/sign-in");
  expect(signedOut?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
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
  expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  expect(policy).toContain("img-src 'self' data: https://avatars.githubusercontent.com");
  expect(policy).toContain("font-src 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("base-uri 'self'");
  expect(policy).toContain("form-action 'self'");

  const denied = await page.goto("/sign-in?reason=not_owner");
  expect(denied?.status()).toBe(403);
  await expect(page.getByText("This GitHub account is not the owner. You have been signed out.")).toBeVisible();

  const errored = await page.goto("/sign-in?reason=auth_error");
  expect(errored?.status()).toBe(200);
  await expect(page.getByText("Sign-in did not complete: no session was returned. Try again.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
});

test("screenshots of the three sign-in states", async ({ page }) => {
  const shots: Array<[string, string]> = [
    ["signed-out", "/sign-in"],
    ["denied", "/sign-in?reason=not_owner"],
    ["error", "/sign-in?reason=auth_error"],
  ];
  const viewports: Array<[string, { width: number; height: number }]> = [
    ["1280", { width: 1280, height: 800 }],
    ["390", { width: 390, height: 844 }],
  ];
  for (const [name, path] of shots) {
    for (const [width, viewport] of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await page.screenshot({ path: `.devos/screens/sign-in-${name}-${width}.png`, fullPage: true });
    }
  }
});
