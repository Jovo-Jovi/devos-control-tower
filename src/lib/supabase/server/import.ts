import "server-only";

import type { StepEvent } from "@/lib/contract/step-event";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/server/admin";
import { createSessionClient } from "@/lib/supabase/server/session";

export type StoreHistoryResult =
  | { kind: "done"; stored: number; duplicate: number; conflict: number }
  | { kind: "failed"; line: number; stored: number; duplicate: number; conflict: number };

type StoreCounts = { stored: number; duplicate: number; conflict: number };

function counts(): StoreCounts {
  return { stored: 0, duplicate: 0, conflict: 0 };
}

function failed(line: number, tally: StoreCounts): StoreHistoryResult {
  return { kind: "failed", line, stored: tally.stored, duplicate: tally.duplicate, conflict: tally.conflict };
}

function payloadOf(event: StepEvent): Json {
  return JSON.parse(JSON.stringify(event)) as Json;
}

function countedResult(data: Json): "stored" | "duplicate" | "conflict" | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const result = data.result;
  if (result === "stored" || result === "duplicate" || result === "conflict") return result;
  return null;
}

export async function loadImportTarget(
  key: string,
): Promise<{ key: string; repo: string } | "not_found" | "unavailable"> {
  const supabase = await createSessionClient();
  const project = await supabase.from("projects").select("key, repo").eq("key", key).maybeSingle();
  if (project.error) return "unavailable";
  if (!project.data) return "not_found";
  const row = project.data;
  if (row.key !== key || row.repo.length === 0) return "unavailable";
  return { key: row.key, repo: row.repo };
}

export async function storeHistory(events: StepEvent[]): Promise<StoreHistoryResult> {
  const admin = createAdminClient();
  const tally = counts();

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event) return failed(index + 1, tally);

    let data: Json | null = null;
    let errored = false;
    try {
      const response = await admin.rpc("ingest_event", { payload: payloadOf(event), src: "import" });
      data = response.data;
      errored = response.error !== null;
    } catch {
      errored = true;
    }
    if (errored || data === null) return failed(index + 1, tally);

    const result = countedResult(data);
    if (result === "stored") tally.stored += 1;
    else if (result === "duplicate") tally.duplicate += 1;
    else if (result === "conflict") tally.conflict += 1;
    else return failed(index + 1, tally);
  }

  return { kind: "done", stored: tally.stored, duplicate: tally.duplicate, conflict: tally.conflict };
}
