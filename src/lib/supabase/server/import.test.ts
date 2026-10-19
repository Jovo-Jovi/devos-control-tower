import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseHistory } from "@/lib/history/parse";
import type { StepEvent } from "@/lib/contract/step-event";

vi.mock("server-only", () => ({}));

const { storeHistory } = await import("./import");
const { createAdminClient } = await import("./admin");

const KEY = "IMPORTUT";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

let admin: ReturnType<typeof createAdminClient>;

function rekeyed(project: string): StepEvent[] {
  const text = readFileSync(path.join(root, "tests/fixtures/history-synthetic.jsonl"), "utf8");
  const parsed = parseHistory(text, "IMPORTFX");
  if (!parsed.ok) throw new Error("fixture");
  return parsed.events.map((event) => ({ ...event, project }));
}

async function projectId(): Promise<string> {
  const { data, error } = await admin.from("projects").select("id").eq("key", KEY).single();
  if (error) throw new Error(error.code ?? "project");
  return data.id;
}

async function storedRows(): Promise<{ origin: string; source: string; seq: number; status: string; step: string }[]> {
  const id = await projectId();
  const { data, error } = await admin
    .from("events")
    .select("origin, source, seq, status, step")
    .eq("project_id", id)
    .order("seq", { ascending: true });
  if (error) throw new Error(error.code ?? "events");
  return data ?? [];
}

describe("T10 storeHistory", () => {
  beforeAll(async () => {
    admin = createAdminClient();
    const { error: removeError } = await admin.from("projects").delete().in("key", [KEY, "NOIMPORT"]);
    if (removeError) throw new Error(removeError.code ?? "delete");
    const { error: insertError } = await admin.from("projects").insert({
      key: KEY,
      repo: "fixture-org/import-unit",
      owner_github_id: "700053",
    });
    if (insertError) throw new Error(insertError.code ?? "insert");
  });

  afterAll(async () => {
    if (!admin) return;
    const { error } = await admin.from("projects").delete().in("key", [KEY, "NOIMPORT"]);
    if (error) throw new Error(error.code ?? "delete");
  });

  it("stores the 8 synthetic events as imported", async () => {
    const events = rekeyed(KEY);
    const stored = await storeHistory(events);
    expect(stored).toEqual({ kind: "done", stored: 8, duplicate: 0, conflict: 0 });

    const rows = await storedRows();
    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows.every((row) => row.origin === "imported" && row.source === "import")).toBe(true);

    const id = await projectId();
    const { data: runs, error } = await admin.from("runs").select("run_key, source").eq("project_id", id);
    if (error) throw new Error(error.code ?? "runs");
    expect(runs).toEqual([{ run_key: "import-0a1b2c3", source: "import" }]);
  });

  it("counts a second run as 8 duplicates", async () => {
    const again = await storeHistory(rekeyed(KEY));
    expect(again).toEqual({ kind: "done", stored: 0, duplicate: 8, conflict: 0 });
    expect(await storedRows()).toHaveLength(8);
  });

  it("counts a changed body as a conflict and keeps the first event", async () => {
    const events = rekeyed(KEY);
    const first = events[0];
    if (!first) throw new Error("fixture");
    const changed = events.map((event, index) => (index === 0 ? { ...event, status: "fail" as const } : event));
    const result = await storeHistory(changed);
    expect(result).toEqual({ kind: "done", stored: 0, duplicate: 7, conflict: 1 });

    const rows = await storedRows();
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ seq: 1, step: "review", status: "pass", origin: "imported", source: "import" });
  });

  it("fails at line 1 for an unknown project and stops at a later line", async () => {
    const missing = await storeHistory(rekeyed("NOIMPORT"));
    expect(missing).toEqual({ kind: "failed", line: 1, stored: 0, duplicate: 0, conflict: 0 });
    const { data, error } = await admin.from("projects").select("key").eq("key", "NOIMPORT").maybeSingle();
    if (error) throw new Error(error.code ?? "project");
    expect(data).toBeNull();

    const events = rekeyed(KEY);
    const head = events[0];
    const next = events[1];
    if (!head || !next) throw new Error("fixture");
    const stopped = await storeHistory([head, { ...next, project: "NOIMPORT" }]);
    expect(stopped).toEqual({ kind: "failed", line: 2, stored: 0, duplicate: 1, conflict: 0 });
    expect(await storedRows()).toHaveLength(8);
  });
});
