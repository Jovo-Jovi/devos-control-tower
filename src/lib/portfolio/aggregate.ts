export const LINK_STATES = [
  "active",
  "steady",
  "revise",
  "waiting",
  "gate",
  "down",
  "stale",
  "silent",
] as const;

export type LinkState = (typeof LINK_STATES)[number];

export type PortfolioStepEvent = {
  key: string;
  task: string | null;
  phase: string | null;
  step: string;
  status: string;
  origin: string;
  seq: number;
  at: string;
  receivedAt: string;
};

export type PortfolioProject = {
  key: string;
  repo: string;
  staleAfterMinutes: number;
  lastActivityAt: string | null;
  lastContactAt: string | null;
  latest: PortfolioStepEvent | null;
  freshness: "fresh" | "stale" | "none";
  execution: "ci" | "local" | "import" | null;
  tasks: { passed: number; seen: number };
  phase: { id: string; passed: number; seen: number } | null;
  linkState: LinkState;
  recent: PortfolioStepEvent[];
};

export type IngestionHealth = {
  lastReceivedAt: string | null;
  stepEventsLastHour: number;
  deliveriesLast24h: number;
  rejectionsLast24h: number;
};

export type PortfolioTotals = {
  projects: number;
  fresh: number;
  staleOrSilent: number;
  tasksPassed: number;
  tasksSeen: number;
  measuredAttempts: number;
  byLinkState: Record<LinkState, number>;
};

export type Portfolio = {
  projects: PortfolioProject[];
  totals: PortfolioTotals;
  recentActivity: PortfolioStepEvent[];
  health: IngestionHealth;
  generatedAt: string;
};

export type ProjectRow = {
  id: string;
  key: string;
  repo: string;
  stale_after_minutes: number;
};

export type StepEventRow = {
  id: number;
  project_id: string;
  run_id: string;
  seq: number;
  phase: string | null;
  task: string | null;
  step: string;
  status: string;
  origin: string;
  at: string;
  received_at: string;
};

export type RunRow = {
  id: string;
  source: string;
};

export type AggregateInput = {
  projectRows: readonly ProjectRow[];
  stepEventRows: readonly StepEventRow[];
  runRows: readonly RunRow[];
  measuredEventIds: readonly number[];
  deliveriesLast24h: number;
  rejectionsLast24h: number;
};

const HOUR_MS = 60 * 60 * 1000;
const RECENT_LIMIT = 6;

function emptyByLinkState(): Record<LinkState, number> {
  return {
    active: 0,
    steady: 0,
    revise: 0,
    waiting: 0,
    gate: 0,
    down: 0,
    stale: 0,
    silent: 0,
  };
}

function timeOf(value: string): number {
  return Date.parse(value);
}

function laterRow(current: StepEventRow, candidate: StepEventRow): StepEventRow {
  const delta = timeOf(candidate.received_at) - timeOf(current.received_at);
  if (delta !== 0) return delta > 0 ? candidate : current;
  return candidate.id > current.id ? candidate : current;
}

function maxTime(rows: readonly StepEventRow[], field: "at" | "received_at"): string | null {
  let best: StepEventRow | null = null;
  for (const row of rows) {
    best = best === null ? row : laterField(best, row, field);
  }
  return best ? best[field] : null;
}

function laterField(current: StepEventRow, candidate: StepEventRow, field: "at" | "received_at"): StepEventRow {
  const delta = timeOf(candidate[field]) - timeOf(current[field]);
  if (delta !== 0) return delta > 0 ? candidate : current;
  return candidate.id > current.id ? candidate : current;
}

function toStepEvent(row: StepEventRow, key: string): PortfolioStepEvent {
  return {
    key,
    task: row.task,
    phase: row.phase,
    step: row.step,
    status: row.status,
    origin: row.origin,
    seq: row.seq,
    at: row.at,
    receivedAt: row.received_at,
  };
}

function taskCounts(rows: readonly StepEventRow[]): { passed: number; seen: number } {
  const seen = new Set<string>();
  const passed = new Set<string>();
  for (const row of rows) {
    if (!row.task) continue;
    seen.add(row.task);
    if (row.step === "verdict" && row.status === "pass") passed.add(row.task);
  }
  return { passed: passed.size, seen: seen.size };
}

function executionOf(source: string | undefined): PortfolioProject["execution"] {
  if (source === "ci" || source === "local" || source === "import") return source;
  return null;
}

function linkStateOf(
  latest: StepEventRow | null,
  freshness: PortfolioProject["freshness"],
): LinkState {
  if (!latest) return "silent";
  if (freshness === "stale") return "stale";
  switch (latest.status) {
    case "started":
      return "active";
    case "pass":
    case "skipped":
      return "steady";
    case "revise":
      return "revise";
    case "fail":
      return "down";
    case "waiting":
      return latest.step === "gate" ? "gate" : "waiting";
    default:
      return "waiting";
  }
}

