import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { parseWebhookObservation, type WebhookObservation } from "@/lib/contract/observation";
import { createAdminClient } from "@/lib/supabase/server/admin";

const SIGNATURE = /^sha256=[0-9a-f]{64}$/;

type AdminClient = ReturnType<typeof createAdminClient>;

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

function signatureMatches(bytes: Uint8Array, header: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return false;
  if (header === null || !SIGNATURE.test(header)) return false;
  const expected = createHmac("sha256", secret).update(bytes).digest();
  const actual = Buffer.from(header.slice("sha256=".length), "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function actorLogin(observation: WebhookObservation, ownerGithubId: string): string | null {
  if (observation.sender.bot || observation.sender.id === ownerGithubId) return observation.sender.login;
  return null;
}

async function store(
  admin: AdminClient,
  delivery: string,
  eventName: string,
  observation: WebhookObservation,
): Promise<Response> {
  const existing = await admin
    .from("webhook_deliveries")
    .select("delivery_id")
    .eq("delivery_id", delivery)
    .maybeSingle();
  if (existing.error) return empty(500);
  if (existing.data) return json(202, { stored: false });

  const project = await admin
    .from("projects")
    .select("id, owner_github_id")
    .eq("repo", observation.repository)
    .maybeSingle();
  if (project.error) return empty(500);
  if (!project.data) return json(202, { stored: false });

  const inserted = await admin
    .from("webhook_deliveries")
    .upsert(
      { delivery_id: delivery, event_name: eventName },
      { onConflict: "delivery_id", ignoreDuplicates: true },
    )
    .select("delivery_id");
  if (inserted.error) return empty(500);
  if (!inserted.data || inserted.data.length === 0) return json(202, { stored: false });

  const observed = await admin.from("observations").insert({
    project_id: project.data.id,
    sha: observation.sha,
    kind: observation.kind,
    context: observation.context,
    state: observation.state,
    at: observation.at,
    actor_login: actorLogin(observation, project.data.owner_github_id),
    payload_ref: delivery,
  });
  if (observed.error) {
    await admin.from("webhook_deliveries").delete().eq("delivery_id", delivery);
    return empty(500);
  }
  return json(202, { stored: true });
}

export function createWebhookHandler(): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!productionHost(request)) return empty(404);

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!signatureMatches(bytes, request.headers.get("x-hub-signature-256"))) {
      return json(401, { error: "bad_signature" });
    }

    const delivery = request.headers.get("x-github-delivery");
    const eventName = request.headers.get("x-github-event") ?? "";
    let observation: WebhookObservation | null = null;
    try {
      observation = parseWebhookObservation(eventName, JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      observation = null;
    }
    if (delivery === null || delivery.length === 0 || observation === null) {
      return json(202, { stored: false });
    }

    let admin: AdminClient;
    try {
      admin = createAdminClient();
    } catch {
      return empty(500);
    }

    try {
      return await store(admin, delivery, eventName, observation);
    } catch {
      return empty(500);
    }
  };
}
