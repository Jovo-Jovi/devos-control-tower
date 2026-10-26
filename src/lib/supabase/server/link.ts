import "server-only";

import type { JWTVerifyGetKey } from "jose";
import { linkClaimsValid, parseLinkRequestBody } from "@/lib/contract/link-request";
import { jwks, verifyGithubOidc } from "@/lib/contract/oidc";
import { createAdminClient } from "@/lib/supabase/server/admin";

const BODY_LIMIT = 1024;
const PROJECT_KEY = /^[A-Z][A-Z0-9_-]{1,31}$/;

type AdminClient = ReturnType<typeof createAdminClient>;

type RejectionReason = "no_token" | "expired" | "bad_issuer" | "bad_audience" | "bad_signature";

function json(status: number, body: Record<string, string>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1] ?? null;
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

function parseBytes(bytes: Uint8Array) {
  try {
    return parseLinkRequestBody(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

async function reject(admin: AdminClient, reason: RejectionReason): Promise<Response> {
  try {
    await admin.from("event_rejections").insert({ reason });
  } catch {
    // A failed insert does not change the answer.
  }
  return json(401, { error: reason });
}

function linkAnswer(data: unknown): Response {
  if (!plainObject(data)) return json(500, { error: "server_error" });
  const result = data.result;
  if (result === "declined") return json(403, { status: "declined" });
  if (result === "pending") return json(202, { status: "pending" });
  if (result === "rate_limited") return json(429, { error: "rate_limited" });
  if (result === "linked" && typeof data.key === "string" && PROJECT_KEY.test(data.key)) {
    return json(200, { status: "linked", key: data.key });
  }
  return json(500, { error: "server_error" });
}

export function createLinkHandler(options?: {
  jwks?: JWTVerifyGetKey;
}): (request: Request) => Promise<Response> {
  const keySet = options?.jwks ?? jwks;
  return async (request) => {
    if (!productionHost(request)) return json(404, { error: "not_found" });

    let admin: AdminClient;
    try {
      admin = createAdminClient();
    } catch {
      return json(500, { error: "server_error" });
    }

    const token = bearer(request);
    if (!token) return reject(admin, "no_token");

    const verdict = await verifyGithubOidc(token, {
      audience: process.env.TOWER_URL ?? "",
      jwks: keySet,
    });
    if (!verdict.ok) {
      if (verdict.reason === "unavailable") return json(503, { error: "unavailable" });
      return reject(admin, verdict.reason);
    }

    if (!linkClaimsValid(verdict.repository, verdict.repositoryOwnerId)) {
      return reject(admin, "bad_signature");
    }

    const bytes = await readBody(request);
    if (bytes === "too_large") return json(400, { error: "schema" });

    const parsed = parseBytes(bytes);
    if (!parsed) return json(400, { error: "schema" });

    try {
      const { data, error } = await admin.rpc("request_link", {
        p_repository: verdict.repository,
        p_owner_github_id: verdict.repositoryOwnerId,
        p_proposed_key: parsed.key,
        p_engine_version: parsed.engine,
        p_contract_version: parsed.contract,
      });
      if (error) return json(500, { error: "server_error" });
      return linkAnswer(data);
    } catch {
      return json(500, { error: "server_error" });
    }
  };
}
