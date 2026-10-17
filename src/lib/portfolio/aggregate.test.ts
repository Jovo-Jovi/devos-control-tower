import { describe, expect, it } from "vitest";
import {
  aggregatePortfolio,
  type AggregateInput,
  type ProjectRow,
  type RunRow,
  type StepEventRow,
} from "./aggregate";

const NOW = new Date("2026-10-17T12:00:00.000Z");

function project(id: string, key: string, staleAfterMinutes = 60): ProjectRow {
  return { id, key, repo: `fixture-org/${key.toLowerCase()}`, stale_after_minutes: staleAfterMinutes };
}

function step(row: Partial<StepEventRow> & Pick<StepEventRow, "id" | "project_id">): StepEventRow {
  return {
    run_id: "run-1",
    seq: 1,
    phase: "P01",
    task: "T02",
    step: "checks",
    status: "pass",
    origin: "reported",
    at: "2026-10-17T12:00:00.000Z",
    received_at: "2026-10-17T12:00:00.000Z",
    ...row,
  };
}

function run(id: string, source: string): RunRow {
  return { id, source };
}

function portfolio(input: Partial<AggregateInput>, now = NOW) {
  return aggregatePortfolio(
    {
      projectRows: [],
      stepEventRows: [],
      runRows: [],
      measuredEventIds: [],
      deliveriesLast24h: 0,
      rejectionsLast24h: 0,
      ...input,
    },
    now,
  );
}

