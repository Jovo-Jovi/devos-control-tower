import { expect, test } from "@playwright/test";

test("POST /api/github/webhook on the local server answers 404 without a session cookie or CSP", async ({
  request,
}) => {
  const response = await request.post("/api/github/webhook", { data: {} });
  expect(response.status()).toBe(404);
  const headers = response.headers();
  expect(headers["set-cookie"]).toBeUndefined();
  expect(headers["content-security-policy"]).toBeUndefined();
});
