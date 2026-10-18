import { describe, expect, it } from "vitest";
import {
  aggregateProject,
  type ProjectAggregateInput,
  type ProjectObservationRow,
  type ProjectRunRow,
  type ProjectStepEvent,
  type ProjectStepEventRow,
  type SeqGap,
} from "./aggregate";

const NOW = new Date("2026-10-17T12:00:00.000Z");

function run(id: string, runKey: string, createdAt: string, source = "ci"): ProjectRunRow {
  return { id, run_key: runKey, source, created_at: createdAt };
}

function step(row: Partial<ProjectStepEventRow> & Pick<ProjectStepEventRow, "id" | "run_id" | "seq">): ProjectStepEventRow {
  return {
    phase: "P01",
    task: "T01",
    step: "build",
    status: "pass",
    at: "2026-10-17T12:00:00.000Z",
    received_at: "2026-10-17T12:00:00.000Z",
    evidence: null,
    origin: "reported",
    ...row,
  };
}

function observation(
  row: Partial<ProjectObservationRow> & Pick<ProjectObservationRow, "id" | "received_at">,
): ProjectObservationRow {
  return {
    sha: "c0ffee1" + "0".repeat(33),
    kind: "status",
    context: "devos/checks",
    state: "success",
    at: row.received_at,
    ...row,
  };
}

function report(input: Partial<ProjectAggregateInput>, now = NOW) {
  return aggregateProject(
    {
      project: { key: "TRACE", repo: "fixture-org/trace-repo", staleAfterMinutes: 60 },
      runRows: [],
      stepEventRows: [],
      observationRows: [],
      ...input,
    },
    now,
  );
}

function isGap(entry: ProjectStepEvent | SeqGap): entry is SeqGap {
  return "missing" in entry;
}

