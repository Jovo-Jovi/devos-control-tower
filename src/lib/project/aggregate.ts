export type ProjectReport = {
  project: { key: string; repo: string; staleAfterMinutes: number };
  freshness: "none" | "fresh" | "stale";
  lastContactAt: string | null;
  lastActivityAt: string | null;
  phases: ProjectPhase[];
  runs: ProjectRun[];
  observations: ProjectObservation[];
};

export type ProjectPhase = {
  id: string | null;
  tasks: ProjectTask[];
};

export type ProjectTask = {
  task: string;
  step: string;
  status: string;
  origin: string;
  receivedAt: string;
};

export type ProjectRun = {
  runKey: string;
  source: string;
  createdAt: string;
  firstAt: string | null;
  lastAt: string | null;
  entries: Array<ProjectStepEvent | SeqGap>;
};

export type SeqGap = {
  before: number;
  missing: number;
};

export type ProjectStepEvent = {
  seq: number;
  phase: string | null;
  task: string | null;
  step: string;
  status: string;
  origin: string;
  at: string;
  receivedAt: string;
  evidence: { path: string | null; commit: string } | null;
  open: "running" | "unfinished" | null;
};

export type ProjectObservation = {
  id: number;
  sha: string;
  kind: string;
  context: string | null;
  state: string;
  at: string;
  receivedAt: string;
};

export type ProjectRunRow = {
  id: string;
  run_key: string;
  source: string;
  created_at: string;
};

export type ProjectStepEventRow = {
  id: number;
  run_id: string;
  seq: number;
  phase: string | null;
  task: string | null;
  step: string;
  status: string;
  at: string;
  received_at: string;
  evidence: string | null;
  origin: string;
};

export type ProjectObservationRow = {
  id: number;
  sha: string;
  kind: string;
  context: string | null;
  state: string;
  at: string;
  received_at: string;
};

export type ProjectAggregateInput = {
  project: { key: string; repo: string; staleAfterMinutes: number };
  runRows: ProjectRunRow[];
  stepEventRows: ProjectStepEventRow[];
  observationRows: ProjectObservationRow[];
};

const COMMIT_ONLY = /^@([0-9a-f]{7,40})$/;
const PATH_AND_COMMIT = /^(.+)@([0-9a-f]{7,40})$/;

function timeOf(value: string): number {
  return Date.parse(value);
}

function evidenceOf(value: string | null): ProjectStepEvent["evidence"] {
  if (!value) return null;
  const commitOnly = COMMIT_ONLY.exec(value);
  if (commitOnly?.[1]) return { path: null, commit: commitOnly[1] };
  const withPath = PATH_AND_COMMIT.exec(value);
  if (withPath?.[1] && withPath[2]) return { path: withPath[1], commit: withPath[2] };
  return null;
}

function laterTime(current: string, candidate: string): string {
  return timeOf(candidate) > timeOf(current) ? candidate : current;
}

function earlierTime(current: string, candidate: string): string {
  return timeOf(candidate) < timeOf(current) ? candidate : current;
}

type TaskCandidate = {
  event: ProjectStepEventRow;
  createdAt: string;
  runKey: string;
};

function laterTask(current: TaskCandidate, candidate: TaskCandidate): TaskCandidate {
  const time = timeOf(candidate.createdAt) - timeOf(current.createdAt);
  if (time !== 0) return time > 0 ? candidate : current;
  if (candidate.runKey !== current.runKey) return candidate.runKey > current.runKey ? candidate : current;
  return candidate.event.seq > current.event.seq ? candidate : current;
}

