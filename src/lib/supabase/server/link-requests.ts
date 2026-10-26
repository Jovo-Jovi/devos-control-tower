import "server-only";

import type { LinkRequestState, LinkRequestView } from "@/lib/link-requests/groups";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/server/admin";
import { createSessionClient } from "@/lib/supabase/server/session";

const PAGE = 1000;
const PROJECT_KEY = /^[A-Z][A-Z0-9_-]{1,31}$/;
const COLUMNS =
  "id, repository, owner_github_id, proposed_key, engine_version, contract_version, state, project_id, first_requested_at, last_requested_at, decided_at, project:projects!link_requests_project_id_fkey(key)";

export type LinkOutcome =
  | { kind: "approved"; key: string }
  | { kind: "declined" }
  | { kind: "deleted"; projectDeleted: boolean }
  | { kind: "exported"; document: Json }
  | { kind: "repo_taken" }
  | { kind: "not_pending" }
  | { kind: "not_found" }
  | { kind: "failed" };

type LinkAction = "approve" | "decline" | "delete" | "export";

function failed(): LinkOutcome {
  return { kind: "failed" };
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isState(value: unknown): value is LinkRequestState {
  return value === "pending" || value === "approved" || value === "declined";
}

function projectKeyOf(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  const source = Array.isArray(value) ? value[0] : value;
  if (source === undefined || source === null) return null;
  if (!plainObject(source)) return undefined;
  const key = source.key;
  if (key === null || key === undefined) return null;
  return typeof key === "string" && key.length > 0 ? key : undefined;
}

function viewOf(row: unknown): LinkRequestView | null {
  if (!plainObject(row)) return null;
  const id = text(row.id);
  const repository = text(row.repository);
  const ownerGithubId = text(row.owner_github_id);
  const proposedKey = text(row.proposed_key);
  const engineVersion = text(row.engine_version);
  const contractVersion = text(row.contract_version);
  const firstRequestedAt = text(row.first_requested_at);
  const lastRequestedAt = text(row.last_requested_at);
  if (!id || !repository || !ownerGithubId || !proposedKey || !engineVersion || !contractVersion) return null;
  if (!firstRequestedAt || !lastRequestedAt || !isState(row.state)) return null;
  if (row.decided_at !== null && typeof row.decided_at !== "string") return null;
  const projectKey = projectKeyOf(row.project);
  if (projectKey === undefined) return null;
  return {
    id,
    repository,
    ownerGithubId,
    proposedKey,
    engineVersion,
    contractVersion,
    state: row.state,
    projectKey,
    firstRequestedAt,
    lastRequestedAt,
    decidedAt: row.decided_at,
  };
}

function exportedDocument(data: Record<string, unknown>): Json | null {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "result") rest[key] = value;
  }
  try {
    const parsed: unknown = JSON.parse(JSON.stringify(rest));
    if (!plainObject(parsed)) return null;
    return parsed as Json;
  } catch {
    return null;
  }
}

export function linkOutcome(action: LinkAction, response: { data: unknown; error: unknown }): LinkOutcome {
  if (response.error !== null) return failed();
  if (!plainObject(response.data)) return failed();
  const result = response.data.result;

  if (action === "approve") {
    if (result === "approved") {
      const key = response.data.key;
      if (typeof key !== "string" || !PROJECT_KEY.test(key)) return failed();
      return { kind: "approved", key };
    }
    if (result === "repo_taken") return { kind: "repo_taken" };
    if (result === "not_pending") return { kind: "not_pending" };
    if (result === "not_found") return { kind: "not_found" };
    return failed();
  }

  if (action === "decline") {
    if (result === "declined") return { kind: "declined" };
    if (result === "not_pending") return { kind: "not_pending" };
    if (result === "not_found") return { kind: "not_found" };
    return failed();
  }

  if (action === "delete") {
    if (result === "deleted") {
      if (typeof response.data.project_deleted !== "boolean") return failed();
      return { kind: "deleted", projectDeleted: response.data.project_deleted };
    }
    if (result === "not_found") return { kind: "not_found" };
    return failed();
  }

  if (result === "exported") {
    const document = exportedDocument(response.data);
    if (!document) return failed();
    return { kind: "exported", document };
  }
  if (result === "not_found") return { kind: "not_found" };
  return failed();
}

export async function readLinkRequests(): Promise<LinkRequestView[] | "unavailable"> {
  try {
    const supabase = await createSessionClient();
    const rows: LinkRequestView[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("link_requests")
        .select(COLUMNS)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !Array.isArray(data)) return "unavailable";
      for (const row of data) {
        const view = viewOf(row);
        if (!view) return "unavailable";
        rows.push(view);
      }
      if (data.length < PAGE) return rows;
    }
  } catch {
    return "unavailable";
  }
}

export async function approveLinkRequest(id: string): Promise<LinkOutcome> {
  try {
    const response = await createAdminClient().rpc("approve_link_request", { p_request: id });
    return linkOutcome("approve", response);
  } catch {
    return failed();
  }
}

export async function declineLinkRequest(id: string): Promise<LinkOutcome> {
  try {
    const response = await createAdminClient().rpc("decline_link_request", { p_request: id });
    return linkOutcome("decline", response);
  } catch {
    return failed();
  }
}

export async function deleteLinkRequest(id: string): Promise<LinkOutcome> {
  try {
    const response = await createAdminClient().rpc("delete_link_request", { p_request: id });
    return linkOutcome("delete", response);
  } catch {
    return failed();
  }
}

export async function exportLinkRequest(id: string): Promise<LinkOutcome> {
  try {
    const response = await createAdminClient().rpc("export_link_request", { p_request: id });
    return linkOutcome("export", response);
  } catch {
    return failed();
  }
}
