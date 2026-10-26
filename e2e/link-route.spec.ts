import { expect, test } from "@playwright/test";

const linkBody = {
  v: 1,
  key: "LK-E2E",
  engine: "0.1.0",
  contract: "1",
};

test("POST /api/link on the local server answers 404 without a session cookie or CSP", async ({ request }) => {
  const response = await request.post("/api/link", { data: linkBody });
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: "not_found" });
  const headers = response.headers();
  expect(headers["set-cookie"]).toBeUndefined();
  expect(headers["content-security-policy"]).toBeUndefined();
});
