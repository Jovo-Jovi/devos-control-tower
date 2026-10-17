import { describe, expect, it } from "vitest";
import { parseStepEvent } from "./step-event";

const passVerdict = {
  v: 1,
  project: "PILOT",
  run: "gha-18234567890-1",
  seq: 9,
  phase: "P07",
  task: "T26",
  step: "verdict",
  status: "pass",
  at: "2026-10-21T09:14:03.512Z",
  evidence: "docs/reviews/T26-a1.md@9f3c2ab",
};

const failChecks = {
  v: 1,
  project: "PILOT",
  run: "gha-18234570001-1",
  seq: 4,
  phase: "P07",
  task: "T27",
  step: "checks",
  status: "fail",
  at: "2026-10-22T07:02:41Z",
  evidence: "@c01dbee",
};

const reviseVerdict = {
  v: 1,
  project: "TOWER",
  run: "gha-18300000123-1",
  seq: 9,
  phase: "P03",
  task: "T09",
  step: "verdict",
  status: "revise",
  at: "2026-11-04T15:40:12.004Z",
  evidence: "docs/reviews/T09-a1.md@77ab190",
};

const measuredUsage = {
  agent: "reviewer",
  tool: "claude-code",
  model: "claude-sonnet-5-5",
  account_alias: "claude-1",
  input: 184203,
  output: 9120,
  cache_read: 1620044,
  cache_write: 88010,
  source: "measured",
};

const reviewMeasured = {
  v: 1,
  project: "PILOT",
  run: "gha-18234567890-1",
  seq: 8,
  phase: "P07",
  task: "T26",
  step: "review",
  status: "pass",
  at: "2026-10-21T09:13:58.120Z",
  evidence: "docs/reviews/T26-a1.md@9f3c2ab",
  usage: [measuredUsage],
};

const unavailableUsage = {
  agent: "builder",
  tool: "cursor-agent",
  model: "grok-4.7-high",
  account_alias: "cursor-1",
  input: null,
  output: null,
  cache_read: null,
  cache_write: null,
  source: "unavailable",
};

const buildUnavailable = {
  v: 1,
  project: "PILOT",
  run: "gha-18234567890-1",
  seq: 3,
  phase: "P07",
  task: "T26",
  step: "build",
  status: "pass",
  at: "2026-10-21T08:52:30Z",
  evidence: "@c01dbee",
  usage: [unavailableUsage],
};

const waitingBuild = {
  v: 1,
  project: "PILOT",
  run: "gha-18234580002-1",
  seq: 2,
  phase: "PM",
  task: "PM02",
  step: "build",
  status: "waiting",
  at: "2026-10-23T11:30:00Z",
  evidence: null,
};

const startedBuild = {
  v: 1,
  project: "PILOT",
  run: "gha-18234567890-1",
  seq: 2,
  phase: "P07",
  task: "T26",
  step: "build",
  status: "started",
  at: "2026-10-21T08:31:10Z",
  evidence: "@4ccbef7",
};

const skippedGate = {
  v: 1,
  project: "PILOT",
  run: "gha-18234567890-1",
  seq: 10,
  phase: "P07",
  task: "T26",
  step: "gate",
  status: "skipped",
  at: "2026-10-21T09:14:05Z",
  evidence: "docs/reviews/T26-a1.md@9f3c2ab",
};

const imported = {
  v: 1,
  project: "PILOT",
  run: "import-4ccbef7",
  seq: 61,
  phase: "P05",
  task: "T14",
  step: "verdict",
  status: "pass",
  at: "2026-10-12T18:22:09Z",
  evidence: "docs/reviews/T14-a2.md@b7e1f00",
};

const contractEvents = [
  ["pass verdict", passVerdict],
  ["fail checks", failChecks],
  ["revise verdict", reviseVerdict],
  ["review measured usage", reviewMeasured],
  ["build unavailable usage", buildUnavailable],
  ["waiting build", waitingBuild],
  ["started build", startedBuild],
  ["skipped gate", skippedGate],
  ["imported", imported],
] as const;

describe("U-T02-1 parseStepEvent", () => {
  it.each(contractEvents)("parses the contract example %s", (_name, event) => {
    expect(parseStepEvent(event)).toEqual(event);
  });

  it.each([
    ["extra field", { ...passVerdict, extra: true }],
    ["v 2", { ...passVerdict, v: 2 }],
    ["bad project", { ...passVerdict, project: "pilot" }],
    ["bad run", { ...passVerdict, run: "gha-1" }],
    ["bad phase", { ...passVerdict, phase: "phase" }],
    ["bad task", { ...passVerdict, task: "task" }],
    ["bad at", { ...passVerdict, at: "2026-10-21T09:14:03+00:00" }],
    ["bad evidence", { ...passVerdict, evidence: "docs/reviews/T26-a1.md@zz" }],
    ["seq 0", { ...passVerdict, seq: 0 }],
    ["seq 1.5", { ...passVerdict, seq: 1.5 }],
    ["seq 100001", { ...passVerdict, seq: 100001 }],
    ["usage on checks", { ...failChecks, usage: [measuredUsage] }],
    ["usage on build started", { ...startedBuild, usage: [unavailableUsage] }],
    ["five usage entries", { ...buildUnavailable, usage: Array.from({ length: 5 }, () => unavailableUsage) }],
    ["unavailable with a number", { ...buildUnavailable, usage: [{ ...unavailableUsage, input: 1 }] }],
  ] as const)("refuses %s", (_name, event) => {
    expect(parseStepEvent(event)).toBeNull();
  });
});
