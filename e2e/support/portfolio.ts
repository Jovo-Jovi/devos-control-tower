import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { aggregatePortfolio, LINK_STATES, type LinkState, type Portfolio } from "../../src/lib/portfolio/aggregate";

const KEYS = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", "INDIA", "JULIET"] as const;

function statusOf(state: LinkState): { step: string; status: string } {
  if (state === "active") return { step: "checks", status: "started" };
  if (state === "revise") return { step: "checks", status: "revise" };
  if (state === "waiting") return { step: "checks", status: "waiting" };
  if (state === "gate") return { step: "gate", status: "waiting" };
  if (state === "down") return { step: "checks", status: "fail" };
  return { step: "checks", status: "pass" };
}

export function syntheticPortfolio(now: Date, count: number): Portfolio {
  const projectRows = [];
  const stepEventRows = [];
  const runRows = [];
  for (let index = 0; index < count; index += 1) {
    const state: LinkState = LINK_STATES[index] ?? "silent";
    const key = KEYS[index] ?? `P${index}`;
    const id = `fixture-${key}`;
    projectRows.push({
      id,
      key,
      repo: `fixture-org/${key.toLowerCase()}`,
      stale_after_minutes: state === "stale" ? 1 : 1440,
    });
    if (state === "silent") continue;
    const runId = `run-${key}`;
    runRows.push({ id: runId, source: "ci" });
    const received = new Date(now.getTime() - (index + 1) * 60_000).toISOString();
    const fact = statusOf(state);
    stepEventRows.push({
      id: index + 1,
      project_id: id,
      run_id: runId,
      seq: 1,
      phase: "P01",
      task: "T02",
      step: fact.step,
      status: fact.status,
      origin: "reported",
      at: received,
      received_at: received,
    });
  }
  return aggregatePortfolio(
    {
      projectRows,
      stepEventRows,
      runRows,
      measuredEventIds: [],
      deliveriesLast24h: 0,
      rejectionsLast24h: 0,
    },
    now,
  );
}

export function emptyPortfolio(now: Date): Portfolio {
  return syntheticPortfolio(now, 0);
}

function localEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const text = readFileSync(".devos/supabase.env", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)='(.*)'$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

export function query(sql: string): string {
  const dbUrl = localEnv().SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("SUPABASE_DB_URL is not set");
  try {
    return execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? String((error as { stderr?: Buffer }).stderr) : "";
    throw new Error(stderr.replaceAll(dbUrl, "[redacted]") || "psql failed");
  }
}
