import { describe, expect, it } from "vitest";
import {
  aggregateUsage,
  type UsageAttemptRow,
  type UsageProject,
  type UsageStepEventRow,
} from "./aggregate";

const NOW = new Date("2026-10-18T12:00:00.000Z");

function project(staleAfterMinutes = 1440): UsageProject {
  return { key: "USAGE", repo: "fixture-org/usage-repo", staleAfterMinutes };
}

function event(row: Partial<UsageStepEventRow> & Pick<UsageStepEventRow, "id">): UsageStepEventRow {
  return {
    step: "build",
    status: "pass",
    received_at: "2026-10-18T11:00:00.000Z",
    usage: [],
    ...row,
  };
}

function attempt(row: Partial<UsageAttemptRow> = {}): UsageAttemptRow {
  return {
    phase: "P01",
    task: "T01",
    run_key: "gha-1-1",
    run_created_at: "2026-10-18T10:00:00.000Z",
    agent: "builder",
    model: "grok-4.7-high",
    account_alias: "cursor-1",
    input: null,
    output: null,
    cache_read: null,
    cache_write: null,
    source: "unavailable",
    status: "pass",
    at: "2026-10-18T10:00:00.000Z",
    origin: "reported",
    received_at: "2026-10-18T11:00:00.000Z",
    ...row,
  };
}

function report(
  stepEventRows: readonly UsageStepEventRow[],
  attemptRows: readonly UsageAttemptRow[] = [],
  now = NOW,
  staleAfterMinutes = 1440,
) {
  return aggregateUsage({ project: project(staleAfterMinutes), stepEventRows, attemptRows }, now);
}

