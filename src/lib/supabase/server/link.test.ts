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
const { createLinkHandler } = await import("./link");
const { createAdminClient } = await import("./admin");

const TOWER = "http://localhost:3999";
const HOST = "localhost:3999";
const REPOS = [
  "fixture-lk/padded",
  "fixture-lk/fresh",
  "fixture-lk/approve",
  "fixture-lk/direct",
  "fixture-lk/decline",
  "fixture-lk/schema",
  "fixture-lk/from-body",
  "fixture-lk/cap-a",
  "fixture-lk/cap-b",
  "fixture-lk/cap-c",
  "fixture-lk/cap-d",
  "fixture-lk/other",
  "fixture-lk/auth",
  "fixture-lk/claims",
] as const;

type Handler = (request: Request) => Promise<Response>;

let admin: ReturnType<typeof createAdminClient>;
let handler: Handler;
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

function linkBody(key: string, engine = "0.2.0", contract = "v1") {
  return { v: 1, key, engine, contract };
}

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
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
    new Request(`${TOWER}/api/link`, { method: "POST", headers: requestHeaders, body: payload }),
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("content-type") ?? "").toContain("application/json");
  return response;
}

async function rejectionCount(reason?: string): Promise<number> {
  let query = admin.from("event_rejections").select("reason", { count: "exact", head: true });
  if (reason) query = query.eq("reason", reason);
  const { count, error } = await query;
  if (error) throw new Error(error.code ?? "rejections");
  return count ?? 0;
}

async function requestCount(): Promise<number> {
  const { count, error } = await admin.from("link_requests").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.code ?? "requests");
  return count ?? 0;
}

async function requestedAuditCount(): Promise<number> {
  const { count, error } = await admin
    .from("link_audit")
    .select("id", { count: "exact", head: true })
    .eq("action", "requested");
  if (error) throw new Error(error.code ?? "audit");
  return count ?? 0;
}

async function requestRow(repository: string) {
  const { data, error } = await admin
    .from("link_requests")
    .select("id, repository, owner_github_id, proposed_key, engine_version, state")
    .eq("repository", repository)
    .maybeSingle();
  if (error) throw new Error(error.code ?? "request");
  return data;
}

async function removeFixtures(): Promise<void> {
  const found = await admin.from("link_requests").select("id").in("repository", [...REPOS]);
  if (found.error) throw new Error(found.error.code ?? "select-requests");
  const ids = (found.data ?? []).map((row) => row.id);
  if (ids.length > 0) {
    const audit = await admin.from("link_audit").delete().in("request_id", ids);
    if (audit.error) throw new Error(audit.error.code ?? "delete-audit");
  }
  // Requests first: an approved request's project cannot be deleted before the request (23514).
  const requests = await admin.from("link_requests").delete().in("repository", [...REPOS]);
  if (requests.error) throw new Error(requests.error.code ?? "delete-requests");
  const projects = await admin.from("projects").delete().in("repo", [...REPOS]);
  if (projects.error) throw new Error(projects.error.code ?? "delete-projects");
}

async function expectNoRow(status: number, body: unknown, run: () => Promise<Response>): Promise<void> {
  const rejections = await rejectionCount();
  const requests = await requestCount();
  const response = await run();
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual(body);
  expect(await rejectionCount()).toBe(rejections);
  expect(await requestCount()).toBe(requests);
}

async function expectRejection(reason: string, run: () => Promise<Response>): Promise<void> {
  const all = await rejectionCount();
  const reasons = await rejectionCount(reason);
  const requests = await requestCount();
  const response = await run();
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: reason });
  expect(await rejectionCount()).toBe(all + 1);
  expect(await rejectionCount(reason)).toBe(reasons + 1);
  expect(await requestCount()).toBe(requests);
}