describe("aggregateProject", () => {
  it("shows a gap at the start and a gap in the middle", () => {
    const result = report({
      runRows: [run("r1", "gha-1", "2026-10-17T10:00:00.000Z")],
      stepEventRows: [step({ id: 1, run_id: "r1", seq: 2 }), step({ id: 2, run_id: "r1", seq: 5 })],
    });
    expect(result.runs[0]?.entries.map((entry) => (isGap(entry) ? `gap ${entry.before}:${entry.missing}` : entry.seq))).toEqual([
      "gap 2:1",
      2,
      "gap 5:2",
      5,
    ]);
  });

  it("orders runs newest first and breaks a created_at tie by run key descending", () => {
    const result = report({
      runRows: [
        run("r1", "gha-a", "2026-10-17T10:00:00.000Z"),
        run("r2", "gha-c", "2026-10-17T11:00:00.000Z"),
        run("r3", "gha-b", "2026-10-17T11:00:00.000Z"),
      ],
      stepEventRows: [
        step({ id: 1, run_id: "r1", seq: 1 }),
        step({ id: 2, run_id: "r2", seq: 1 }),
        step({ id: 3, run_id: "r3", seq: 1 }),
      ],
    });
    expect(result.runs.map((item) => item.runKey)).toEqual(["gha-c", "gha-b", "gha-a"]);
  });

  it("orders step events by seq when at is reversed", () => {
    const result = report({
      runRows: [run("r1", "gha-1", "2026-10-17T10:00:00.000Z")],
      stepEventRows: [
        step({ id: 1, run_id: "r1", seq: 2, at: "2026-10-17T08:00:00.000Z" }),
        step({ id: 2, run_id: "r1", seq: 1, at: "2026-10-17T09:00:00.000Z" }),
      ],
    });
    const events = result.runs[0]?.entries.filter((entry): entry is ProjectStepEvent => !isGap(entry)) ?? [];
    expect(events.map((event) => event.seq)).toEqual([1, 2]);
    expect(result.runs[0]?.firstAt).toBe("2026-10-17T08:00:00.000Z");
    expect(result.runs[0]?.lastAt).toBe("2026-10-17T09:00:00.000Z");
  });

  it("keeps a task's latest event across two runs", () => {
    const result = report({
      runRows: [
        run("older", "gha-1", "2026-10-17T09:00:00.000Z"),
        run("newer", "gha-2", "2026-10-17T11:00:00.000Z"),
      ],
      stepEventRows: [
        step({ id: 1, run_id: "older", seq: 9, task: "T01", step: "verdict", status: "pass", origin: "reported" }),
        step({ id: 2, run_id: "newer", seq: 1, task: "T01", step: "build", status: "started", origin: "verified" }),
      ],
    });
    expect(result.phases[0]?.tasks).toEqual([
      {
        task: "T01",
        step: "build",
        status: "started",
        origin: "verified",
        receivedAt: "2026-10-17T12:00:00.000Z",
      },
    ]);
  });

  it("sorts phases in code-unit order with null last", () => {
    const result = report({
      runRows: [run("r1", "gha-1", "2026-10-17T10:00:00.000Z")],
      stepEventRows: [
        step({ id: 1, run_id: "r1", seq: 1, phase: "PM", task: "TM" }),
        step({ id: 2, run_id: "r1", seq: 2, phase: null, task: "TX" }),
        step({ id: 3, run_id: "r1", seq: 3, phase: "P02", task: "T02" }),
        step({ id: 4, run_id: "r1", seq: 4, phase: "P01", task: "T01" }),
        step({ id: 5, run_id: "r1", seq: 5, phase: "P09", task: null }),
      ],
    });
    expect(result.phases.map((phase) => phase.id)).toEqual(["P01", "P02", "PM", null]);
    expect(result.phases[0]?.tasks.map((task) => task.task)).toEqual(["T01"]);
  });

  it("parses a path, a commit alone, and evidence that is not a link", () => {
    const result = report({
      runRows: [run("r1", "gha-1", "2026-10-17T10:00:00.000Z")],
      stepEventRows: [
        step({ id: 1, run_id: "r1", seq: 1, evidence: "docs/reviews/T01-a1.md@c0ffee1" }),
        step({ id: 2, run_id: "r1", seq: 2, evidence: "@c0ffee1" }),
        step({ id: 3, run_id: "r1", seq: 3, evidence: "not a link" }),
      ],
    });
    const events = result.runs[0]?.entries.filter((entry): entry is ProjectStepEvent => !isGap(entry)) ?? [];
    expect(events.map((event) => event.evidence)).toEqual([
      { path: "docs/reviews/T01-a1.md", commit: "c0ffee1" },
      { path: null, commit: "c0ffee1" },
      null,
    ]);
  });

  it("marks a started step closed, running, or unfinished", () => {
    const result = report({
      runRows: [run("r1", "gha-1", "2026-10-17T10:00:00.000Z")],
      stepEventRows: [
        step({ id: 1, run_id: "r1", seq: 1, step: "build", status: "started", received_at: "2026-10-17T11:30:00.000Z" }),
        step({ id: 2, run_id: "r1", seq: 2, step: "build", status: "pass", received_at: "2026-10-17T11:40:00.000Z" }),
        step({ id: 3, run_id: "r1", seq: 3, step: "review", status: "started", received_at: "2026-10-17T11:30:00.000Z" }),
        step({ id: 4, run_id: "r1", seq: 4, step: "deploy", status: "started", received_at: "2026-10-17T10:00:00.000Z" }),
      ],
    });
    const events = result.runs[0]?.entries.filter((entry): entry is ProjectStepEvent => !isGap(entry)) ?? [];
    expect(events.map((event) => event.open)).toEqual([null, null, "running", "unfinished"]);
  });

  it("reports freshness as none, fresh, and stale", () => {
    expect(report({}).freshness).toBe("none");
    expect(
      report({
        runRows: [run("r1", "gha-1", "2026-10-17T12:00:00.000Z")],
        stepEventRows: [step({ id: 1, run_id: "r1", seq: 1, received_at: "2026-10-17T11:30:00.000Z" })],
      }).freshness,
    ).toBe("fresh");
    expect(
      report({
        runRows: [run("r1", "gha-1", "2026-10-17T08:00:00.000Z")],
        stepEventRows: [step({ id: 1, run_id: "r1", seq: 1, received_at: "2026-10-17T10:00:00.000Z" })],
      }).freshness,
    ).toBe("stale");
  });

  it("keeps last activity and last contact as separate maxima", () => {
    const result = report({
      runRows: [run("r1", "gha-1", "2026-10-17T10:00:00.000Z")],
      stepEventRows: [
        step({ id: 1, run_id: "r1", seq: 1, at: "2026-10-17T08:00:00.000Z", received_at: "2026-10-17T12:00:00.000Z" }),
        step({ id: 2, run_id: "r1", seq: 2, at: "2026-10-17T11:00:00.000Z", received_at: "2026-10-17T09:00:00.000Z" }),
      ],
    });
    expect(result.lastActivityAt).toBe("2026-10-17T11:00:00.000Z");
    expect(result.lastContactAt).toBe("2026-10-17T12:00:00.000Z");
  });

  it("orders observations by received_at and then id, both descending", () => {
    const result = report({
      observationRows: [
        observation({ id: 1, received_at: "2026-10-17T10:00:00.000Z" }),
        observation({ id: 3, received_at: "2026-10-17T12:00:00.000Z" }),
        observation({ id: 2, received_at: "2026-10-17T12:00:00.000Z" }),
      ],
    });
    expect(result.observations.map((item) => item.id)).toEqual([3, 2, 1]);
  });
});
