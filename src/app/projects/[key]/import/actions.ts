"use server";

import { parseHistory, type HistoryRefusal } from "@/lib/history/parse";
import { loadImportTarget, storeHistory } from "@/lib/supabase/server/import";
import { requireOwner } from "@/lib/supabase/server/session";

const PROJECT_KEY = /^[A-Z][A-Z0-9_-]{1,31}$/;
const MAX_FILE_BYTES = 512000;

export type ImportState =
  | { kind: "error"; reason: "not_found" | "unavailable" }
  | { kind: "empty" }
  | { kind: "too_large" }
  | { kind: "invalid"; line: number; reason: HistoryRefusal }
  | { kind: "done"; run: string; total: number; stored: number; duplicate: number; conflict: number }
  | { kind: "failed"; line: number; stored: number; duplicate: number; conflict: number };

export async function importHistory(
  key: string,
  _previous: ImportState | null,
  formData: FormData,
): Promise<ImportState> {
  await requireOwner();

  if (!PROJECT_KEY.test(key)) return { kind: "error", reason: "not_found" };

  const target = await loadImportTarget(key);
  if (target === "not_found" || target === "unavailable") return { kind: "error", reason: target };

  const history = formData.get("history");
  if (!(history instanceof File) || history.size <= 0) return { kind: "empty" };
  if (history.size > MAX_FILE_BYTES) return { kind: "too_large" };

  const parsed = parseHistory(await history.text(), key);
  if (!parsed.ok) return { kind: "invalid", line: parsed.line, reason: parsed.reason };

  const stored = await storeHistory(parsed.events);
  if (stored.kind === "failed") return stored;

  return {
    kind: "done",
    run: parsed.run,
    total: parsed.events.length,
    stored: stored.stored,
    duplicate: stored.duplicate,
    conflict: stored.conflict,
  };
}
