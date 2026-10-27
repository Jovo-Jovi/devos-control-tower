import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Json } from "@/lib/supabase/database.types";

vi.mock("server-only", () => ({}));

const { issuer } = await import("../../contract/oidc");
const { createLinkHandler } = await import("./link");
const { createIngestHandler } = await import("./ingest");
const { approveLinkRequest, declineLinkRequest, deleteLinkRequest, exportLinkRequest } = await import(
  "./link-requests"
);
const { createAdminClient } = await import("./admin");

const TOWER = "http://localhost:3999";
const HOST = "localhost:3999";
const OWNER = "1201";
const KEY = "FLOW-ONE";
const REPOS = ["fixture-flow/one", "fixture-flow/two", "fixture-flow/three"] as const;
const KEYS = ["FLOW-ONE", "FLOW-ONE-2"] as const;

type Handler = (request: Request) => Promise<Response>;

let admin: ReturnType<typeof createAdminClient>;
let linkHandler: Handler;
let ingestHandler: Handler;
let privateKey: CryptoKey;
const recordedIds: string[] = [];
let oneId = "";
let twoId = "";
let threeId = "";

function linkBody(key: string) {
  return { v: 1, key, engine: "0.2.0", contract: "v1" };
}

function flowEvent(seq: number) {
  return {
    v: 1,
    project: KEY,
    run: "gha-100-1",
    seq,
    phase: "P01",
    task: "T02",
    step: "build",
    status: "pass",
    at: "2026-10-17T04:00:00Z",
    evidence: "@aabbccd",
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

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function sign(repository: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ repository, repository_owner_id: OWNER })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(issuer)
    .setAudience(TOWER)
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 600)
    .sign(privateKey);
}

async function post(target: Handler, path: string, body: string, headers: Record<string, string> = {}): Promise<Response> {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("host")) requestHeaders.set("host", HOST);
  const response = await target(
    new Request(`${TOWER}${path}`, { method: "POST", headers: requestHeaders, body }),
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("content-type") ?? "").toContain("application/json");
  return response;
}

async function requestRow(repository: string): Promise<{ id: string } | null> {
  const { data, error } = await admin.from("link_requests").select("id").eq("repository", repository).maybeSingle();
  if (error) throw new Error(error.code ?? "request");
  return data;
}

