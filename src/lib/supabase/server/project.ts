import "server-only";

import {
  aggregateProject,
  type ProjectAggregateInput,
  type ProjectObservationRow,
  type ProjectReport,
  type ProjectRunRow,
  type ProjectStepEventRow,
} from "@/lib/project/aggregate";
import { createSessionClient } from "@/lib/supabase/server/session";

const PAGE = 1000;

type PageResult = { data: unknown[] | null; error: { message: string } | null };

async function readPages(read: (from: number, to: number) => PromiseLike<PageResult>): Promise<unknown[] | "unavailable"> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1);
    if (error || data === null) return "unavailable";
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalText(value: unknown): string | null | "unavailable" {
  if (value === null) return null;
  return typeof value === "string" ? value : "unavailable";
}

function runsOf(rows: unknown[]): ProjectRunRow[] | "unavailable" {
  const runs: ProjectRunRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return "unavailable";
    const record = row as Record<string, unknown>;
    const id = text(record.id);
    const runKey = text(record.run_key);
    const source = text(record.source);
    const createdAt = text(record.created_at);
    if (!id || !runKey || !source || !createdAt) return "unavailable";
    runs.push({ id, run_key: runKey, source, created_at: createdAt });
  }
  return runs;
}

function eventsOf(rows: unknown[]): ProjectStepEventRow[] | "unavailable" {
  const events: ProjectStepEventRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return "unavailable";
    const record = row as Record<string, unknown>;
    const runId = text(record.run_id);
    const step = text(record.step);
    const status = text(record.status);
    const at = text(record.at);
    const receivedAt = text(record.received_at);
    const origin = text(record.origin);
    const phase = optionalText(record.phase);
    const task = optionalText(record.task);
    const evidence = optionalText(record.evidence);
    if (
      typeof record.id !== "number" ||
      typeof record.seq !== "number" ||
      !Number.isFinite(record.seq) ||
      !runId ||
      !step ||
      !status ||
      !at ||
      !receivedAt ||
      !origin ||
      phase === "unavailable" ||
      task === "unavailable" ||
      evidence === "unavailable"
    ) {
      return "unavailable";
    }
    events.push({
      id: record.id,
      run_id: runId,
      seq: record.seq,
      phase,
      task,
      step,
      status,
      at,
      received_at: receivedAt,
      evidence,
      origin,
    });
  }
  return events;
}

function observationsOf(rows: unknown[]): ProjectObservationRow[] | "unavailable" {
  const observations: ProjectObservationRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return "unavailable";
    const record = row as Record<string, unknown>;
    const sha = text(record.sha);
    const kind = text(record.kind);
    const state = text(record.state);
    const at = text(record.at);
    const receivedAt = text(record.received_at);
    const context = optionalText(record.context);
    if (
      typeof record.id !== "number" ||
      !sha ||
      !kind ||
      !state ||
      !at ||
      !receivedAt ||
      context === "unavailable"
    ) {
      return "unavailable";
    }
    observations.push({
      id: record.id,
      sha,
      kind,
      context,
      state,
      at,
      received_at: receivedAt,
    });
  }
  return observations;
}

export async function loadProject(key: string): Promise<ProjectReport | "not_found" | "unavailable"> {
  const supabase = await createSessionClient();
  const project = await supabase.from("projects").select("id, key, repo, stale_after_minutes").eq("key", key).maybeSingle();
  if (project.error) return "unavailable";
  if (!project.data) return "not_found";
  const projectRow = project.data;
  if (
    typeof projectRow.id !== "string" ||
    typeof projectRow.key !== "string" ||
    typeof projectRow.repo !== "string" ||
    typeof projectRow.stale_after_minutes !== "number"
  ) {
    return "unavailable";
  }

  const runPage = await readPages((from, to) =>
    supabase
      .from("runs")
      .select("id, run_key, source, created_at")
      .eq("project_id", projectRow.id)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (runPage === "unavailable") return "unavailable";
  const runRows = runsOf(runPage);
  if (runRows === "unavailable") return "unavailable";

  const eventPage = await readPages((from, to) =>
    supabase
      .from("events")
      .select("id, run_id, seq, phase, task, step, status, at, received_at, evidence, origin")
      .eq("project_id", projectRow.id)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (eventPage === "unavailable") return "unavailable";
  const stepEventRows = eventsOf(eventPage);
  if (stepEventRows === "unavailable") return "unavailable";

  const observationPage = await readPages((from, to) =>
    supabase
      .from("observations")
      .select("id, sha, kind, context, state, at, received_at")
      .eq("project_id", projectRow.id)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (observationPage === "unavailable") return "unavailable";
  const observationRows = observationsOf(observationPage);
  if (observationRows === "unavailable") return "unavailable";

  const input: ProjectAggregateInput = {
    project: {
      key: projectRow.key,
      repo: projectRow.repo,
      staleAfterMinutes: projectRow.stale_after_minutes,
    },
    runRows,
    stepEventRows,
    observationRows,
  };
  return aggregateProject(input, new Date());
}
