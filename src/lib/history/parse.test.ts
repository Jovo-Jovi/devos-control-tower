import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseStepEvent } from "../contract/step-event";
import { parseHistory } from "./parse";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const synthetic = readFileSync(path.join(root, "tests/fixtures/history-synthetic.jsonl"), "utf8");
const invalid = readFileSync(path.join(root, "tests/fixtures/history-invalid.jsonl"), "utf8");

function eventLine(seq: number, patch?: Record<string, unknown>): string {
  return JSON.stringify({
    v: 1,
    project: "IMPORTFX",
    run: "import-0a1b2c3",
    seq,
    phase: "P01",
    task: "T01",
    step: "review",
    status: "pass",
    at: "2026-10-01T07:00:00Z",
    evidence: "docs/reviews/T01-a1.md@1111111",
    ...patch,
  });
}

function many(count: number): string {
  return `${Array.from({ length: count }, (_, index) => eventLine(index + 1)).join("\n")}\n`;
}

describe("T10 parseHistory", () => {
  it("refuses an empty file at line 1", () => {
    expect(parseHistory("", "IMPORTFX")).toEqual({ ok: false, line: 1, reason: "empty" });
  });

  it("refuses line 5001 as too_many and accepts 5000", () => {
    expect(parseHistory(many(5001), "IMPORTFX")).toEqual({ ok: false, line: 5001, reason: "too_many" });
    expect(parseHistory(many(6000), "IMPORTFX")).toEqual({ ok: false, line: 5001, reason: "too_many" });
    const accepted = parseHistory(many(5000), "IMPORTFX");
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.run).toBe("import-0a1b2c3");
    expect(accepted.events).toHaveLength(5000);
    expect(accepted.events[0]?.seq).toBe(1);
    expect(accepted.events[4999]?.seq).toBe(5000);
  });

  it("refuses a line that is not JSON", () => {
    expect(parseHistory("{", "IMPORTFX")).toEqual({ ok: false, line: 1, reason: "json" });
    expect(parseHistory(`${eventLine(1)}\n\n`, "IMPORTFX")).toEqual({ ok: false, line: 2, reason: "json" });
  });

  it("refuses an event of another project", () => {
    expect(parseHistory(eventLine(1), "TRACE")).toEqual({ ok: false, line: 1, reason: "project" });
  });

  it("refuses a run that is not an import run", () => {
    expect(parseHistory(eventLine(1, { run: "gha-100-1" }), "IMPORTFX")).toEqual({
      ok: false,
      line: 1,
      reason: "run",
    });
    expect(parseHistory(eventLine(1, { run: "import-ZZZZZZZ" }), "IMPORTFX")).toEqual({
      ok: false,
      line: 1,
      reason: "contract",
    });
  });

  it("refuses a run that differs from line 1", () => {
    const text = `${eventLine(1)}\n${eventLine(2, { run: "import-abcdef0" })}`;
    expect(parseHistory(text, "IMPORTFX")).toEqual({ ok: false, line: 2, reason: "run" });
  });

  it("refuses a repeated seq and allows a gap", () => {
    expect(parseHistory(`${eventLine(1)}\n${eventLine(1)}`, "IMPORTFX")).toEqual({
      ok: false,
      line: 2,
      reason: "seq",
    });
    const gapped = parseHistory(`${eventLine(1)}\n${eventLine(3)}`, "IMPORTFX");
    expect(gapped.ok).toBe(true);
    if (!gapped.ok) return;
    expect(gapped.events.map((event) => event.seq)).toEqual([1, 3]);
  });

  it("accepts CRLF line endings", () => {
    expect(synthetic.endsWith("\n")).toBe(true);
    expect(parseHistory(synthetic.replace(/\n/g, "\r\n"), "IMPORTFX")).toEqual(parseHistory(synthetic, "IMPORTFX"));
  });

  it("reads the synthetic fixture as 8 events of one import run", () => {
    const events = synthetic
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => {
        const event = parseStepEvent(JSON.parse(line));
        if (!event) throw new Error("fixture line");
        return event;
      });
    expect(parseHistory(synthetic, "IMPORTFX")).toEqual({
      ok: true,
      run: "import-0a1b2c3",
      events,
    });
  });

  it("refuses the invalid fixture at line 3 as contract", () => {
    expect(parseHistory(invalid, "IMPORTFX")).toEqual({ ok: false, line: 3, reason: "contract" });
  });
});
