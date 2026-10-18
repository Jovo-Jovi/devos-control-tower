import "server-only";

import {
  aggregatePortfolio,
  type Portfolio,
  type ProjectRow,
  type RunRow,
  type StepEventRow,
} from "@/lib/portfolio/aggregate";
import { createSessionClient } from "@/lib/supabase/server/session";

const PAGE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function projectsOf(rows: unknown[]): ProjectRow[] | "unavailable" {
  const projects: ProjectRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return "unavailable";
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.key !== "string" || typeof record.repo !== "string") {
      return "unavailable";
    }
    if (typeof record.stale_after_minutes !== "number") return "unavailable";
    projects.push({
      id: record.id,
      key: record.key,
      repo: record.repo,
      stale_after_minutes: record.stale_after_minutes,
    });
  }
  return projects;
}

function eventsOf(rows: unknown[]): StepEventRow[] | "unavailable" {
  const events: StepEventRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return "unavailable";
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "number" || typeof record.seq !== "number") return "unavailable";
    events.push({
      id: record.id,
      project_id: text(record.project_id),
      run_id: text(record.run_id),
      seq: record.seq,
      phase: optionalText(record.phase),
      task: optionalText(record.task),
      step: text(record.step),
      status: text(record.status),
      origin: text(record.origin),
      at: text(record.at),
      received_at: text(record.received_at),
    });
  }
  return events;
}

function runsOf(rows: unknown[]): RunRow[] | "unavailable" {
  const runs: RunRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return "unavailable";
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.source !== "string") return "unavailable";
    runs.push({ id: record.id, source: record.source });
  }
  return runs;
}

function measuredOf(rows: unknown[]): number[] | "unavailable" {
  const ids: number[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return "unavailable";
    const eventId = (row as Record<string, unknown>).event_id;
    if (typeof eventId !== "number") return "unavailable";
    ids.push(eventId);
  }
  return ids;
}

export async function loadPortfolio(): Promise<Portfolio | "unavailable"> {
  const supabase = await createSessionClient();
  const now = new Date();
  const since = new Date(now.getTime() - DAY_MS).toISOString();

  const projectPage = await readPages((from, to) =>
    supabase.from("projects").select("id, key, repo, stale_after_minutes").order("id", { ascending: true }).range(from, to),
  );
  if (projectPage === "unavailable") return "unavailable";
  const projectRows = projectsOf(projectPage);
  if (projectRows === "unavailable") return "unavailable";

  const eventPage = await readPages((from, to) =>
    supabase
      .from("events")
      .select("id, project_id, run_id, seq, phase, task, step, status, origin, at, received_at")
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (eventPage === "unavailable") return "unavailable";
  const stepEventRows = eventsOf(eventPage);
  if (stepEventRows === "unavailable") return "unavailable";

  const runPage = await readPages((from, to) =>
    supabase.from("runs").select("id, source").order("id", { ascending: true }).range(from, to),
  );
  if (runPage === "unavailable") return "unavailable";
  const runRows = runsOf(runPage);
  if (runRows === "unavailable") return "unavailable";

  const measuredPage = await readPages((from, to) =>
    supabase.from("event_usage").select("event_id").eq("source", "measured").order("id", { ascending: true }).range(from, to),
  );
  if (measuredPage === "unavailable") return "unavailable";
  const measuredEventIds = measuredOf(measuredPage);
  if (measuredEventIds === "unavailable") return "unavailable";

  const deliveries = await supabase
    .from("webhook_deliveries")
    .select("received_at", { count: "exact", head: true })
    .gte("received_at", since);
  if (deliveries.error || deliveries.count === null) return "unavailable";

  const rejections = await supabase
    .from("event_rejections")
    .select("received_at", { count: "exact", head: true })
    .gte("received_at", since);
  if (rejections.error || rejections.count === null) return "unavailable";

  return aggregatePortfolio(
    {
      projectRows,
      stepEventRows,
      runRows,
      measuredEventIds,
      deliveriesLast24h: deliveries.count,
      rejectionsLast24h: rejections.count,
    },
    now,
  );
}