describe("createLinkHandler", () => {
  beforeAll(async () => {
    const keys = await generateKeyPair("RS256");
    privateKey = keys.privateKey;
    const other = await generateKeyPair("RS256");
    otherPrivateKey = other.privateKey;
    const publicJwk = await exportJWK(keys.publicKey);
    publicJwk.alg = "RS256";
    handler = createLinkHandler({ jwks: createLocalJWKSet({ keys: [publicJwk] }) });
    admin = createAdminClient();
    await removeFixtures();
  }, 30_000);

  afterAll(async () => {
    if (!admin) return;
    await removeFixtures();
  }, 30_000);

  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
    process.env.TOWER_URL = TOWER;
  });

  it("answers 404 not_found off the production host and writes no row", async () => {
    process.env.VERCEL_ENV = "preview";
    await expectNoRow(404, { error: "not_found" }, () => post(handler, JSON.stringify(linkBody("LK-PAD"))));

    process.env.VERCEL_ENV = "production";
    await expectNoRow(404, { error: "not_found" }, () =>
      post(handler, JSON.stringify(linkBody("LK-PAD")), { host: "localhost:1" }),
    );

    delete process.env.TOWER_URL;
    await expectNoRow(404, { error: "not_found" }, () => post(handler, JSON.stringify(linkBody("LK-PAD"))));

    process.env.TOWER_URL = "not-a-url";
    await expectNoRow(404, { error: "not_found" }, () => post(handler, JSON.stringify(linkBody("LK-PAD"))));
  }, 20_000);

  it("answers 401 no_token and stores only that reason", async () => {
    await expectRejection("no_token", () => post(handler, JSON.stringify(linkBody("LK-AUTH"))));
  }, 20_000);

  it.each(["expired", "bad_signature", "bad_issuer", "bad_audience"] as const)(
    "answers 401 %s and stores that reason",
    async (reason) => {
      const now = Math.floor(Date.now() / 1000);
      const token = await sign("fixture-lk/auth", "1190", {
        key: reason === "bad_signature" ? otherPrivateKey : privateKey,
        iss: reason === "bad_issuer" ? "http://localhost:3998" : issuer,
        aud: reason === "bad_audience" ? "http://localhost:3997" : TOWER,
        iat: reason === "expired" ? now - 120 : now - 30,
        exp: reason === "expired" ? now - 60 : now + 600,
      });
      await expectRejection(reason, () =>
        post(handler, JSON.stringify(linkBody("LK-AUTH")), authHeaders(token)),
      );
    },
    20_000,
  );

  it("answers 401 bad_signature when the claims are not a repository and an owner id", async () => {
    const slash = await sign("no-slash", "1190");
    await expectRejection("bad_signature", () =>
      post(handler, JSON.stringify(linkBody("LK-AUTH")), authHeaders(slash)),
    );
    const owner = await sign("fixture-lk/claims", "abc");
    await expectRejection("bad_signature", () =>
      post(handler, JSON.stringify(linkBody("LK-AUTH")), authHeaders(owner)),
    );
  }, 20_000);

  it("answers 401 no_token when the token is missing and the body is bad", async () => {
    await expectRejection("no_token", () => post(handler, "x".repeat(1025)));
  }, 20_000);

  it("answers 503 unavailable and writes no row when the key set times out", async () => {
    const timingOut: JWTVerifyGetKey = () => {
      throw new errors.JWKSTimeout();
    };
    const unavailable = createLinkHandler({ jwks: timingOut });
    const token = await sign("fixture-lk/auth", "1190");
    await expectNoRow(503, { error: "unavailable" }, () =>
      post(unavailable, JSON.stringify(linkBody("LK-AUTH")), authHeaders(token)),
    );
  }, 20_000);

  it("answers 400 schema and writes no row for a body the schema refuses", async () => {
    const token = await sign("fixture-lk/schema", "1106");
    const headers = authHeaders(token);
    const good = linkBody("LK-SCHEMA");
    await expectNoRow(400, { error: "schema" }, () =>
      post(handler, JSON.stringify({ ...good, repository: "fixture-lk/from-body" }), headers),
    );
    await expectNoRow(400, { error: "schema" }, () => post(handler, JSON.stringify({ ...good, v: 2 }), headers));
    await expectNoRow(400, { error: "schema" }, () =>
      post(handler, JSON.stringify({ ...good, key: "lower" }), headers),
    );
    await expectNoRow(400, { error: "schema" }, () =>
      post(handler, JSON.stringify({ ...good, engine: "e".repeat(33) }), headers),
    );
    await expectNoRow(400, { error: "schema" }, () =>
      post(handler, JSON.stringify(good), { ...headers, "content-length": "1025" }),
    );
    await expectNoRow(400, { error: "schema" }, () => post(handler, "{", headers));

    const payload = JSON.stringify(good);
    const oversized = payload + " ".repeat(1025 - new TextEncoder().encode(payload).byteLength);
    expect(new TextEncoder().encode(oversized).byteLength).toBe(1025);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(oversized));
        controller.close();
      },
    });
    await expectNoRow(400, { error: "schema" }, async () => {
      const response = await handler(
        new Request(`${TOWER}/api/link`, {
          method: "POST",
          headers: { host: HOST, "content-length": "10", authorization: `Bearer ${token}` },
          body: stream,
          duplex: "half",
        } as RequestInit),
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("content-type") ?? "").toContain("application/json");
      return response;
    });
  }, 30_000);

  it("reads a valid body padded with spaces to exactly 1024 bytes", async () => {
    const payload = JSON.stringify(linkBody("LK-PAD"));
    const padded = payload + " ".repeat(1024 - new TextEncoder().encode(payload).byteLength);
    expect(new TextEncoder().encode(padded).byteLength).toBe(1024);
    const requests = await requestCount();
    const rejections = await rejectionCount();
    const token = await sign("fixture-lk/padded", "1101");
    const response = await post(handler, padded, authHeaders(token));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "pending" });
    expect(await requestCount()).toBe(requests + 1);
    expect(await rejectionCount()).toBe(rejections);
    expect(await requestRow("fixture-lk/padded")).toMatchObject({
      repository: "fixture-lk/padded",
      owner_github_id: "1101",
      proposed_key: "LK-PAD",
    });
  }, 20_000);

  it("stores a new repository as pending, then keeps the proposed key when the engine changes", async () => {
    const token = await sign("fixture-lk/fresh", "1102");
    const headers = authHeaders(token);
    const requests = await requestCount();
    const audits = await requestedAuditCount();
    const rejections = await rejectionCount();

    const created = await post(handler, JSON.stringify(linkBody("LK-FRESH", "0.2.0")), headers);
    expect(created.status).toBe(202);
    expect(await created.json()).toEqual({ status: "pending" });
    expect(await requestCount()).toBe(requests + 1);
    expect(await requestedAuditCount()).toBe(audits + 1);
    expect(await requestRow("fixture-lk/fresh")).toMatchObject({
      repository: "fixture-lk/fresh",
      owner_github_id: "1102",
      proposed_key: "LK-FRESH",
      engine_version: "0.2.0",
      state: "pending",
    });

    const repeated = await post(handler, JSON.stringify(linkBody("LK-FRESH", "0.3.0")), headers);
    expect(repeated.status).toBe(202);
    expect(await repeated.json()).toEqual({ status: "pending" });
    expect(await requestCount()).toBe(requests + 1);
    expect(await requestedAuditCount()).toBe(audits + 1);
    expect(await requestRow("fixture-lk/fresh")).toMatchObject({
      repository: "fixture-lk/fresh",
      owner_github_id: "1102",
      proposed_key: "LK-FRESH",
      engine_version: "0.3.0",
    });
    expect(await rejectionCount()).toBe(rejections);
  }, 20_000);

  it("answers linked with the project key after approve_link_request", async () => {
    const token = await sign("fixture-lk/approve", "1103");
    const headers = authHeaders(token);
    const requests = await requestCount();
    const rejections = await rejectionCount();

    const created = await post(handler, JSON.stringify(linkBody("LK-APPROVE")), headers);
    expect(created.status).toBe(202);
    expect(await created.json()).toEqual({ status: "pending" });

    const row = await requestRow("fixture-lk/approve");
    if (!row) throw new Error("missing-request");
    const approved = await admin.rpc("approve_link_request", { p_request: row.id });
    if (approved.error) throw new Error(approved.error.code ?? "approve");
    expect(approved.data).toEqual({ result: "approved", key: "LK-APPROVE" });

    const linked = await post(handler, JSON.stringify(linkBody("LK-APPROVE")), headers);
    expect(linked.status).toBe(200);
    expect(await linked.json()).toEqual({ status: "linked", key: "LK-APPROVE" });
    expect(await requestCount()).toBe(requests + 1);
    expect(await rejectionCount()).toBe(rejections);
  }, 20_000);

  it("answers linked with the key of a project that has no request", async () => {
    const inserted = await admin.from("projects").insert({
      key: "LK-DIRECT",
      repo: "fixture-lk/direct",
      owner_github_id: "1104",
    });
    if (inserted.error) throw new Error(inserted.error.code ?? "insert-project");
    const requests = await requestCount();
    const rejections = await rejectionCount();
    const token = await sign("fixture-lk/direct", "1104");
    const response = await post(handler, JSON.stringify(linkBody("LK-ASK")), authHeaders(token));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "linked", key: "LK-DIRECT" });
    expect(await requestCount()).toBe(requests);
    expect(await requestRow("fixture-lk/direct")).toBeNull();
    expect(await rejectionCount()).toBe(rejections);
  }, 20_000);

  it("answers declined after decline_link_request", async () => {
    const token = await sign("fixture-lk/decline", "1105");
    const headers = authHeaders(token);
    const requests = await requestCount();
    const rejections = await rejectionCount();

    const created = await post(handler, JSON.stringify(linkBody("LK-DECLINE")), headers);
    expect(created.status).toBe(202);
    expect(await created.json()).toEqual({ status: "pending" });

    const row = await requestRow("fixture-lk/decline");
    if (!row) throw new Error("missing-request");
    const declined = await admin.rpc("decline_link_request", { p_request: row.id });
    if (declined.error) throw new Error(declined.error.code ?? "decline");
    expect(declined.data).toEqual({ result: "declined" });

    const response = await post(handler, JSON.stringify(linkBody("LK-DECLINE")), headers);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ status: "declined" });
    expect(await requestCount()).toBe(requests + 1);
    expect(await rejectionCount()).toBe(rejections);
  }, 20_000);

  it("answers 429 when an owner already has 3 pending requests and still accepts another owner", async () => {
    const inserted = await admin.from("link_requests").insert([
      {
        repository: "fixture-lk/cap-a",
        owner_github_id: "1120",
        proposed_key: "LK-CAPA",
        engine_version: "0.2.0",
        contract_version: "v1",
      },
      {
        repository: "fixture-lk/cap-b",
        owner_github_id: "1120",
        proposed_key: "LK-CAPB",
        engine_version: "0.2.0",
        contract_version: "v1",
      },
      {
        repository: "fixture-lk/cap-c",
        owner_github_id: "1120",
        proposed_key: "LK-CAPC",
        engine_version: "0.2.0",
        contract_version: "v1",
      },
    ]);
    if (inserted.error) throw new Error(inserted.error.code ?? "insert-cap");

    const requests = await requestCount();
    const audits = await requestedAuditCount();
    const rejections = await rejectionCount();
    const limitedToken = await sign("fixture-lk/cap-d", "1120");
    const limited = await post(handler, JSON.stringify(linkBody("LK-CAPD")), authHeaders(limitedToken));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    expect(await requestCount()).toBe(requests);
    expect(await requestedAuditCount()).toBe(audits);
    expect(await requestRow("fixture-lk/cap-d")).toBeNull();

    const otherToken = await sign("fixture-lk/other", "1121");
    const other = await post(handler, JSON.stringify(linkBody("LK-OTHER")), authHeaders(otherToken));
    expect(other.status).toBe(202);
    expect(await other.json()).toEqual({ status: "pending" });
    expect(await requestCount()).toBe(requests + 1);
    expect(await requestRow("fixture-lk/other")).toMatchObject({
      repository: "fixture-lk/other",
      owner_github_id: "1121",
      proposed_key: "LK-OTHER",
    });
    expect(await rejectionCount()).toBe(rejections);
  }, 20_000);

  it("answers 500 server_error when the service client cannot be created", async () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      const rejections = await rejectionCount();
      const response = await post(handler, JSON.stringify(linkBody("LK-PAD")));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "server_error" });
      expect(await rejectionCount()).toBe(rejections);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  }, 20_000);
});
