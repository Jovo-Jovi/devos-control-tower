// Ledger → contract events. No I/O and no dependency: the CLI collects, this module maps.
// Event keys stay in contract order so JSON.stringify emits them in that order, with no usage.

const PROJECT = /^[A-Z][A-Z0-9_-]{1,31}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const REVIEW_PATH = /^docs\/reviews\/([A-Z]{1,3}[0-9]{2,3})-a([1-9][0-9]*)\.md$/;
const PHASE = /^[A-Z][A-Z0-9-]{0,15}$/;
const TASK = /^[A-Z]{1,3}[0-9]{2,3}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * @typedef {{ task: string, phase: string, done: boolean }} PhaseRow
 * @typedef {{ path: string, firstLine: string, commit: string, at: string }} ReviewRef
 * @typedef {{
 *   v: 1,
 *   project: string,
 *   run: string,
 *   seq: number,
 *   phase: string,
 *   task: string,
 *   step: "review" | "verdict",
 *   status: "pass" | "fail",
 *   at: string,
 *   evidence: string,
 * }} HistoryEvent
 * @typedef {{ run: string, tasks: number, attempts: number, events: number }} HistorySummary
 * @typedef {{ project: string, head: string, phases: string, reviews: ReviewRef[] }} HistoryInput
 */

/**
 * @param {string} line
 * @returns {string[] | null}
 */
function cellsOf(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  let body = trimmed;
  if (body.startsWith("|")) body = body.slice(1);
  if (body.endsWith("|")) body = body.slice(0, -1);
  return body.split("|").map((cell) => cell.trim());
}

/**
 * First Markdown table whose header cells include Task, Phase and Done.
 * Rows whose Task cell is not a ledger task id are skipped.
 * @param {string} text
 * @returns {PhaseRow[]}
 */
export function parsePhases(text) {
  const lines = text.split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    if (cellsOf(lines[index]) === null) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < lines.length && cellsOf(lines[index]) !== null) index += 1;
    const header = cellsOf(lines[start]);
    if (!header) continue;
    const taskAt = header.indexOf("Task");
    const phaseAt = header.indexOf("Phase");
    const doneAt = header.indexOf("Done");
    if (taskAt < 0 || phaseAt < 0 || doneAt < 0) continue;

    /** @type {PhaseRow[]} */
    const rows = [];
    for (let row = start + 1; row < index; row += 1) {
      const cells = cellsOf(lines[row]);
      if (!cells) continue;
      if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
      const task = cells[taskAt] ?? "";
      if (!TASK.test(task)) continue;
      rows.push({
        task,
        phase: cells[phaseAt] ?? "",
        done: (cells[doneAt] ?? "") === "[x]",
      });
    }
    return rows;
  }
  return [];
}

/**
 * @param {string} path
 * @param {string} reason
 * @returns {Error}
 */
function refusal(path, reason) {
  return new Error(`history: ${path}: ${reason}`);
}

/**
 * @param {string} at
 * @param {string} path
 * @returns {string}
 */
function toUtc(at, path) {
  if (typeof at !== "string" || !ISO_TIME.test(at)) throw refusal(path, "time is not ISO 8601");
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) throw refusal(path, "time is not ISO 8601");
  return parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * @param {string} project
 * @param {string} run
 * @param {number} seq
 * @param {string} phase
 * @param {string} task
 * @param {"review" | "verdict"} step
 * @param {"pass" | "fail"} status
 * @param {string} at
 * @param {string} evidence
 * @returns {HistoryEvent}
 */
function event(project, run, seq, phase, task, step, status, at, evidence) {
  return { v: 1, project, run, seq, phase, task, step, status, at, evidence };
}

/**
 * @param {HistoryInput} input
 * @returns {HistoryEvent[]}
 */
export function historyEvents({ project, head, phases, reviews }) {
  if (typeof project !== "string" || !PROJECT.test(project)) {
    throw new Error("history: project does not match the contract");
  }
  if (typeof head !== "string" || !HEX40.test(head)) {
    throw new Error("history: head is not a 40-hex commit");
  }
  if (!Array.isArray(reviews)) throw new Error("history: reviews are missing");

  /** @type {Map<string, PhaseRow>} */
  const byTask = new Map();
  for (const row of parsePhases(phases)) {
    if (!byTask.has(row.task)) byTask.set(row.task, row);
  }

  const run = `import-${head.slice(0, 7)}`;
  /** @type {HistoryEvent[]} */
  const events = [];
  let seq = 1;

  for (const review of reviews) {
    const path = review && typeof review.path === "string" ? review.path : "(missing path)";
    const matched = typeof review?.path === "string" ? REVIEW_PATH.exec(review.path) : null;
    if (!matched) throw refusal(path, "not a review path");

    const task = matched[1];
    const row = byTask.get(task);
    if (!row) throw refusal(path, "task is not in the phases ledger");
    if (!PHASE.test(row.phase)) throw refusal(path, "phase is not a contract phase");

    const verdict = typeof review.firstLine === "string" ? review.firstLine.trim() : "";
    if (verdict !== "VERDICT: PASS" && verdict !== "VERDICT: FAIL") {
      throw refusal(path, "first line is not a verdict");
    }
    if (typeof review.commit !== "string" || !HEX40.test(review.commit)) {
      throw refusal(path, "adding commit is not 40 hex");
    }

    const at = toUtc(review.at, path);
    const evidence = `${path}@${review.commit.slice(0, 7)}`;
    const status = verdict === "VERDICT: PASS" ? "pass" : "fail";
    events.push(event(project, run, seq, row.phase, task, "review", "pass", at, evidence));
    seq += 1;
    events.push(event(project, run, seq, row.phase, task, "verdict", status, at, evidence));
    seq += 1;
  }

  return events;
}

/**
 * @param {HistoryEvent[]} events
 * @returns {HistorySummary}
 */
export function summary(events) {
  const tasks = new Set();
  for (const item of events) tasks.add(item.task);
  return {
    run: events.length > 0 ? events[0].run : "",
    tasks: tasks.size,
    attempts: events.length / 2,
    events: events.length,
  };
}

/**
 * One JSON object per line, each ending in a newline.
 * @param {HistoryEvent[]} events
 * @returns {string}
 */
export function toJsonLines(events) {
  let body = "";
  for (const item of events) body += `${JSON.stringify(item)}\n`;
  return body;
}
