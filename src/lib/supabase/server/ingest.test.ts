import {
  createLocalJWKSet,
  errors,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { issuer } = await import("../../contract/oidc");
const { createIngestHandler } = await import("./ingest");
const { createAdminClient } = await import("./admin");

const TOWER = "http://localhost:3999";
const HOST = "localhost:3999";
const PROJECTS = [
  { key: "INGEST", repo: "fixture-org/ingest-repo", owner_github_id: "1001" },
  { key: "RATE", repo: "fixture-org/rate-repo", owner_github_id: "1002" },
  { key: "OWNED", repo: "fixture-org/owned-repo", owner_github_id: "1003" },
] as const;

const LINKED = { key: "ING-LINK", repo: "fixture-org/ing-linked", owner_github_id: "1004" } as const;
const PENDING = { key: "ING-PEND", repo: "fixture-org/ing-pending", owner_github_id: "1005" } as const;
const DISCONNECTED = { key: "ING-DISC", repo: "fixture-org/ing-disc", owner_github_id: "1006" } as const;
const LINK_REPOS = [LINKED.repo, PENDING.repo, DISCONNECTED.repo] as const;

type Handler = (request: Request) => Promise<Response>;

let admin: ReturnType<typeof createAdminClient>;
let handler: Handler;
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function plain(project: string, seq = 1, evidence: string | null = "@aabbccd") {
  return {
    v: 1,
    project,
    run: "gha-100-1",
    seq,
    phase: "P01",
    task: "T02",
    step: "checks",
    status: "pass",
    at: "2026-10-17T04:00:00Z",
    evidence,
  };
}

function storedEvent() {
  return {
    ...plain("INGEST"),
    step: "build",
    usage: [
      {
        agent: "builder",
        tool: "cursor-agent",
        model: "grok-4.7-high",
        account_alias: "cursor-1",
        input: 10,
        output: 4,
        cache_read: 3,
        cache_write: 2,
        source: "measured",
      },
    ],
  };
}

function rateEvent(seq: number) {
  return { ...plain("RATE", seq), run: "gha-3-1", at: "2026-10-17T03:00:00Z" };
}

async function sign(
  repository: string,
  repositoryOwnerId: string,
  options?: { key?: CryptoKey; iss?: string; aud?: string; exp?: number; iat?: number },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ repository, repository_owner_id: repositoryOwnerId })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(options?.iss ?? issuer)
    .setAudience(options?.aud ?? TOWER)
    .setIssuedAt(options?.iat ?? now - 30)
    .setExpirationTime(options?.exp ?? now + 600)
    .sign(options?.key ?? privateKey);
}

async function post(
  target: Handler,
  body: string | Uint8Array,
  headers: Record<string, string> = {},
): Promise<Response> {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("host")) requestHeaders.set("host", HOST);
  const payload: BodyInit = typeof body === "string" ? body : new Blob([body.slice()]);
  const response = await target(
    new Request(`${TOWER}/api/ingest`, { method: "POST", headers: requestHeaders, body: payload }),
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  return response;
}

async function eventCount(key: string): Promise<number> {
  const { data: project, error } = await admin.from("projects").select("id").eq("key", key).maybeSingle();
  if (error) throw new Error(error.code ?? "project");
  if (!project) return 0;
  const { count, error: countError } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id);
  if (countError) throw new Error(countError.code ?? "events");
  return count ?? 0;
}

async function rejectionCount(reason?: string): Promise<number> {
  let query = admin.from("event_rejections").select("reason", { count: "exact", head: true });
  if (reason) query = query.eq("reason", reason);
  const { count, error } = await query;
  if (error) throw new Error(error.code ?? "rejections");
  return count ?? 0;
}

async function removeLinkFixtures(): Promise<void> {
  const found = await admin.from("link_requests").select("id").in("repository", [...LINK_REPOS]);
  if (found.error) throw new Error(found.error.code ?? "select-requests");
  const ids = (found.data ?? []).map((row) => row.id);
  if (ids.length > 0) {
    const audit = await admin.from("link_audit").delete().in("request_id", ids);
    if (audit.error) throw new Error(audit.error.code ?? "delete-audit");
  }
  // Requests first: an approved request's project cannot be deleted before the request (23514).
  const requests = await admin.from("link_requests").delete().in("repository", [...LINK_REPOS]);
  if (requests.error) throw new Error(requests.error.code ?? "delete-requests");
  const projects = await admin.from("projects").delete().in("repo", [...LINK_REPOS]);
  if (projects.error) throw new Error(projects.error.code ?? "delete-projects");
}