describe("aggregateUsage", () => {
  it("excludes started and counts waiting as an ended attempt", () => {
    const result = report([
      event({ id: 1, status: "started" }),
      event({ id: 2, status: "waiting", usage: [{ agent: "builder", source: "measured" }] }),
      event({ id: 3, step: "review", status: "started" }),
      event({ id: 4, step: "verdict", status: "fail" }),
    ]);
    expect(result.coverage).toEqual([
      { agent: "reviewer", ended: 0, measured: 0 },
      { agent: "builder", ended: 1, measured: 1 },
    ]);
  });

  it("counts an attempt without usage as not measured", () => {
    const result = report([event({ id: 1, usage: [] })]);
    expect(result.coverage[1]).toEqual({ agent: "builder", ended: 1, measured: 0 });
  });

  it("counts a mixed attempt as not measured", () => {
    const result = report([
      event({
        id: 1,
        usage: [
          { agent: "builder", source: "measured" },
          { agent: "builder", source: "unavailable" },
        ],
      }),
    ]);
    expect(result.coverage[1]).toEqual({ agent: "builder", ended: 1, measured: 0 });
  });

  it("keeps null totals when the agent has no measured view row", () => {
    const result = report(
      [event({ id: 1 })],
      [attempt({ source: "unavailable", input: 999, output: 999, cache_read: 999, cache_write: 999 })],
    );
    expect(result.byAgent[1]).toEqual({
      agent: "builder",
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: null,
    });
  });

  it("sums measured rows and keeps a null field null while keeping zero", () => {
    const result = report(
      [],
      [
        attempt({ source: "measured", input: 100, output: 0, cache_read: null, cache_write: 4 }),
        attempt({ source: "measured", input: 50, output: null, cache_read: null, cache_write: 1, run_key: "gha-2-1" }),
        attempt({ source: "unavailable", input: 999, run_key: "gha-3-1" }),
      ],
    );
    expect(result.byAgent[1]).toEqual({
      agent: "builder",
      input: 150,
      output: 0,
      cacheRead: null,
      cacheWrite: 5,
    });
  });

  it("splits failed attempts from the others", () => {
    const result = report(
      [],
      [attempt({ status: "pass", run_key: "gha-1-1" }), attempt({ status: "fail", run_key: "gha-2-1" })],
    );
    expect(result.attempts.map((row) => row.runKey)).toEqual(["gha-1-1"]);
    expect(result.failedAttempts.map((row) => row.status)).toEqual(["fail"]);
  });

  it("sorts by phase and task with nulls last, then run, builder first, model and alias", () => {
    const rows = [
      attempt({ phase: null, task: "T01", run_key: "null-phase" }),
      attempt({ phase: "P01", task: null, run_key: "null-task" }),
      attempt({ phase: "P02", task: "T01", run_key: "later-phase" }),
      attempt({ phase: "P01", task: "T02", run_key: "later-task" }),
      attempt({
        phase: "P01",
        task: "T01",
        run_key: "gha-b",
        run_created_at: "2026-10-18T10:00:00.000Z",
        agent: "reviewer",
        model: "m-b",
        account_alias: "a-b",
      }),
      attempt({
        phase: "P01",
        task: "T01",
        run_key: "gha-b",
        run_created_at: "2026-10-18T10:00:00.000Z",
        agent: "builder",
        model: "m-b",
        account_alias: "a-a",
      }),
      attempt({
        phase: "P01",
        task: "T01",
        run_key: "gha-a",
        run_created_at: "2026-10-18T09:00:00.000Z",
        agent: "reviewer",
        model: "m-a",
        account_alias: "a-a",
      }),
      attempt({
        phase: "P01",
        task: "T01",
        run_key: "gha-b",
        run_created_at: "2026-10-18T10:00:00.000Z",
        agent: "builder",
        model: "m-a",
        account_alias: "a-b",
      }),
    ];
    const result = report([], rows);
    expect(result.attempts.map((row) => `${row.phase ?? "-"}:${row.task ?? "-"}:${row.runKey}:${row.agent}:${row.model}:${row.accountAlias}`)).toEqual([
      "P01:T01:gha-a:reviewer:m-a:a-a",
      "P01:T01:gha-b:builder:m-a:a-b",
      "P01:T01:gha-b:builder:m-b:a-a",
      "P01:T01:gha-b:reviewer:m-b:a-b",
      "P01:T02:later-task:builder:grok-4.7-high:cursor-1",
      "P01:-:null-task:builder:grok-4.7-high:cursor-1",
      "P02:T01:later-phase:builder:grok-4.7-high:cursor-1",
      "-:T01:null-phase:builder:grok-4.7-high:cursor-1",
    ]);
  });

  it("reports freshness none when the project has no step event", () => {
    expect(report([]).freshness).toBe("none");
    expect(report([]).lastContactAt).toBeNull();
  });

  it("reports freshness fresh inside the stale window", () => {
    const result = report([event({ id: 1, received_at: "2026-10-18T11:30:00.000Z" })]);
    expect(result.freshness).toBe("fresh");
    expect(result.lastContactAt).toBe("2026-10-18T11:30:00.000Z");
  });

  it("reports freshness stale when the age exceeds stale_after_minutes", () => {
    const result = report([event({ id: 4, received_at: "2026-10-17T11:00:00.000Z" })], [], NOW, 60);
    expect(result.freshness).toBe("stale");
  });

  it("counts byModel attempts and measured rows with reviewer first", () => {
    const result = report(
      [
        event({
          id: 1,
          step: "review",
          usage: [
            { agent: "reviewer", source: "measured" },
            { agent: "reviewer", source: "measured" },
          ],
        }),
      ],
      [
        attempt({ agent: "builder", model: "grok-4.7-high", source: "unavailable" }),
        attempt({
          agent: "reviewer",
          model: "claude-sonnet-5-5",
          source: "measured",
          input: 3,
          output: null,
          run_key: "gha-2-1",
        }),
        attempt({
          agent: "reviewer",
          model: "claude-opus-5-5",
          source: "measured",
          input: 10,
          run_key: "gha-3-1",
        }),
        attempt({
          agent: "reviewer",
          model: "claude-opus-5-5",
          source: "unavailable",
          input: 99,
          run_key: "gha-4-1",
        }),
      ],
    );
    expect(result.coverage[0]).toEqual({ agent: "reviewer", ended: 1, measured: 1 });
    expect(result.byModel).toEqual([
      {
        agent: "reviewer",
        model: "claude-opus-5-5",
        attempts: 2,
        measured: 1,
        input: 10,
        output: null,
        cacheRead: null,
        cacheWrite: null,
      },
      {
        agent: "reviewer",
        model: "claude-sonnet-5-5",
        attempts: 1,
        measured: 1,
        input: 3,
        output: null,
        cacheRead: null,
        cacheWrite: null,
      },
      {
        agent: "builder",
        model: "grok-4.7-high",
        attempts: 1,
        measured: 0,
        input: null,
        output: null,
        cacheRead: null,
        cacheWrite: null,
      },
    ]);
  });
});
