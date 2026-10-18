import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createWebhookHandler } = await import("./webhook");
const { createAdminClient } = await import("./admin");

const TOWER = "http://localhost:3999";
const HOST = "localhost:3999";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const AT = "2026-10-17T10:00:00Z";
const STARTED = "2026-10-17T09:00:00Z";
const secret = randomBytes(32).toString("hex");

type Handler = (request: Request) => Promise<Response>;
type Admin = ReturnType<typeof createAdminClient>;

let admin: Admin;
let handler: Handler;
let projectId: string;
const deliveryIds: string[] = [];

function sign(body: string, key = secret): string {
  return `sha256=${createHmac("sha256", key).update(body).digest("hex")}`;
}

function sender(id = 2001, login = "fixture-owner", type = "User") {
  return { id, login, type };
}

function statusBody(fullName = "fixture-org/webhook-repo", who = sender()) {
  return {
    sha: SHA,
    context: "devos/checks",
    state: "success",
    updated_at: AT,
    repository: { full_name: fullName },
    sender: who,
  };
}

function signedHeaders(body: string, delivery: string, eventName: string, signature = sign(body)) {
  return {
    "x-hub-signature-256": signature,
    "x-github-delivery": delivery,
    "x-github-event": eventName,
  };
}

async function post(body: string, headers: Record<string, string> = {}): Promise<Response> {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("host")) requestHeaders.set("host", HOST);
  const response = await handler(
    new Request(`${TOWER}/api/github/webhook`, { method: "POST", headers: requestHeaders, body }),
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  return response;
}

async function tableCount(table: "webhook_deliveries" | "observations"): Promise<number> {
  const column = table === "webhook_deliveries" ? "delivery_id" : "id";
  const { count, error } = await admin.from(table).select(column, { count: "exact", head: true });
  if (error) throw new Error(error.code ?? table);
  return count ?? 0;
}

async function counts() {
  return {
    deliveries: await tableCount("webhook_deliveries"),
    observations: await tableCount("observations"),
  };
}

async function expectUntouched(status: number, body: unknown, run: () => Promise<Response>) {
  const before = await counts();
  const response = await run();
  expect(response.status).toBe(status);
  if (body === null) expect(await response.text()).toBe("");
  else {
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
    expect(await response.json()).toEqual(body);
  }
  expect(await counts()).toEqual(before);
}