function freshnessOf(
  rows: readonly StepEventRow[],
  lastContactAt: string | null,
  staleAfterMinutes: number,
  now: Date,
): PortfolioProject["freshness"] {
  if (rows.length === 0 || lastContactAt === null) return "none";
  const age = now.getTime() - timeOf(lastContactAt);
  return age > staleAfterMinutes * 60 * 1000 ? "stale" : "fresh";
}

function compareProjects(a: PortfolioProject, b: PortfolioProject): number {
  const aContact = a.lastContactAt !== null;
  const bContact = b.lastContactAt !== null;
  if (aContact && bContact && a.lastContactAt && b.lastContactAt) {
    const delta = timeOf(b.lastContactAt) - timeOf(a.lastContactAt);
    if (delta !== 0) return delta;
  } else if (aContact !== bContact) {
    return aContact ? -1 : 1;
  }
  if (a.key < b.key) return -1;
  if (a.key > b.key) return 1;
  return 0;
}

export function aggregatePortfolio(input: AggregateInput, now: Date): Portfolio {
  const eventsByProject = new Map<string, StepEventRow[]>();
  for (const row of input.stepEventRows) {
    const list = eventsByProject.get(row.project_id);
    if (list) list.push(row);
    else eventsByProject.set(row.project_id, [row]);
  }

  const sourceByRun = new Map<string, string>();
  for (const row of input.runRows) sourceByRun.set(row.id, row.source);

  const keyByProject = new Map<string, string>();
  for (const row of input.projectRows) keyByProject.set(row.id, row.key);

  const projects = input.projectRows.map((project) => {
    const rows = eventsByProject.get(project.id) ?? [];
    const latestRow = rows.reduce<StepEventRow | null>((best, row) => (best === null ? row : laterRow(best, row)), null);
    const lastActivityAt = maxTime(rows, "at");
    const lastContactAt = maxTime(rows, "received_at");
    const freshness = freshnessOf(rows, lastContactAt, project.stale_after_minutes, now);
    const phaseId = latestRow?.phase ?? null;
    const recentRows = latestRow
      ? rows
          .filter((row) => row.run_id === latestRow.run_id)
          .sort((a, b) => b.seq - a.seq)
          .slice(0, RECENT_LIMIT)
      : [];
    return {
      key: project.key,
      repo: project.repo,
      staleAfterMinutes: project.stale_after_minutes,
      lastActivityAt,
      lastContactAt,
      latest: latestRow ? toStepEvent(latestRow, project.key) : null,
      freshness,
      execution: latestRow ? executionOf(sourceByRun.get(latestRow.run_id)) : null,
      tasks: taskCounts(rows),
      phase:
        phaseId === null
          ? null
          : { id: phaseId, ...taskCounts(rows.filter((row) => row.phase === phaseId)) },
      linkState: linkStateOf(latestRow, freshness),
      recent: recentRows.map((row) => toStepEvent(row, project.key)),
    } satisfies PortfolioProject;
  });
  projects.sort(compareProjects);

  const byLinkState = emptyByLinkState();
  let fresh = 0;
  let staleOrSilent = 0;
  let tasksPassed = 0;
  let tasksSeen = 0;
  for (const project of projects) {
    byLinkState[project.linkState] += 1;
    if (project.freshness === "fresh") fresh += 1;
    if (project.linkState === "stale" || project.linkState === "silent") staleOrSilent += 1;
    tasksPassed += project.tasks.passed;
    tasksSeen += project.tasks.seen;
  }

  const recentActivity = input.stepEventRows
    .filter((row) => keyByProject.has(row.project_id))
    .slice()
    .sort((a, b) => {
      const delta = timeOf(b.received_at) - timeOf(a.received_at);
      if (delta !== 0) return delta;
      return b.id - a.id;
    })
    .slice(0, RECENT_LIMIT)
    .map((row) => toStepEvent(row, keyByProject.get(row.project_id) ?? ""));

  let lastReceived: StepEventRow | null = null;
  let stepEventsLastHour = 0;
  const hourStart = now.getTime() - HOUR_MS;
  for (const row of input.stepEventRows) {
    lastReceived = lastReceived === null ? row : laterRow(lastReceived, row);
    if (timeOf(row.received_at) > hourStart) stepEventsLastHour += 1;
  }

  return {
    projects,
    totals: {
      projects: projects.length,
      fresh,
      staleOrSilent,
      tasksPassed,
      tasksSeen,
      measuredAttempts: new Set(input.measuredEventIds).size,
      byLinkState,
    },
    recentActivity,
    health: {
      lastReceivedAt: lastReceived ? lastReceived.received_at : null,
      stepEventsLastHour,
      deliveriesLast24h: input.deliveriesLast24h,
      rejectionsLast24h: input.rejectionsLast24h,
    },
    generatedAt: now.toISOString(),
  };
}
