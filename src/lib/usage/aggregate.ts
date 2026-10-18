export type UsageAgent = "builder" | "reviewer";

export type UsageCounts = {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
};

export type UsageCoverage = {
  agent: UsageAgent;
  ended: number;
  measured: number;
};

export type AgentTotals = UsageCounts & {
  agent: UsageAgent;
};

export type ModelTotals = UsageCounts & {
  agent: UsageAgent;
  model: string;
  attempts: number;
  measured: number;
};

export type UsageAttempt = UsageCounts & {
  phase: string | null;
  task: string | null;
  runKey: string;
  runCreatedAt: string;
  agent: UsageAgent;
  model: string;
  accountAlias: string;
  source: "measured" | "unavailable";
  status: string;
  at: string;
  origin: string;
  receivedAt: string;
  step: "build" | "review";
};

export type UsageProject = {
  key: string;
  repo: string;
  staleAfterMinutes: number;
};

export type UsageStepEventRow = {
  id: number;
  step: string;
  status: string;
  received_at: string;
  usage: readonly { agent: string; source: string }[];
};

export type UsageAttemptRow = {
  phase: string | null;
  task: string | null;
  run_key: string;
  run_created_at: string;
  agent: string;
  model: string;
  account_alias: string;
  input: number | null;
  output: number | null;
  cache_read: number | null;
  cache_write: number | null;
  source: string;
  status: string;
  at: string;
  origin: string;
  received_at: string;
};

export type UsageReport = {
  project: UsageProject;
  freshness: "fresh" | "stale" | "none";
  lastContactAt: string | null;
  coverage: [UsageCoverage, UsageCoverage];
  byAgent: [AgentTotals, AgentTotals];
  byModel: ModelTotals[];
  attempts: UsageAttempt[];
  failedAttempts: UsageAttempt[];
};

const AGENTS: readonly UsageAgent[] = ["reviewer", "builder"];
const ENDED = new Set(["pass", "fail", "waiting"]);

function stepOf(agent: UsageAgent): "build" | "review" {
  return agent === "builder" ? "build" : "review";
}

function isAgent(value: string): value is UsageAgent {
  return value === "builder" || value === "reviewer";
}

function isSource(value: string): value is UsageAttempt["source"] {
  return value === "measured" || value === "unavailable";
}

function endedAttempt(row: UsageStepEventRow, agent: UsageAgent): boolean {
  return row.step === stepOf(agent) && ENDED.has(row.status);
}

function measuredAttempt(row: UsageStepEventRow, agent: UsageAgent): boolean {
  const entries = row.usage.filter((entry) => entry.agent === agent);
  return entries.length > 0 && entries.every((entry) => entry.source === "measured");
}

function sumNumbers(values: readonly (number | null)[]): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    if (value === null) continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

function countsOf(rows: readonly UsageAttemptRow[]): UsageCounts {
  const measured = rows.filter((row) => row.source === "measured");
  if (measured.length === 0) {
    return { input: null, output: null, cacheRead: null, cacheWrite: null };
  }
  return {
    input: sumNumbers(measured.map((row) => row.input)),
    output: sumNumbers(measured.map((row) => row.output)),
    cacheRead: sumNumbers(measured.map((row) => row.cache_read)),
    cacheWrite: sumNumbers(measured.map((row) => row.cache_write)),
  };
}

function compareText(left: string | null, right: string | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function toAttempt(row: UsageAttemptRow): UsageAttempt | null {
  if (!isAgent(row.agent) || !isSource(row.source)) return null;
  return {
    phase: row.phase,
    task: row.task,
    runKey: row.run_key,
    runCreatedAt: row.run_created_at,
    agent: row.agent,
    model: row.model,
    accountAlias: row.account_alias,
    input: row.input,
    output: row.output,
    cacheRead: row.cache_read,
    cacheWrite: row.cache_write,
    source: row.source,
    status: row.status,
    at: row.at,
    origin: row.origin,
    receivedAt: row.received_at,
    step: stepOf(row.agent),
  };
}

function compareAttempts(left: UsageAttempt, right: UsageAttempt): number {
  const created = Date.parse(left.runCreatedAt) - Date.parse(right.runCreatedAt);
  const agent = (left.agent === "builder" ? 0 : 1) - (right.agent === "builder" ? 0 : 1);
  return (
    compareText(left.phase, right.phase) ||
    compareText(left.task, right.task) ||
    created ||
    compareText(left.runKey, right.runKey) ||
    agent ||
    compareText(left.model, right.model) ||
    compareText(left.accountAlias, right.accountAlias)
  );
}

function freshnessOf(
  rows: readonly UsageStepEventRow[],
  staleAfterMinutes: number,
  now: Date,
): { freshness: UsageReport["freshness"]; lastContactAt: string | null } {
  if (rows.length === 0) return { freshness: "none", lastContactAt: null };
  let best = rows[0];
  for (const row of rows) {
    const delta = Date.parse(row.received_at) - Date.parse(best.received_at);
    if (delta > 0 || (delta === 0 && row.id > best.id)) best = row;
  }
  const age = now.getTime() - Date.parse(best.received_at);
  return {
    freshness: age > staleAfterMinutes * 60 * 1000 ? "stale" : "fresh",
    lastContactAt: best.received_at,
  };
}

export function aggregateUsage(
  input: {
    project: UsageProject;
    stepEventRows: readonly UsageStepEventRow[];
    attemptRows: readonly UsageAttemptRow[];
  },
  now: Date,
): UsageReport {
  const coverage = AGENTS.map((agent) => {
    const attempts = input.stepEventRows.filter((row) => endedAttempt(row, agent));
    return {
      agent,
      ended: attempts.length,
      measured: attempts.filter((row) => measuredAttempt(row, agent)).length,
    };
  }) as [UsageCoverage, UsageCoverage];

  const byAgent = AGENTS.map((agent) => ({
    agent,
    ...countsOf(input.attemptRows.filter((row) => row.agent === agent)),
  })) as [AgentTotals, AgentTotals];

  const grouped = new Map<string, { agent: UsageAgent; model: string; rows: UsageAttemptRow[] }>();
  for (const row of input.attemptRows) {
    if (!isAgent(row.agent)) continue;
    const key = `${row.agent}\u0000${row.model}`;
    const found = grouped.get(key);
    if (found) found.rows.push(row);
    else grouped.set(key, { agent: row.agent, model: row.model, rows: [row] });
  }
  const byModel = [...grouped.values()]
    .map((group) => ({
      agent: group.agent,
      model: group.model,
      attempts: group.rows.length,
      measured: group.rows.filter((row) => row.source === "measured").length,
      ...countsOf(group.rows),
    }))
    .sort((left, right) => {
      const agent = (left.agent === "reviewer" ? 0 : 1) - (right.agent === "reviewer" ? 0 : 1);
      return agent || compareText(left.model, right.model);
    });

  const attempts: UsageAttempt[] = [];
  const failedAttempts: UsageAttempt[] = [];
  for (const row of input.attemptRows) {
    const attempt = toAttempt(row);
    if (!attempt) continue;
    if (attempt.status === "fail") failedAttempts.push(attempt);
    else attempts.push(attempt);
  }
  attempts.sort(compareAttempts);
  failedAttempts.sort(compareAttempts);

  const contact = freshnessOf(input.stepEventRows, input.project.staleAfterMinutes, now);
  return {
    project: input.project,
    freshness: contact.freshness,
    lastContactAt: contact.lastContactAt,
    coverage,
    byAgent,
    byModel,
    attempts,
    failedAttempts,
  };
}
