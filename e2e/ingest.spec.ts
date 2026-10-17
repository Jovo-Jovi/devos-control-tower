import { expect, test } from "@playwright/test";

const passVerdict = {
  v: 1,
  project: "PILOT",
  run: "gha-18234567890-1",
  seq: 9,
  phase: "P07",
  task: "T26",
  step: "verdict",
  status: "pass",
  at: "2026-10-21T09:14:03.512Z",
  evidence: "docs/reviews/T26-a1.md@9f3c2ab",
};

test("POST /api/ingest on the local server answers 404 without a session cookie or CSP", async ({ request }) => {
  const response = await request.post("/api/ingest", { data: passVerdict });
  expect(response.status()).toBe(404);
  const headers = response.headers();
  expect(headers["set-cookie"]).toBeUndefined();
  expect(headers["content-security-policy"]).toBeUndefined();
});
