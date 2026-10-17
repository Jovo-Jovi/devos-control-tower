import "server-only";

import type { JWTVerifyGetKey } from "jose";
import { jwks as githubActionsJwks, verifyGithubOidc } from "@/lib/contract/oidc";
import { parseStepEvent, type StepEvent } from "@/lib/contract/step-event";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/server/admin";

const BODY_LIMIT = 2048;

type AdminClient = ReturnType<typeof createAdminClient>;

type RejectionReason =
  | "no_token"
  | "expired"
  | "bad_issuer"
  | "bad_audience"
  | "bad_signature"
  | "repo_not_registered"
  | "owner_mismatch";

function empty(status: number): Response {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

function json(status: number, body: Record<string, string | boolean>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function productionHost(request: Request): boolean {
  if (process.env.VERCEL_ENV !== "production") return false;
  const tower = process.env.TOWER_URL;
  if (!tower) return false;
  try {
    return request.headers.get("host") === new URL(tower).host;
  } catch {
    return false;
  }
}

async function readBody(request: Request): Promise<Uint8Array | "too_large"> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^[0-9]+$/.test(declared) && Number(declared) > BODY_LIMIT) {
    return "too_large";
  }
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      if (total + value.byteLength > BODY_LIMIT) {
        await reader.cancel().catch(() => undefined);
        return "too_large";
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return new Uint8Array();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseBody(bytes: Uint8Array): StepEvent | null {
  try {
    return parseStepEvent(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1] ?? null;
}

async function reject(admin: AdminClient, reason: RejectionReason): Promise<Response> {
  try {
    await admin.from("event_rejections").insert({ reason });
  } catch {
    // A failed insert does not change the answer.
  }
  return json(401, { error: reason });
}

function eventPayload(event: StepEvent): Json {
  return JSON.parse(JSON.stringify(event)) as Json;
}

async function store(admin: AdminClient, event: StepEvent): Promise<Response> {
  const { data, error } = await admin.rpc("ingest_event", { payload: eventPayload(event), src: "ci" });
  if (error || data === null || typeof data !== "object" || Array.isArray(data) || !("result" in data)) {
    return empty(500);
  }
  if (data.result === "stored") return json(200, { stored: true, duplicate: false });
  if (data.result === "duplicate") return json(200, { stored: false, duplicate: true });
  if (data.result === "conflict") return json(409, { error: "duplicate_conflict" });
  if (data.result === "rate_limited") return json(429, { error: "rate_limited" });
  return empty(500);
}

export function createIngestHandler(options?: {
  jwks?: JWTVerifyGetKey;
}): (request: Request) => Promise<Response> {
  const keySet = options?.jwks ?? githubActionsJwks;
  return async (request) => {
    if (!productionHost(request)) return empty(404);

    const body = await readBody(request);
    if (body === "too_large") return json(413, { error: "too_large" });

    const event = parseBody(body);
    if (!event) return json(400, { error: "schema" });

    let admin: AdminClient;
    try {
      admin = createAdminClient();
    } catch {
      return empty(500);
    }

    const token = bearer(request);
    if (!token) return reject(admin, "no_token");

    const verdict = await verifyGithubOidc(token, {
      audience: process.env.TOWER_URL ?? "",
      jwks: keySet,
    });
    if (!verdict.ok) {
      if (verdict.reason === "unavailable") return empty(503);
      return reject(admin, verdict.reason);
    }

    const { data: project, error } = await admin
      .from("projects")
      .select("repo, owner_github_id")
      .eq("key", event.project)
      .maybeSingle();
    if (error) return empty(500);
    if (!project || project.repo !== verdict.repository) return reject(admin, "repo_not_registered");
    if (project.owner_github_id !== verdict.repositoryOwnerId) return reject(admin, "owner_mismatch");

    return store(admin, event);
  };
}
