import "server-only";

import { createAdminClient } from "@/lib/supabase/server/admin";

export type ProjectDeletionOutcome =
  | { kind: "deleted" }
  | { kind: "linked" }
  | { kind: "not_found" }
  | { kind: "failed" };

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function projectDeletionOutcome(response: { data: unknown; error: unknown }): ProjectDeletionOutcome {
  if (response.error !== null) return { kind: "failed" };
  if (!plainObject(response.data)) return { kind: "failed" };
  const result = response.data.result;
  if (result === "deleted" || result === "linked" || result === "not_found") return { kind: result };
  return { kind: "failed" };
}

export async function deleteRegisteredProject(key: string): Promise<ProjectDeletionOutcome> {
  try {
    const response = await createAdminClient().rpc("delete_registered_project", { p_key: key });
    return projectDeletionOutcome(response);
  } catch {
    return { kind: "failed" };
  }
}