async function insertPendingRequest(repository: string, ownerGithubId: string, proposedKey: string): Promise<string> {
  const { data, error } = await admin
    .from("link_requests")
    .insert({
      repository,
      owner_github_id: ownerGithubId,
      proposed_key: proposedKey,
      engine_version: "0.2.0",
      contract_version: "v1",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.code ?? "insert-request");
  return data.id;
}

async function expectUntouched(status: number, body: unknown, run: () => Promise<Response>) {
  const before = await rejectionCount();
  const response = await run();
  expect(response.status).toBe(status);
  if (body === null) expect(await response.text()).toBe("");
  else {
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
    expect(await response.json()).toEqual(body);
  }
  expect(await rejectionCount()).toBe(before);
}

describe("U-T02-3 createIngestHandler", () => {
  beforeAll(async () => {
    const keys = await generateKeyPair("RS256");
    privateKey = keys.privateKey;
    const other = await generateKeyPair("RS256");
    otherPrivateKey = other.privateKey;
    const publicJwk = await exportJWK(keys.publicKey);
    publicJwk.alg = "RS256";
    handler = createIngestHandler({ jwks: createLocalJWKSet({ keys: [publicJwk] }) });
    admin = createAdminClient();
    const keysToRemove = PROJECTS.map((project) => project.key);
    const { error: removeError } = await admin.from("projects").delete().in("key", keysToRemove);
    if (removeError) throw new Error(removeError.code ?? "delete");
    const { error: insertError } = await admin.from("projects").insert(PROJECTS.map((project) => ({ ...project })));
    if (insertError) throw new Error(insertError.code ?? "insert");
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("projects").delete().in("key", PROJECTS.map((project) => project.key));
  });

  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
    process.env.TOWER_URL = TOWER;
  });

  it("answers 404 when the server is not production", async () => {
    process.env.VERCEL_ENV = "preview";
    await expectUntouched(404, null, () => post(handler, JSON.stringify(plain("INGEST"))));
  });

  it("answers 404 when the host does not match TOWER_URL", async () => {
    await expectUntouched(404, null, () => post(handler, JSON.stringify(plain("INGEST")), { host: "localhost:1" }));
  });

  it("answers 404 when TOWER_URL is unset or invalid", async () => {
    delete process.env.TOWER_URL;
    await expectUntouched(404, null, () => post(handler, JSON.stringify(plain("INGEST"))));
    process.env.TOWER_URL = "not-a-url";
    await expectUntouched(404, null, () => post(handler, JSON.stringify(plain("INGEST"))));
  });

  it("answers 413 for a body over 2048 bytes", async () => {
    await expectUntouched(413, { error: "too_large" }, () =>
      post(handler, "{}", { "content-length": "2049" }),
    );
    await expectUntouched(413, { error: "too_large" }, () => post(handler, new Uint8Array(2049)));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(2049));
        controller.close();
      },
    });
    await expectUntouched(413, { error: "too_large" }, async () => {
      const response = await handler(
        new Request(`${TOWER}/api/ingest`, {
          method: "POST",
          headers: { host: HOST, "content-length": "10" },
          body: stream,
          duplex: "half",
        } as RequestInit),
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("set-cookie")).toBeNull();
      return response;
    });
  });

  it("answers 400 for a body of exactly 2048 bytes that is not an event", async () => {
    await expectUntouched(400, { error: "schema" }, () => post(handler, "x".repeat(2048)));
  });

  it("answers 400 for bad JSON and a schema miss", async () => {
    await expectUntouched(400, { error: "schema" }, () => post(handler, "{"));
    await expectUntouched(400, { error: "schema" }, () => post(handler, JSON.stringify({ v: 2 })));
  });

  it("answers 401 no_token and stores only the reason", async () => {
    const before = await eventCount("INGEST");
    const reasons = await rejectionCount("no_token");
    const response = await post(handler, JSON.stringify(plain("INGEST")));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "no_token" });
    expect(await eventCount("INGEST")).toBe(before);
    expect(await rejectionCount("no_token")).toBe(reasons + 1);
  });

  it.each(["expired", "bad_signature", "bad_issuer", "bad_audience"] as const)(
    "answers 401 %s and leaves events unchanged",
    async (reason) => {
      const now = Math.floor(Date.now() / 1000);
      const token = await sign("fixture-org/ingest-repo", "1001", {
        key: reason === "bad_signature" ? otherPrivateKey : privateKey,
        iss: reason === "bad_issuer" ? "http://localhost:3998" : issuer,
        aud: reason === "bad_audience" ? "http://localhost:3997" : TOWER,
        iat: reason === "expired" ? now - 120 : now - 30,
        exp: reason === "expired" ? now - 60 : now + 600,
      });
      const before = await eventCount("INGEST");
      const reasons = await rejectionCount(reason);
      const response = await post(handler, JSON.stringify(plain("INGEST", 2)), {
        authorization: `Bearer ${token}`,
      });
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type") ?? "").toContain("application/json");
      expect(await response.json()).toEqual({ error: reason });
      expect(await eventCount("INGEST")).toBe(before);
      expect(await rejectionCount(reason)).toBe(reasons + 1);
    },
  );

  it("answers 401 repo_not_registered when the claim does not match the project", async () => {
    const token = await sign("fixture-org/other-repo", "1003");
    const before = await eventCount("OWNED");
    const reasons = await rejectionCount("repo_not_registered");
    const response = await post(handler, JSON.stringify(plain("OWNED")), {
      authorization: `Bearer ${token}`,
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "repo_not_registered" });
    expect(await eventCount("OWNED")).toBe(before);
    expect(await rejectionCount("repo_not_registered")).toBe(reasons + 1);
  });

  it("answers 401 owner_mismatch when the owner claim does not match", async () => {
    const token = await sign("fixture-org/owned-repo", "9999");
    const before = await eventCount("OWNED");
    const reasons = await rejectionCount("owner_mismatch");
    const response = await post(handler, JSON.stringify(plain("OWNED")), {
      authorization: `Bearer ${token}`,
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "owner_mismatch" });
    expect(await eventCount("OWNED")).toBe(before);
    expect(await rejectionCount("owner_mismatch")).toBe(reasons + 1);
  });

  it("answers 503 with an empty body and no rejection when the key set is unavailable", async () => {
    const timingOut: JWTVerifyGetKey = () => {
      throw new errors.JWKSTimeout();
    };
    const unavailable = createIngestHandler({ jwks: timingOut });
    const token = await sign("fixture-org/ingest-repo", "1001");
    const beforeEvents = await eventCount("INGEST");
    const beforeReasons = await rejectionCount();
    const response = await post(unavailable, JSON.stringify(plain("INGEST", 3)), {
      authorization: `Bearer ${token}`,
    });
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(await eventCount("INGEST")).toBe(beforeEvents);
    expect(await rejectionCount()).toBe(beforeReasons);
  });

  it("stores a valid event, then duplicate, then conflict", async () => {
    const token = await sign("fixture-org/ingest-repo", "1001");
    const headers = { authorization: `Bearer ${token}` };
    const body = JSON.stringify(storedEvent());
    const stored = await post(handler, body, headers);
    expect(stored.status).toBe(200);
    expect(stored.headers.get("content-type") ?? "").toContain("application/json");
    expect(await stored.json()).toEqual({ stored: true, duplicate: false });

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id")
      .eq("key", "INGEST")
      .single();
    if (projectError) throw new Error(projectError.code ?? "project");
    const { data: rows, error: rowError } = await admin
      .from("events")
      .select("id, origin, source, evidence, seq, body_hash")
      .eq("project_id", project.id)
      .eq("seq", 1);
    if (rowError) throw new Error(rowError.code ?? "events");
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({ origin: "reported", source: "ci", evidence: "@aabbccd", seq: 1 });
    const eventId = rows?.[0]?.id;
    const hash = rows?.[0]?.body_hash;
    const { data: usage, error: usageError } = await admin
      .from("event_usage")
      .select("agent, tool, model, account_alias, input, output, cache_read, cache_write, source")
      .eq("event_id", eventId ?? -1);
    if (usageError) throw new Error(usageError.code ?? "usage");
    expect(usage).toEqual([
      {
        agent: "builder",
        tool: "cursor-agent",
        model: "grok-4.7-high",
        account_alias: "cursor-1",
        input: 10,
        output: 4,
        cache_read: 3,
        cache_write: 2,
        source: "measured",
      },
    ]);

    const duplicate = await post(handler, body, headers);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ stored: false, duplicate: true });

    const conflictsBefore = await rejectionCount("duplicate_conflict");
    const conflict = await post(handler, JSON.stringify({ ...storedEvent(), evidence: "@bbccdde" }), headers);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "duplicate_conflict" });
    const { data: after, error: afterError } = await admin
      .from("events")
      .select("evidence, body_hash")
      .eq("id", eventId ?? -1)
      .single();
    if (afterError) throw new Error(afterError.code ?? "events");
    expect(after).toEqual({ evidence: "@aabbccd", body_hash: hash });
    expect(await rejectionCount("duplicate_conflict")).toBe(conflictsBefore + 1);
    expect(await eventCount("INGEST")).toBe(1);
  });

  it("answers 429 when the project already has 60 events in a minute", async () => {
    for (let seq = 1; seq <= 60; seq += 1) {
      const { data, error } = await admin.rpc("ingest_event", { payload: asJson(rateEvent(seq)), src: "ci" });
      if (error || !data || typeof data !== "object" || Array.isArray(data) || data.result !== "stored") {
        throw new Error(error?.code ?? "not-stored");
      }
    }
    expect(await eventCount("RATE")).toBe(60);
    const token = await sign("fixture-org/rate-repo", "1002");
    const response = await post(handler, JSON.stringify(rateEvent(61)), {
      authorization: `Bearer ${token}`,
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
    expect(await eventCount("RATE")).toBe(60);
  }, 60_000);

  describe("link-request refusals", () => {
    beforeAll(async () => {
      await removeLinkFixtures();

      const linkedId = await insertPendingRequest(LINKED.repo, LINKED.owner_github_id, LINKED.key);
      const approved = await admin.rpc("approve_link_request", { p_request: linkedId });
      if (approved.error) throw new Error(approved.error.code ?? "approve");
      expect(approved.data).toEqual({ result: "approved", key: LINKED.key });

      await insertPendingRequest(PENDING.repo, PENDING.owner_github_id, PENDING.key);
      const pendingProject = await admin.from("projects").select("id").eq("repo", PENDING.repo).maybeSingle();
      if (pendingProject.error) throw new Error(pendingProject.error.code ?? "pending-project");
      expect(pendingProject.data).toBeNull();

      const disconnectedId = await insertPendingRequest(
        DISCONNECTED.repo,
        DISCONNECTED.owner_github_id,
        DISCONNECTED.key,
      );
      const approvedDisconnected = await admin.rpc("approve_link_request", { p_request: disconnectedId });
      if (approvedDisconnected.error) throw new Error(approvedDisconnected.error.code ?? "approve");
      expect(approvedDisconnected.data).toEqual({ result: "approved", key: DISCONNECTED.key });
      const declined = await admin.rpc("decline_link_request", { p_request: disconnectedId });
      if (declined.error) throw new Error(declined.error.code ?? "decline");
      expect(declined.data).toEqual({ result: "declined" });
      const disconnected = await admin
        .from("link_requests")
        .select("state, project_id")
        .eq("id", disconnectedId)
        .single();
      if (disconnected.error || !disconnected.data.project_id) throw new Error(disconnected.error?.code ?? "disconnected");
      expect(disconnected.data.state).toBe("declined");
    });

    afterAll(async () => {
      await removeLinkFixtures();
    });

    it("stores an event for a project linked by an approved request", async () => {
      const before = await eventCount(LINKED.key);
      const reasons = await rejectionCount();
      const token = await sign(LINKED.repo, LINKED.owner_github_id);
      const response = await post(handler, JSON.stringify(plain(LINKED.key)), {
        authorization: `Bearer ${token}`,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ stored: true, duplicate: false });
      expect(await eventCount(LINKED.key)).toBe(before + 1);
      expect(await rejectionCount()).toBe(reasons);
    });

    it("answers 401 repo_not_registered for a repository with only a pending request and no project", async () => {
      const before = await eventCount(PENDING.key);
      const reasons = await rejectionCount("repo_not_registered");
      const token = await sign(PENDING.repo, PENDING.owner_github_id);
      const response = await post(handler, JSON.stringify(plain(PENDING.key)), {
        authorization: `Bearer ${token}`,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "repo_not_registered" });
      expect(await eventCount(PENDING.key)).toBe(before);
      expect(await rejectionCount("repo_not_registered")).toBe(reasons + 1);
      const project = await admin.from("projects").select("id").eq("repo", PENDING.repo).maybeSingle();
      if (project.error) throw new Error(project.error.code ?? "project");
      expect(project.data).toBeNull();
    });

    it("answers 401 repo_not_registered for a disconnected project and stores no event", async () => {
      const before = await eventCount(DISCONNECTED.key);
      const reasons = await rejectionCount("repo_not_registered");
      const token = await sign(DISCONNECTED.repo, DISCONNECTED.owner_github_id);
      const response = await post(handler, JSON.stringify(plain(DISCONNECTED.key)), {
        authorization: `Bearer ${token}`,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "repo_not_registered" });
      expect(await eventCount(DISCONNECTED.key)).toBe(before);
      expect(await rejectionCount("repo_not_registered")).toBe(reasons + 1);
    });
  });
});
