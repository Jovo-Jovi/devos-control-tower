import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { LINK_STATES, type LinkState, type Portfolio, type PortfolioProject, type PortfolioStepEvent } from "../../src/lib/portfolio/aggregate";

const KEYS = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", "INDIA", "JULIET"] as const;

function statusOf(state: LinkState): { step: string; status: string } {
  if (state === "active") return { step: "checks", status: "started" };
  if (state === "revise") return { step: "checks", status: "revise" };
  if (state === "waiting") return { step: "checks", status: "waiting" };
  if (state === "gate") return { step: "gate", status: "waiting" };
  if (state === "down") return { step: "checks", status: "fail" };
  return { step: "checks", status: "pass" };
}

function emptyTotals(): Portfolio["totals"]["byLinkState"] {
  return { active: 0, steady: 0, revise: 0, waiting: 0, gate: 0, down: 0, stale: 0, silent: 0 };
}

export function syntheticPortfolio(now: Date, count: number): Portfolio {
  const byLinkState = emptyTotals();
  const projects: PortfolioProject[] = [];
  for (let index = 0; index < count; index += 1) {
    const state = LINK_STATES[index] ?? "steady";
    const key = KEYS[index] ?? `P${index}`;
    byLinkState[state] += 1;
    const silent = state === "silent";
    const received = new Date(now.getTime() - (index + 1) * 60_000).toISOString();
    const fact = statusOf(state);
    const latest: PortfolioStepEvent | null = silent
      ? null
      : {
          key,
          task: "T02",
          phase: "P01",
          step: fact.step,
          status: fact.status,
          origin: "reported",
          seq: 1,
          at: received,
          receivedAt: received,
        };
    projects.push({
      key,
      repo: `fixture-org/${key.toLowerCase()}`,
      staleAfterMinutes: 1440,
      lastActivityAt: latest?.at ?? null,
      lastContactAt: latest?.receivedAt ?? null,
      latest,
      freshness: silent ? "none" : state === "stale" ? "stale" : "fresh",
      execution: latest ? "ci" : null,
      tasks: { passed: 0, seen: latest ? 1 : 0 },
      phase: latest ? { id: "P01", passed: 0, seen: 1 } : null,
      linkState: state,
      recent: latest ? [latest] : [],
    });
  }
  const recentActivity = projects
    .flatMap((project) => project.recent)
    .sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt))
    .slice(0, 6);
  const tasksSeen = projects.reduce((sum, project) => sum + project.tasks.seen, 0);
  return {
    projects,
    totals: {
      projects: projects.length,
      fresh: projects.filter((project) => project.freshness === "fresh").length,
      staleOrSilent: projects.filter((project) => project.linkState === "stale" || project.linkState === "silent").length,
      tasksPassed: 0,
      tasksSeen,
      measuredAttempts: 0,
      byLinkState,
    },
    recentActivity,
    health: {
      lastReceivedAt: recentActivity[0]?.receivedAt ?? null,
      stepEventsLastHour: recentActivity.length,
      deliveriesLast24h: 0,
      rejectionsLast24h: 0,
    },
    generatedAt: now.toISOString(),
  };
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