describe("aggregatePortfolio", () => {
  it("breaks a received_at tie by the greatest id", () => {
    const result = portfolio({
      projectRows: [project("p1", "ALPHA")],
      stepEventRows: [
        step({ id: 1, project_id: "p1", step: "build", status: "started" }),
        step({ id: 4, project_id: "p1", step: "checks", status: "pass" }),
        step({ id: 3, project_id: "p1", step: "verdict", status: "fail" }),
      ],
      runRows: [run("run-1", "ci")],
    });
    expect(result.projects[0]?.latest?.step).toBe("checks");
    expect(result.projects[0]?.latest?.status).toBe("pass");
  });

  it("keeps last activity and last contact as separate maxima", () => {
    const result = portfolio({
      projectRows: [project("p1", "ALPHA")],
      stepEventRows: [
        step({
          id: 1,
          project_id: "p1",
          at: "2026-10-17T10:00:00.000Z",
          received_at: "2026-10-17T12:00:00.000Z",
        }),
        step({
          id: 2,
          project_id: "p1",
          at: "2026-10-17T11:00:00.000Z",
          received_at: "2026-10-17T09:00:00.000Z",
        }),
      ],
    });
    expect(result.projects[0]?.lastActivityAt).toBe("2026-10-17T11:00:00.000Z");
    expect(result.projects[0]?.lastContactAt).toBe("2026-10-17T12:00:00.000Z");
  });

  it("stays fresh when contact is exactly at the stale window", () => {
    const result = portfolio({
      projectRows: [project("p1", "ALPHA", 60)],
      stepEventRows: [
        step({ id: 1, project_id: "p1", received_at: "2026-10-17T11:00:00.000Z", at: "2026-10-17T11:00:00.000Z" }),
      ],
    });
    expect(result.projects[0]?.freshness).toBe("fresh");
    expect(result.projects[0]?.linkState).toBe("steady");
  });

  it("is none without step events", () => {
    const result = portfolio({ projectRows: [project("p1", "ALPHA")] });
    expect(result.projects[0]?.freshness).toBe("none");
    expect(result.projects[0]?.latest).toBeNull();
    expect(result.projects[0]?.lastActivityAt).toBeNull();
    expect(result.projects[0]?.lastContactAt).toBeNull();
    expect(result.projects[0]?.linkState).toBe("silent");
  });

  it("sorts projects with contact first, then the rest by key", () => {
    const result = portfolio({
      projectRows: [
        project("p-zulu", "ZULU"),
        project("p-mike", "MIKE"),
        project("p-alpha", "ALPHA"),
        project("p-beta", "BETA"),
      ],
      stepEventRows: [
        step({ id: 1, project_id: "p-alpha", received_at: "2026-10-17T10:00:00.000Z" }),
        step({ id: 2, project_id: "p-beta", received_at: "2026-10-17T11:00:00.000Z" }),
      ],
    });
    expect(result.projects.map((row) => row.key)).toEqual(["BETA", "ALPHA", "MIKE", "ZULU"]);
  });

  it("maps each link state, and stale beats a passing status", () => {
    const rows = [
      project("active", "ACTIVE"),
      project("steady", "STEADY"),
      project("skipped", "SKIPPED"),
      project("revise", "REVISE"),
      project("waiting", "WAITING"),
      project("gate", "GATE"),
      project("down", "DOWN"),
      project("stale", "STALE"),
      project("silent", "SILENT"),
    ];
    const events = [
      step({ id: 1, project_id: "active", status: "started", step: "build" }),
      step({ id: 2, project_id: "steady", status: "pass", step: "checks" }),
      step({ id: 3, project_id: "skipped", status: "skipped", step: "checks" }),
      step({ id: 4, project_id: "revise", status: "revise", step: "verdict" }),
      step({ id: 5, project_id: "waiting", status: "waiting", step: "build" }),
      step({ id: 6, project_id: "gate", status: "waiting", step: "gate" }),
      step({ id: 7, project_id: "down", status: "fail", step: "checks" }),
      step({
        id: 8,
        project_id: "stale",
        status: "pass",
        step: "checks",
        received_at: "2026-10-17T10:00:00.000Z",
        at: "2026-10-17T10:00:00.000Z",
      }),
    ];
    const result = portfolio({ projectRows: rows, stepEventRows: events });
    const byKey = Object.fromEntries(result.projects.map((row) => [row.key, row.linkState]));
    expect(byKey).toEqual({
      ACTIVE: "active",
      STEADY: "steady",
      SKIPPED: "steady",
      REVISE: "revise",
      WAITING: "waiting",
      GATE: "gate",
      DOWN: "down",
      STALE: "stale",
      SILENT: "silent",
    });
  });

  it("reads execution from the latest step event's run", () => {
    const result = portfolio({
      projectRows: [project("p1", "ALPHA"), project("p2", "BRAVO"), project("p3", "CHARLIE"), project("p4", "DELTA")],
      stepEventRows: [
        step({ id: 1, project_id: "p1", run_id: "ci-run" }),
        step({ id: 2, project_id: "p2", run_id: "local-run" }),
        step({ id: 3, project_id: "p3", run_id: "import-run" }),
        step({ id: 4, project_id: "p4", run_id: "missing-run" }),
      ],
      runRows: [run("ci-run", "ci"), run("local-run", "local"), run("import-run", "import")],
    });
    const byKey = Object.fromEntries(result.projects.map((row) => [row.key, row.execution]));
    expect(byKey).toEqual({ ALPHA: "ci", BRAVO: "local", CHARLIE: "import", DELTA: null });
  });

  it("counts each task once across runs and passes only verdict pass", () => {
    const result = portfolio({
      projectRows: [project("p1", "ALPHA")],
      stepEventRows: [
        step({ id: 1, project_id: "p1", run_id: "run-a", task: "T02", step: "checks", status: "pass", phase: "P01" }),
        step({ id: 2, project_id: "p1", run_id: "run-b", task: "T02", step: "verdict", status: "pass", phase: "P01", seq: 2 }),
        step({ id: 3, project_id: "p1", run_id: "run-b", task: "T03", step: "checks", status: "pass", phase: "P01", seq: 3 }),
        step({ id: 4, project_id: "p1", run_id: "run-b", task: null, step: "build", status: "started", phase: "P02", seq: 4, received_at: "2026-10-17T12:05:00.000Z" }),
      ],
      runRows: [run("run-a", "ci"), run("run-b", "local")],
    });
    const alpha = result.projects[0];
    expect(alpha?.tasks).toEqual({ passed: 1, seen: 2 });
    expect(alpha?.phase).toEqual({ id: "P02", passed: 0, seen: 0 });
    expect(alpha?.execution).toBe("local");
  });

  it("keeps at most six step events of the latest run, newest seq first", () => {
    const events = [1, 2, 3, 4, 5, 6, 7].map((seq) =>
      step({ id: seq, project_id: "p1", run_id: "run-new", seq, received_at: "2026-10-17T12:00:00.000Z" }),
    );
    events.push(step({ id: 8, project_id: "p1", run_id: "run-old", seq: 99, received_at: "2026-10-17T11:00:00.000Z" }));
    const result = portfolio({
      projectRows: [project("p1", "ALPHA")],
      stepEventRows: events,
    });
    expect(result.projects[0]?.recent.map((row) => row.seq)).toEqual([7, 6, 5, 4, 3, 2]);
  });

  it("orders recent activity by received_at and breaks ties by id", () => {
    const result = portfolio({
      projectRows: [project("p1", "ALPHA"), project("p2", "BRAVO")],
      stepEventRows: [
        step({ id: 1, project_id: "p1", received_at: "2026-10-17T10:00:00.000Z", step: "old" }),
        step({ id: 2, project_id: "p1", received_at: "2026-10-17T12:00:00.000Z", step: "tie-low" }),
        step({ id: 5, project_id: "p2", received_at: "2026-10-17T12:00:00.000Z", step: "tie-high" }),
        step({ id: 4, project_id: "p2", received_at: "2026-10-17T11:00:00.000Z", step: "mid" }),
      ],
    });
    expect(result.recentActivity.map((row) => `${row.key}:${row.step}`)).toEqual([
      "BRAVO:tie-high",
      "ALPHA:tie-low",
      "BRAVO:mid",
      "ALPHA:old",
    ]);
  });

  it("counts step events in the last hour strictly after the boundary", () => {
    const now = new Date("2026-10-17T12:00:00.000Z");
    const result = portfolio(
      {
        projectRows: [project("p1", "ALPHA")],
        stepEventRows: [
          step({ id: 1, project_id: "p1", received_at: "2026-10-17T11:00:00.000Z" }),
          step({ id: 2, project_id: "p1", received_at: "2026-10-17T10:59:59.999Z" }),
          step({ id: 3, project_id: "p1", received_at: "2026-10-17T11:00:00.001Z" }),
        ],
      },
      now,
    );
    expect(result.health.stepEventsLastHour).toBe(1);
    expect(result.health.lastReceivedAt).toBe("2026-10-17T11:00:00.001Z");
  });

  it("returns zeros and all eight link-state keys for empty input", () => {
    const result = portfolio({ deliveriesLast24h: 4, rejectionsLast24h: 2 });
    expect(result.projects).toEqual([]);
    expect(result.recentActivity).toEqual([]);
    expect(result.totals.projects).toBe(0);
    expect(result.totals.fresh).toBe(0);
    expect(result.totals.staleOrSilent).toBe(0);
    expect(result.totals.tasksPassed).toBe(0);
    expect(result.totals.tasksSeen).toBe(0);
    expect(result.totals.measuredAttempts).toBe(0);
    expect(result.totals.byLinkState).toEqual({
      active: 0,
      steady: 0,
      revise: 0,
      waiting: 0,
      gate: 0,
      down: 0,
      stale: 0,
      silent: 0,
    });
    expect(result.health).toEqual({
      lastReceivedAt: null,
      stepEventsLastHour: 0,
      deliveriesLast24h: 4,
      rejectionsLast24h: 2,
    });
    expect(result.generatedAt).toBe(NOW.toISOString());
  });

  it("counts distinct measured event ids", () => {
    const result = portfolio({ measuredEventIds: [3, 3, 9, 1] });
    expect(result.totals.measuredAttempts).toBe(3);
  });

  it("sums fresh and stale-or-silent projects", () => {
    const result = portfolio({
      projectRows: [project("p1", "ALPHA"), project("p2", "BRAVO"), project("p3", "CHARLIE")],
      stepEventRows: [
        step({ id: 1, project_id: "p1", received_at: "2026-10-17T12:00:00.000Z" }),
        step({ id: 2, project_id: "p2", received_at: "2026-10-17T09:00:00.000Z", at: "2026-10-17T09:00:00.000Z" }),
      ],
    });
    expect(result.totals.projects).toBe(3);
    expect(result.totals.fresh).toBe(1);
    expect(result.totals.staleOrSilent).toBe(2);
    expect(result.totals.byLinkState.steady).toBe(1);
    expect(result.totals.byLinkState.stale).toBe(1);
    expect(result.totals.byLinkState.silent).toBe(1);
  });
});
