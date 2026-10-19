import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseStepEvent } from "../contract/step-event";
import { historyEvents, parsePhases, toJsonLines } from "../../../scripts/tower/history.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const LINE_1 =
  '{"v":1,"project":"IMPORTFX","run":"import-0a1b2c3","seq":1,"phase":"P01","task":"T01","step":"review","status":"pass","at":"2026-10-01T07:00:00Z","evidence":"docs/reviews/T01-a1.md@1111111"}';

type ReviewRef = {
  path: string;
  firstLine: string;
  commit: string;
  at: string;
};

type Snapshot = {
  project: string;
  head: string;
  phases: string;
  reviews: ReviewRef[];
};

const snapshot = JSON.parse(readFileSync(path.join(root, "tests/fixtures/history-snapshot.json"), "utf8")) as Snapshot;
const synthetic = readFileSync(path.join(root, "tests/fixtures/history-synthetic.jsonl"), "utf8");

function withReview(review: ReviewRef): Snapshot {
  return { ...snapshot, reviews: [review] };
}

function runExport(args: string[]) {
  return spawnSync(process.execPath, [path.join(root, "scripts/tower/export-history.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("T10 history export", () => {
  it("maps the snapshot to the committed JSONL byte for byte", () => {
    expect(synthetic.split("\n")[0]).toBe(LINE_1);
    expect(synthetic.endsWith("\n")).toBe(true);
    expect(synthetic.split("\n").filter((line) => line.length > 0)).toHaveLength(8);
    expect(toJsonLines(historyEvents(snapshot))).toBe(synthetic);
  });

  it("parses every event, with seq 1–8 and one run", () => {
    const events = historyEvents(snapshot);
    expect(events.map((item) => item.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(events.map((item) => item.run)).size).toBe(1);
    expect(events[0]?.run).toBe("import-0a1b2c3");
    for (const item of events) {
      expect(Object.keys(item)).toEqual(["v", "project", "run", "seq", "phase", "task", "step", "status", "at", "evidence"]);
      expect(parseStepEvent(item)).toEqual(item);
    }
  });

  it("emits review before verdict, and the verdict status follows the first line", () => {
    const events = historyEvents(snapshot);
    snapshot.reviews.forEach((review, index) => {
      const opened = events[index * 2];
      const closed = events[index * 2 + 1];
      expect(opened?.step).toBe("review");
      expect(opened?.status).toBe("pass");
      expect(closed?.step).toBe("verdict");
      expect(closed?.status).toBe(review.firstLine.trim() === "VERDICT: PASS" ? "pass" : "fail");
      expect(closed?.seq).toBe((opened?.seq ?? 0) + 1);
      expect(closed?.evidence).toBe(opened?.evidence);
    });
  });

  it("converts the +02:00 time to UTC", () => {
    const events = historyEvents(snapshot);
    expect(events[0]?.at).toBe("2026-10-01T07:00:00Z");
    expect(events[1]?.at).toBe("2026-10-01T07:00:00Z");
    expect(events[2]?.at).toBe("2026-10-02T10:30:00Z");
  });

  it("throws for an unknown task and names the path", () => {
    const reviewPath = "docs/reviews/T99-a1.md";
    let message = "";
    try {
      historyEvents(withReview({
        path: reviewPath,
        firstLine: "VERDICT: PASS",
        commit: "1".repeat(40),
        at: "2026-10-02T10:30:00Z",
      }));
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain(reviewPath);
  });

  it("throws for a bad first line and names the path, without the line", () => {
    const reviewPath = "docs/reviews/T01-a1.md";
    const badLine = "VERDICT: MAYBE";
    let message = "";
    try {
      historyEvents(withReview({
        path: reviewPath,
        firstLine: badLine,
        commit: "1".repeat(40),
        at: "2026-10-02T10:30:00Z",
      }));
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain(reviewPath);
    expect(message).not.toContain("MAYBE");
  });

  it("throws for a bad path and names the path", () => {
    const reviewPath = "docs/reviews/T01-a0.md";
    let message = "";
    try {
      historyEvents(withReview({
        path: reviewPath,
        firstLine: "VERDICT: PASS",
        commit: "1".repeat(40),
        at: "2026-10-02T10:30:00Z",
      }));
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain(reviewPath);
  });

  it("parsePhases skips non-task rows and an earlier table without those headers", () => {
    const text = [
      "| Name | Value |",
      "| --- | --- |",
      "| alpha | beta |",
      "",
      "| Task | Station | Phase | Done | Note |",
      "| --- | --- | --- | --- | --- |",
      "| legend | J9 | P00 | [x] | skip |",
      "| T01 | J4 | P01 | [x] | keep |",
      "| T1 | J4 | P09 | [ ] | short id |",
      "| T02 | J5 | PM | [ ] | open |",
    ].join("\n");
    expect(parsePhases(text)).toEqual([
      { task: "T01", phase: "P01", done: true },
      { task: "T02", phase: "PM", done: false },
    ]);
  });

  it("the CLI with --project bad exits 2", () => {
    const result = runExport(["--repo", ".", "--project", "bad"]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
  });

  it("writes nothing to --out when the export fails", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "t10-not-a-repo-"));
    const out = path.join(tmpdir(), `t10-no-write-${process.pid}.jsonl`);
    try {
      const result = runExport(["--repo", dir, "--project", "TOWER", "--out", out]);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(existsSync(out)).toBe(false);
      expect(existsSync(`${out}.${result.pid}.partial`)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(out, { force: true });
    }
  });

  it("exports this repository as contract events for every review", () => {
    const result = runExport(["--repo", ".", "--project", "TOWER"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(
      /^export-history: run=import-[0-9a-f]{7} tasks=[0-9]+ attempts=[0-9]+ events=[0-9]+\n?$/,
    );

    const listed = execFileSync("git", ["ls-tree", "--name-only", "HEAD", "docs/reviews/"], {
      cwd: root,
      encoding: "utf8",
    });
    const reviewPaths = listed
      .split("\n")
      .filter((item) => /^docs\/reviews\/[A-Z]{1,3}[0-9]{2,3}-a[1-9][0-9]*\.md$/.test(item));
    const lines = result.stdout.endsWith("\n") ? result.stdout.slice(0, -1).split("\n") : result.stdout.split("\n");
    expect(lines).toHaveLength(reviewPaths.length * 2);

    const phases = parsePhases(execFileSync("git", ["show", "HEAD:docs/PHASES.md"], { cwd: root, encoding: "utf8" }));
    const phaseOf = new Map<string, string>();
    for (const row of phases) if (!phaseOf.has(row.task)) phaseOf.set(row.task, row.phase);

    const tasks = new Set<string>();
    lines.forEach((line, index) => {
      const event = parseStepEvent(JSON.parse(line));
      expect(event).not.toBeNull();
      expect(event?.project).toBe("TOWER");
      expect(event?.phase).toBe(phaseOf.get(event?.task ?? ""));
      expect(event?.step).toBe(index % 2 === 0 ? "review" : "verdict");
      if (event?.task) tasks.add(event.task);
    });

    const summaryLine = /^export-history: run=(import-[0-9a-f]{7}) tasks=(\d+) attempts=(\d+) events=(\d+)\n?$/.exec(
      result.stderr ?? "",
    );
    expect(summaryLine?.[1]).toBe(JSON.parse(lines[0] ?? "{}").run);
    expect(summaryLine?.[2]).toBe(String(tasks.size));
    expect(summaryLine?.[3]).toBe(String(reviewPaths.length));
    expect(summaryLine?.[4]).toBe(String(lines.length));
  });
});
