export type StepStatus = "started" | "pass" | "fail" | "revise" | "waiting" | "skipped";

export type EventUsage = {
  agent: "builder" | "reviewer";
  tool: string;
  model: string;
  account_alias: string;
  input: number | null;
  output: number | null;
  cache_read: number | null;
  cache_write: number | null;
  source: "measured" | "unavailable";
};

export type StepEvent = {
  v: 1;
  project: string;
  run: string;
  seq: number;
  phase: string | null;
  task: string | null;
  step:
    | "intake"
    | "fence"
    | "build"
    | "checks"
    | "guards"
    | "evidence"
    | "review"
    | "verdict"
    | "gate"
    | "merge"
    | "deploy";
  status: StepStatus;
  at: string;
  evidence: string | null;
  usage?: EventUsage[];
};

const STEPS = [
  "intake",
  "fence",
  "build",
  "checks",
  "guards",
  "evidence",
  "review",
  "verdict",
  "gate",
  "merge",
  "deploy",
] as const;

const STATUSES = ["started", "pass", "fail", "revise", "waiting", "skipped"] as const;

const EVENT_KEYS = ["v", "project", "run", "seq", "phase", "task", "step", "status", "at", "evidence"] as const;

const USAGE_KEYS = [
  "agent",
  "tool",
  "model",
  "account_alias",
  "input",
  "output",
  "cache_read",
  "cache_write",
  "source",
] as const;

const PROJECT = /^[A-Z][A-Z0-9_-]{1,31}$/;
const RUN = /^(gha-[0-9]{1,20}-[0-9]{1,3}|local-[0-9A-HJKMNP-TV-Z]{26}|import-[0-9a-f]{7,40})$/;
const PHASE = /^[A-Z][A-Z0-9-]{0,15}$/;
const TASK = /^[A-Z]{1,3}[0-9]{2,3}$/;
const AT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$/;
const EVIDENCE = /^([A-Za-z0-9][A-Za-z0-9._/-]{0,159})?@[0-9a-f]{7,40}$/;
const TOOL = /^[a-z][a-z0-9-]{1,31}$/;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const ALIAS = /^[a-z][a-z0-9-]{0,31}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "string") return undefined;
  for (const candidate of allowed) {
    if (candidate === value) return candidate;
  }
  return undefined;
}

function patterned(value: unknown, pattern: RegExp): string | undefined {
  if (typeof value !== "string" || !pattern.test(value)) return undefined;
  return value;
}

function stringOrNull(value: unknown, pattern: RegExp, maxLength?: number): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  if (maxLength !== undefined && value.length > maxLength) return undefined;
  if (!pattern.test(value)) return undefined;
  return value;
}

function integer(value: unknown, minimum: number, maximum?: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) return undefined;
  if (maximum !== undefined && value > maximum) return undefined;
  return value;
}

function tokenCount(value: unknown): number | null | undefined {
  if (value === null) return null;
  return integer(value, 0);
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function parseUsage(value: unknown): EventUsage[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return undefined;
  const entries: EventUsage[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !onlyKeys(entry, USAGE_KEYS)) return undefined;
    for (const key of USAGE_KEYS) {
      if (!Object.hasOwn(entry, key)) return undefined;
    }
    const agent = oneOf(entry.agent, ["builder", "reviewer"] as const);
    const tool = patterned(entry.tool, TOOL);
    const model = patterned(entry.model, MODEL);
    const accountAlias = patterned(entry.account_alias, ALIAS);
    const input = tokenCount(entry.input);
    const output = tokenCount(entry.output);
    const cacheRead = tokenCount(entry.cache_read);
    const cacheWrite = tokenCount(entry.cache_write);
    const source = oneOf(entry.source, ["measured", "unavailable"] as const);
    if (
      agent === undefined ||
      tool === undefined ||
      model === undefined ||
      accountAlias === undefined ||
      input === undefined ||
      output === undefined ||
      cacheRead === undefined ||
      cacheWrite === undefined ||
      source === undefined
    ) {
      return undefined;
    }
    if (source === "unavailable" && (input !== null || output !== null || cacheRead !== null || cacheWrite !== null)) {
      return undefined;
    }
    entries.push({
      agent,
      tool,
      model,
      account_alias: accountAlias,
      input,
      output,
      cache_read: cacheRead,
      cache_write: cacheWrite,
      source,
    });
  }
  return entries;
}

export function parseStepEvent(value: unknown): StepEvent | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  for (const key of keys) {
    if (key !== "usage" && !EVENT_KEYS.includes(key as (typeof EVENT_KEYS)[number])) return null;
  }
  for (const key of EVENT_KEYS) {
    if (!Object.hasOwn(value, key)) return null;
  }

  if (value.v !== 1) return null;
  const project = patterned(value.project, PROJECT);
  const run = patterned(value.run, RUN);
  const seq = integer(value.seq, 1, 100000);
  const phase = stringOrNull(value.phase, PHASE);
  const task = stringOrNull(value.task, TASK);
  const step = oneOf(value.step, STEPS);
  const status = oneOf(value.status, STATUSES);
  const at = patterned(value.at, AT);
  const evidence = stringOrNull(value.evidence, EVIDENCE, 200);
  if (
    project === undefined ||
    run === undefined ||
    seq === undefined ||
    phase === undefined ||
    task === undefined ||
    step === undefined ||
    status === undefined ||
    at === undefined ||
    evidence === undefined
  ) {
    return null;
  }

  let usage: EventUsage[] | undefined;
  if (Object.hasOwn(value, "usage")) {
    if (step !== "build" && step !== "review") return null;
    if (status !== "pass" && status !== "fail" && status !== "waiting") return null;
    usage = parseUsage(value.usage);
    if (!usage) return null;
  }

  const event: StepEvent = { v: 1, project, run, seq, phase, task, step, status, at, evidence };
  if (usage) event.usage = usage;
  return event;
}