describe("U-T03-2 createWebhookHandler", () => {
  beforeAll(async () => {
    handler = createWebhookHandler();
    admin = createAdminClient();
    const existing = await admin.from("projects").select("id").eq("key", "WEBHOOK").maybeSingle();
    if (existing.error) throw new Error(existing.error.code ?? "project");
    if (existing.data) {
      const rows = await admin.from("observations").select("payload_ref").eq("project_id", existing.data.id);
      if (rows.error) throw new Error(rows.error.code ?? "cleanup");
      const ids = (rows.data ?? []).map((row) => row.payload_ref);
      if (ids.length > 0) {
        const removed = await admin.from("webhook_deliveries").delete().in("delivery_id", ids);
        if (removed.error) throw new Error(removed.error.code ?? "cleanup");
      }
      const removedProject = await admin.from("projects").delete().eq("id", existing.data.id);
      if (removedProject.error) throw new Error(removedProject.error.code ?? "cleanup");
    }
    const inserted = await admin
      .from("projects")
      .insert({ key: "WEBHOOK", repo: "fixture-org/webhook-repo", owner_github_id: "2001" })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.code ?? "insert");
    projectId = inserted.data.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (deliveryIds.length > 0) await admin.from("webhook_deliveries").delete().in("delivery_id", deliveryIds);
    await admin.from("projects").delete().eq("key", "WEBHOOK");
  });

  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
    process.env.TOWER_URL = TOWER;
    process.env.GITHUB_WEBHOOK_SECRET = secret;
  });

  it("answers 404 when the server is not production", async () => {
    process.env.VERCEL_ENV = "preview";
    const body = JSON.stringify(statusBody());
    await expectUntouched(404, null, () => post(body, signedHeaders(body, randomUUID(), "status")));
  });

  it("answers 404 when the host does not match TOWER_URL", async () => {
    const body = JSON.stringify(statusBody());
    await expectUntouched(404, null, () =>
      post(body, { ...signedHeaders(body, randomUUID(), "status"), host: "localhost:1" }),
    );
  });

  it("answers 404 when TOWER_URL is unset or invalid", async () => {
    const body = JSON.stringify(statusBody());
    delete process.env.TOWER_URL;
    await expectUntouched(404, null, () => post(body, signedHeaders(body, randomUUID(), "status")));
    process.env.TOWER_URL = "not-a-url";
    await expectUntouched(404, null, () => post(body, signedHeaders(body, randomUUID(), "status")));
  });

  it("answers 401 bad_signature when the signature header is missing", async () => {
    await expectUntouched(401, { error: "bad_signature" }, () =>
      post("not-json", { "x-github-delivery": randomUUID(), "x-github-event": "status" }),
    );
  });

  it("answers 401 bad_signature for a sha1 signature", async () => {
    const body = JSON.stringify(statusBody());
    await expectUntouched(401, { error: "bad_signature" }, () =>
      post(body, signedHeaders(body, randomUUID(), "status", `sha1=${"ab".repeat(20)}`)),
    );
  });

  it("answers 401 bad_signature for a wrong digest", async () => {
    const body = JSON.stringify(statusBody());
    await expectUntouched(401, { error: "bad_signature" }, () =>
      post(body, signedHeaders(body, randomUUID(), "status", `sha256=${"ab".repeat(32)}`)),
    );
  });

  it("answers 401 bad_signature when the body changes after signing", async () => {
    const body = JSON.stringify(statusBody());
    const changed = body.replace("success", "failure");
    await expectUntouched(401, { error: "bad_signature" }, () =>
      post(changed, signedHeaders(changed, randomUUID(), "status", sign(body))),
    );
  });

  it("answers 401 bad_signature when the secret is unset or empty", async () => {
    const body = JSON.stringify(statusBody());
    const headers = signedHeaders(body, randomUUID(), "status");
    delete process.env.GITHUB_WEBHOOK_SECRET;
    await expectUntouched(401, { error: "bad_signature" }, () => post(body, headers));
    process.env.GITHUB_WEBHOOK_SECRET = "";
    await expectUntouched(401, { error: "bad_signature" }, () => post(body, headers));
  });

  it("answers 202 stored false for installation and ping", async () => {
    const body = JSON.stringify(statusBody());
    await expectUntouched(202, { stored: false }, () => post(body, signedHeaders(body, randomUUID(), "installation")));
    await expectUntouched(202, { stored: false }, () => post(body, signedHeaders(body, randomUUID(), "ping")));
  });

  it("answers 202 stored false for an unregistered repository", async () => {
    const body = JSON.stringify(statusBody("fixture-org/other-repo"));
    await expectUntouched(202, { stored: false }, () => post(body, signedHeaders(body, randomUUID(), "status")));
  });

  it("answers 202 stored false for a signed body that is not JSON", async () => {
    const body = "not-json";
    await expectUntouched(202, { stored: false }, () => post(body, signedHeaders(body, randomUUID(), "status")));
  });

  it("answers 202 stored false when the delivery id is missing or empty", async () => {
    const body = JSON.stringify(statusBody());
    await expectUntouched(202, { stored: false }, () =>
      post(body, { "x-hub-signature-256": sign(body), "x-github-event": "status" }),
    );
    await expectUntouched(202, { stored: false }, () =>
      post(body, { "x-hub-signature-256": sign(body), "x-github-delivery": "", "x-github-event": "status" }),
    );
  });

  async function expectStored(
    eventName: string,
    payload: unknown,
    expected: {
      kind: "workflow_run" | "check_run" | "status" | "pull_request";
      sha: string;
      context: string | null;
      state: string;
      at: string;
      actorLogin: string | null;
    },
  ) {
    const delivery = randomUUID();
    deliveryIds.push(delivery);
    const body = JSON.stringify(payload);
    const before = await counts();
    const response = await post(body, signedHeaders(body, delivery, eventName));
    expect(response.status).toBe(202);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
    expect(await response.json()).toEqual({ stored: true });
    expect(await counts()).toEqual({
      deliveries: before.deliveries + 1,
      observations: before.observations + 1,
    });

    const deliveryRow = await admin
      .from("webhook_deliveries")
      .select("delivery_id, event_name")
      .eq("delivery_id", delivery)
      .maybeSingle();
    if (deliveryRow.error) throw new Error(deliveryRow.error.code ?? "delivery");
    expect(deliveryRow.data).toEqual({ delivery_id: delivery, event_name: eventName });

    const observation = await admin
      .from("observations")
      .select("project_id, sha, kind, context, state, at, actor_login, payload_ref")
      .eq("payload_ref", delivery)
      .maybeSingle();
    if (observation.error) throw new Error(observation.error.code ?? "observation");
    expect(observation.data).toMatchObject({
      project_id: projectId,
      sha: expected.sha,
      kind: expected.kind,
      context: expected.context,
      state: expected.state,
      actor_login: expected.actorLogin,
      payload_ref: delivery,
    });
    expect(Date.parse(observation.data?.at ?? "")).toBe(Date.parse(expected.at));

    const again = await post(body, signedHeaders(body, delivery, eventName));
    expect(again.status).toBe(202);
    expect(await again.json()).toEqual({ stored: false });
    expect(await counts()).toEqual({
      deliveries: before.deliveries + 1,
      observations: before.observations + 1,
    });
  }

  it("stores a status delivery and ignores the same delivery id", async () => {
    await expectStored("status", statusBody(), {
      kind: "status",
      sha: SHA,
      context: "devos/checks",
      state: "success",
      at: AT,
      actorLogin: "fixture-owner",
    });
  });

  it("stores a check_run with a conclusion and with a null conclusion", async () => {
    await expectStored(
      "check_run",
      {
        check_run: {
          head_sha: SHA,
          name: "ci",
          conclusion: "success",
          status: "completed",
          completed_at: AT,
          started_at: STARTED,
        },
        repository: { full_name: "fixture-org/webhook-repo" },
        sender: sender(),
      },
      { kind: "check_run", sha: SHA, context: "ci", state: "success", at: AT, actorLogin: "fixture-owner" },
    );
    await expectStored(
      "check_run",
      {
        check_run: {
          head_sha: SHA,
          name: "ci-running",
          conclusion: null,
          status: "in_progress",
          completed_at: null,
          started_at: STARTED,
        },
        repository: { full_name: "fixture-org/webhook-repo" },
        sender: sender(),
      },
      {
        kind: "check_run",
        sha: SHA,
        context: "ci-running",
        state: "in_progress",
        at: STARTED,
        actorLogin: "fixture-owner",
      },
    );
  });

  it("stores a workflow_run with a conclusion and with a null conclusion", async () => {
    await expectStored(
      "workflow_run",
      {
        workflow_run: {
          head_sha: SHA,
          name: "devos-cycle",
          conclusion: "failure",
          status: "completed",
          updated_at: AT,
        },
        repository: { full_name: "fixture-org/webhook-repo" },
        sender: sender(),
      },
      { kind: "workflow_run", sha: SHA, context: "devos-cycle", state: "failure", at: AT, actorLogin: "fixture-owner" },
    );
    await expectStored(
      "workflow_run",
      {
        workflow_run: {
          head_sha: SHA,
          name: "devos-cycle-wait",
          conclusion: null,
          status: "queued",
          updated_at: AT,
        },
        repository: { full_name: "fixture-org/webhook-repo" },
        sender: sender(),
      },
      {
        kind: "workflow_run",
        sha: SHA,
        context: "devos-cycle-wait",
        state: "queued",
        at: AT,
        actorLogin: "fixture-owner",
      },
    );
  });

  it("stores a merged pull_request and an open pull_request", async () => {
    await expectStored(
      "pull_request",
      {
        pull_request: { head: { sha: SHA }, merged: true, state: "closed", updated_at: AT },
        repository: { full_name: "fixture-org/webhook-repo" },
        sender: sender(),
      },
      { kind: "pull_request", sha: SHA, context: null, state: "merged", at: AT, actorLogin: "fixture-owner" },
    );
    await expectStored(
      "pull_request",
      {
        pull_request: { head: { sha: SHA }, merged: false, state: "open", updated_at: AT },
        repository: { full_name: "fixture-org/webhook-repo" },
        sender: sender(),
      },
      { kind: "pull_request", sha: SHA, context: null, state: "open", at: AT, actorLogin: "fixture-owner" },
    );
  });

  it("stores actor_login for a bot or the owner and null for anyone else", async () => {
    await expectStored("status", statusBody("fixture-org/webhook-repo", sender(4242, "fixture-bot", "Bot")), {
      kind: "status",
      sha: SHA,
      context: "devos/checks",
      state: "success",
      at: AT,
      actorLogin: "fixture-bot",
    });
    await expectStored("status", statusBody("fixture-org/webhook-repo", sender(2001, "fixture-owner", "User")), {
      kind: "status",
      sha: SHA,
      context: "devos/checks",
      state: "success",
      at: AT,
      actorLogin: "fixture-owner",
    });
    await expectStored("status", statusBody("fixture-org/webhook-repo", sender(3001, "fixture-other", "User")), {
      kind: "status",
      sha: SHA,
      context: "devos/checks",
      state: "success",
      at: AT,
      actorLogin: null,
    });
  });

  it("verify_reported_events marks a checks pass verified after a matching status", async () => {
    const sha = `c0ffeea${"1".repeat(33)}`;
    const ingested = await admin.rpc("ingest_event", {
      payload: {
        v: 1,
        project: "WEBHOOK",
        run: "webhook-verify-a",
        seq: 1,
        phase: "P02",
        task: "T07",
        step: "checks",
        status: "pass",
        at: AT,
        evidence: `@${sha.slice(0, 7)}`,
      },
      src: "ci",
    });
    expect(ingested.error).toBeNull();
    const run = await admin.from("runs").select("id").eq("project_id", projectId).eq("run_key", "webhook-verify-a").single();
    expect(run.error).toBeNull();
    const before = await admin.from("events").select("origin").eq("run_id", run.data?.id ?? "").eq("seq", 1).single();
    expect(before.data?.origin).toBe("reported");

    const body = JSON.stringify({
      sha,
      context: "devos/checks",
      state: "success",
      updated_at: AT,
      repository: { full_name: "fixture-org/webhook-repo" },
      sender: sender(),
    });
    const delivery = randomUUID();
    deliveryIds.push(delivery);
    const response = await post(body, signedHeaders(body, delivery, "status"));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ stored: true });
    const after = await admin.from("events").select("origin").eq("run_id", run.data?.id ?? "").eq("seq", 1).single();
    expect(after.data?.origin).toBe("verified");
  });

  it("verify_reported_events leaves a verdict pass reported when the observation disagrees", async () => {
    const sha = `c0ffeeb${"2".repeat(33)}`;
    const ingested = await admin.rpc("ingest_event", {
      payload: {
        v: 1,
        project: "WEBHOOK",
        run: "webhook-verify-b",
        seq: 1,
        phase: "P02",
        task: "T07",
        step: "verdict",
        status: "pass",
        at: AT,
        evidence: `@${sha.slice(0, 7)}`,
      },
      src: "ci",
    });
    expect(ingested.error).toBeNull();
    const body = JSON.stringify({
      sha,
      context: "devos/verdict",
      state: "failure",
      updated_at: AT,
      repository: { full_name: "fixture-org/webhook-repo" },
      sender: sender(),
    });
    const delivery = randomUUID();
    deliveryIds.push(delivery);
    const response = await post(body, signedHeaders(body, delivery, "status"));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ stored: true });
    const run = await admin.from("runs").select("id").eq("project_id", projectId).eq("run_key", "webhook-verify-b").single();
    expect(run.error).toBeNull();
    const after = await admin.from("events").select("origin").eq("run_id", run.data?.id ?? "").eq("seq", 1).single();
    expect(after.data?.origin).toBe("reported");
  });
});
