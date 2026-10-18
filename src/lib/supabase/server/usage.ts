import "server-only";

import { createSessionClient } from "@/lib/supabase/server/session";
import {
  aggregateUsage,
  type UsageAgent,
  type UsageAttemptRow,
  type UsageReport,
  type UsageStepEventRow,
} from "@/lib/usage/aggregate";

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

function count(value: unknown): number | null | "unavailable" {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return "unavailable";
}

function agentOf(value: unknown): UsageAgent | "unavailable" {
  if (value === "builder" || value === "reviewer") return value;
  return "unavailable";
}

function eventsOf(rows: unknown[]): UsageStepEventRow[] | "unavailable" {
  const events: UsageStepEventRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return "unavailable";
    const record = row as Record<string, unknown>;
    const step = text(record.step);
    const status = text(record.status);
    const receivedAt = text(record.received_at);
    if (typeof record.id !== "number" || !step || !status || !receivedAt) return "unavailable";
    if (!Array.isArray(record.event_usage)) return "unavailable";
    const usage: { agent: string; source: string }[] = [];
    for (const entry of record.event_usage) {
      if (!entry || typeof entry !== "object") return "unavailable";
      const usageRow = entry as Record<string, unknown>;
      const agent = text(usageRow.agent);
      const source = text(usageRow.source);
      if (!agent || !source) return "unavailable";
      usage.push({ agent, source });
    }
    events.push({ id: record.id, step, status, received_at: receivedAt, usage });
  }
  return events;
}

function attemptsOf(rows: unknown[]): UsageAttemptRow[] | "unavailable" {
  const attempts: UsageAttemptRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return "unavailable";
    const record = row as Record<string, unknown>;
    const phase = optionalText(record.phase);
    const task = optionalText(record.task);
    const agent = agentOf(record.agent);
    const source = text(record.source);
    const runKey = text(record.run_key);
    const runCreatedAt = text(record.run_created_at);
    const model = text(record.model);
    const alias = text(record.account_alias);
    const status = text(record.status);
    const at = text(record.at);
    const origin = text(record.origin);
    const receivedAt = text(record.received_at);
    const input = count(record.input);
    const output = count(record.output);
    const cacheRead = count(record.cache_read);
    const cacheWrite = count(record.cache_write);
    if (
      phase === "unavailable" ||
      task === "unavailable" ||
      agent === "unavailable" ||
      !source ||
      (source !== "measured" && source !== "unavailable") ||
      !runKey ||
      !runCreatedAt ||
      !model ||
      !alias ||
      !status ||
      !at ||
      !origin ||
      !receivedAt ||
      input === "unavailable" ||
      output === "unavailable" ||
      cacheRead === "unavailable" ||
      cacheWrite === "unavailable"
    ) {
      return "unavailable";
    }
    attempts.push({
      phase,
      task,
      run_key: runKey,
      run_created_at: runCreatedAt,
      agent,
      model,
      account_alias: alias,
      input,
      output,
      cache_read: cacheRead,
      cache_write: cacheWrite,
      source,
      status,
      at,
      origin,
      received_at: receivedAt,
    });
  }
  return attempts;
}

export async function loadUsage(key: string): Promise<UsageReport | "not_found" | "unavailable"> {
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

  const eventPage = await readPages((from, to) =>
    supabase
      .from("events")
      .select("id, step, status, received_at, event_usage(agent, source)")
      .eq("project_id", projectRow.id)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (eventPage === "unavailable") return "unavailable";
  const stepEventRows = eventsOf(eventPage);
  if (stepEventRows === "unavailable") return "unavailable";

  const attemptPage = await readPages((from, to) =>
    supabase
      .from("usage_by_attempt")
      .select(
        "phase, task, run_key, run_created_at, agent, model, account_alias, input, output, cache_read, cache_write, source, status, at, origin, received_at",
      )
      .eq("project_key", key)
      .order("run_created_at", { ascending: true })
      .order("run_key", { ascending: true })
      .order("phase", { ascending: true })
      .order("task", { ascending: true })
      .order("agent", { ascending: true })
      .order("model", { ascending: true })
      .order("account_alias", { ascending: true })
      .range(from, to),
  );
  if (attemptPage === "unavailable") return "unavailable";
  const attemptRows = attemptsOf(attemptPage);
  if (attemptRows === "unavailable") return "unavailable";

  return aggregateUsage(
    {
      project: {
        key: projectRow.key,
        repo: projectRow.repo,
        staleAfterMinutes: projectRow.stale_after_minutes,
      },
      stepEventRows,
      attemptRows,
    },
    new Date(),
  );
}