function comparePhase(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function freshnessOf(
  rows: readonly ProjectStepEventRow[],
  lastContactAt: string | null,
  staleAfterMinutes: number,
  now: Date,
): ProjectReport["freshness"] {
  if (rows.length === 0 || lastContactAt === null) return "none";
  const age = now.getTime() - timeOf(lastContactAt);
  return age > staleAfterMinutes * 60 * 1000 ? "stale" : "fresh";
}

function openOf(
  event: ProjectStepEventRow,
  events: readonly ProjectStepEventRow[],
  staleAfterMinutes: number,
  now: Date,
): ProjectStepEvent["open"] {
  if (event.status !== "started") return null;
  const closed = events.some((other) => other.seq > event.seq && other.step === event.step);
  if (closed) return null;
  const age = now.getTime() - timeOf(event.received_at);
  return age <= staleAfterMinutes * 60 * 1000 ? "running" : "unfinished";
}

export function aggregateProject(input: ProjectAggregateInput, now: Date): ProjectReport {
  const runsById = new Map(input.runRows.map((row) => [row.id, row]));
  const eventsByRun = new Map<string, ProjectStepEventRow[]>();
  for (const event of input.stepEventRows) {
    if (!runsById.has(event.run_id)) continue;
    const list = eventsByRun.get(event.run_id);
    if (list) list.push(event);
    else eventsByRun.set(event.run_id, [event]);
  }

  let lastContactAt: string | null = null;
  let lastActivityAt: string | null = null;
  for (const event of input.stepEventRows) {
    lastContactAt = lastContactAt === null ? event.received_at : laterTime(lastContactAt, event.received_at);
    lastActivityAt = lastActivityAt === null ? event.at : laterTime(lastActivityAt, event.at);
  }

  const latestByTask = new Map<string, TaskCandidate>();
  for (const event of input.stepEventRows) {
    if (event.task === null) continue;
    const run = runsById.get(event.run_id);
    if (!run) continue;
    const candidate = { event, createdAt: run.created_at, runKey: run.run_key };
    const current = latestByTask.get(event.task);
    latestByTask.set(event.task, current ? laterTask(current, candidate) : candidate);
  }

  const tasksByPhase = new Map<string | null, ProjectTask[]>();
  for (const candidate of latestByTask.values()) {
    const phase = candidate.event.phase;
    const task: ProjectTask = {
      task: candidate.event.task ?? "",
      step: candidate.event.step,
      status: candidate.event.status,
      origin: candidate.event.origin,
      receivedAt: candidate.event.received_at,
    };
    const list = tasksByPhase.get(phase);
    if (list) list.push(task);
    else tasksByPhase.set(phase, [task]);
  }
  const phases = [...tasksByPhase.entries()]
    .sort((a, b) => comparePhase(a[0], b[0]))
    .map(([id, tasks]) => ({
      id,
      tasks: tasks.sort((a, b) => (a.task < b.task ? -1 : a.task > b.task ? 1 : 0)),
    }));

  const runs = input.runRows
    .map((run) => {
      const events = (eventsByRun.get(run.id) ?? []).slice().sort((a, b) => a.seq - b.seq);
      let firstAt: string | null = null;
      let lastAt: string | null = null;
      for (const event of events) {
        firstAt = firstAt === null ? event.at : earlierTime(firstAt, event.at);
        lastAt = lastAt === null ? event.at : laterTime(lastAt, event.at);
      }
      const entries: Array<ProjectStepEvent | SeqGap> = [];
      let previous = 0;
      for (const event of events) {
        if (event.seq > previous + 1) {
          entries.push({ before: event.seq, missing: event.seq - previous - 1 });
        }
        entries.push({
          seq: event.seq,
          phase: event.phase,
          task: event.task,
          step: event.step,
          status: event.status,
          origin: event.origin,
          at: event.at,
          receivedAt: event.received_at,
          evidence: evidenceOf(event.evidence),
          open: openOf(event, events, input.project.staleAfterMinutes, now),
        });
        previous = event.seq;
      }
      return {
        runKey: run.run_key,
        source: run.source,
        createdAt: run.created_at,
        firstAt,
        lastAt,
        entries,
      } satisfies ProjectRun;
    })
    .sort((a, b) => {
      const time = timeOf(b.createdAt) - timeOf(a.createdAt);
      if (time !== 0) return time;
      if (a.runKey < b.runKey) return 1;
      if (a.runKey > b.runKey) return -1;
      return 0;
    });

  const observations = input.observationRows
    .map((row) => ({
      id: row.id,
      sha: row.sha,
      kind: row.kind,
      context: row.context,
      state: row.state,
      at: row.at,
      receivedAt: row.received_at,
    }))
    .sort((a, b) => {
      const time = timeOf(b.receivedAt) - timeOf(a.receivedAt);
      if (time !== 0) return time;
      return b.id - a.id;
    });

  return {
    project: input.project,
    freshness: freshnessOf(input.stepEventRows, lastContactAt, input.project.staleAfterMinutes, now),
    lastContactAt,
    lastActivityAt,
    phases,
    runs,
    observations,
  };
}