async function remember(repository: string): Promise<string> {
  const row = await requestRow(repository);
  if (!row) throw new Error("missing-request");
  recordedIds.push(row.id);
  return row.id;
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

async function rejectionCount(reason: string): Promise<number> {
  const { count, error } = await admin
    .from("event_rejections")
    .select("reason", { count: "exact", head: true })
    .eq("reason", reason);
  if (error) throw new Error(error.code ?? "rejections");
  return count ?? 0;
}

async function removeFixtures(): Promise<void> {
  const found = await admin.from("link_requests").select("id").in("repository", [...REPOS]);
  if (found.error) throw new Error(found.error.code ?? "select-requests");
  const ids = [...new Set([...recordedIds, ...(found.data ?? []).map((row) => row.id)])];
  if (ids.length > 0) {
    const audit = await admin.from("link_audit").delete().in("request_id", ids);
    if (audit.error) throw new Error(audit.error.code ?? "delete-audit");
  }
  const requests = await admin.from("link_requests").delete().in("repository", [...REPOS]);
  if (requests.error) throw new Error(requests.error.code ?? "delete-requests");
  const byKey = await admin.from("projects").delete().in("key", [...KEYS]);
  if (byKey.error) throw new Error(byKey.error.code ?? "delete-projects");
  const byRepo = await admin.from("projects").delete().in("repo", [...REPOS]);
  if (byRepo.error) throw new Error(byRepo.error.code ?? "delete-repos");
}

function exportedDocument(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("exported");
  return value;
}

describe("link flow", () => {
  beforeAll(async () => {
    const keys = await generateKeyPair("RS256");
    privateKey = keys.privateKey;
    const publicJwk = await exportJWK(keys.publicKey);
    publicJwk.alg = "RS256";
    const jwks = createLocalJWKSet({ keys: [publicJwk] });
    linkHandler = createLinkHandler({ jwks });
    ingestHandler = createIngestHandler({ jwks });
    admin = createAdminClient();
    process.env.VERCEL_ENV = "production";
    process.env.TOWER_URL = TOWER;
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

  it("links one as pending", async () => {
    const token = await sign("fixture-flow/one");
    const response = await post(linkHandler, "/api/link", JSON.stringify(linkBody(KEY)), authHeaders(token));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "pending" });
    oneId = await remember("fixture-flow/one");
  }, 20_000);

  it("approves one as FLOW-ONE", async () => {
    expect(await approveLinkRequest(oneId)).toEqual({ kind: "approved", key: "FLOW-ONE" });
  }, 20_000);

  it("answers linked for one", async () => {
    const token = await sign("fixture-flow/one");
    const response = await post(linkHandler, "/api/link", JSON.stringify(linkBody(KEY)), authHeaders(token));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "linked", key: "FLOW-ONE" });
  }, 20_000);

  it("stores one event for FLOW-ONE", async () => {
    const token = await sign("fixture-flow/one");
    const response = await post(
      ingestHandler,
      "/api/ingest",
      JSON.stringify(flowEvent(1)),
      authHeaders(token),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stored: true, duplicate: false });
  }, 20_000);

  it("exports the stored step event with usage and observations", async () => {
    const exported = await exportLinkRequest(oneId);
    expect(exported.kind).toBe("exported");
    if (exported.kind !== "exported") throw new Error("exported");
    const document = exportedDocument(exported.document);
    const stepEvents = document.step_events;
    const usage = document.event_usage;
    const observations = document.observations;
    expect(Array.isArray(stepEvents)).toBe(true);
    expect(Array.isArray(usage)).toBe(true);
    expect(Array.isArray(observations)).toBe(true);
    if (!Array.isArray(stepEvents)) throw new Error("step-events");
    expect(stepEvents).toHaveLength(1);
  }, 20_000);

  it("declines one", async () => {
    expect(await declineLinkRequest(oneId)).toEqual({ kind: "declined" });
  }, 20_000);

  it("answers declined for one", async () => {
    const token = await sign("fixture-flow/one");
    const response = await post(linkHandler, "/api/link", JSON.stringify(linkBody(KEY)), authHeaders(token));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ status: "declined" });
  }, 20_000);

  it("refuses a new event for the disconnected project", async () => {
    const before = await eventCount(KEY);
    const reasons = await rejectionCount("repo_not_registered");
    const token = await sign("fixture-flow/one");
    const response = await post(
      ingestHandler,
      "/api/ingest",
      JSON.stringify(flowEvent(2)),
      authHeaders(token),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "repo_not_registered" });
    expect(await rejectionCount("repo_not_registered")).toBe(reasons + 1);
    expect(await eventCount(KEY)).toBe(before);
  }, 20_000);

  it("approves two with the next free key", async () => {
    const token = await sign("fixture-flow/two");
    const response = await post(linkHandler, "/api/link", JSON.stringify(linkBody(KEY)), authHeaders(token));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "pending" });
    twoId = await remember("fixture-flow/two");
    expect(await approveLinkRequest(twoId)).toEqual({ kind: "approved", key: "FLOW-ONE-2" });
  }, 20_000);

  it("leaves three pending when the project is already linked", async () => {
    const token = await sign("fixture-flow/three");
    const response = await post(linkHandler, "/api/link", JSON.stringify(linkBody(KEY)), authHeaders(token));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "pending" });
    threeId = await remember("fixture-flow/three");
    const updated = await admin
      .from("projects")
      .update({ repo: "fixture-flow/three" })
      .eq("key", "FLOW-ONE-2")
      .select("id");
    if (updated.error) throw new Error(updated.error.code ?? "update-repo");
    if (updated.data.length !== 1) throw new Error("update-repo");
    expect(await approveLinkRequest(threeId)).toEqual({ kind: "project_linked" });
    const row = await admin.from("link_requests").select("state, project_id").eq("id", threeId).maybeSingle();
    if (row.error) throw new Error(row.error.code ?? "three");
    expect(row.data).toEqual({ state: "pending", project_id: null });
  }, 20_000);

  it("deletes one and its project", async () => {
    expect(await deleteLinkRequest(oneId)).toEqual({ kind: "deleted", projectDeleted: true });
    const project = await admin.from("projects").select("id").eq("key", "FLOW-ONE").maybeSingle();
    if (project.error) throw new Error(project.error.code ?? "project");
    expect(project.data).toBeNull();
  }, 20_000);
});
