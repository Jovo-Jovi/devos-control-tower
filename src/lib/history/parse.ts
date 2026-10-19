import { parseStepEvent, type StepEvent } from "@/lib/contract/step-event";

export type HistoryRefusal = "empty" | "too_many" | "json" | "contract" | "project" | "run" | "seq";

const IMPORT_RUN = /^import-[0-9a-f]{7,40}$/;
const MAX_LINES = 5000;

function contentLines(text: string): string[] {
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts.map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
}

export function parseHistory(
  text: string,
  key: string,
): { ok: true; run: string; events: StepEvent[] } | { ok: false; line: number; reason: HistoryRefusal } {
  const lines = contentLines(text);
  if (lines.length === 0) return { ok: false, line: 1, reason: "empty" };
  if (lines.length > MAX_LINES) return { ok: false, line: MAX_LINES + 1, reason: "too_many" };

  const events: StepEvent[] = [];
  const seen = new Set<number>();
  let run = "";

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index] ?? "";
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return { ok: false, line: lineNumber, reason: "json" };
    }

    const event = parseStepEvent(value);
    if (event === null) return { ok: false, line: lineNumber, reason: "contract" };
    if (event.project !== key) return { ok: false, line: lineNumber, reason: "project" };
    if (!IMPORT_RUN.test(event.run) || (events.length > 0 && event.run !== run)) {
      return { ok: false, line: lineNumber, reason: "run" };
    }
    if (seen.has(event.seq)) return { ok: false, line: lineNumber, reason: "seq" };

    seen.add(event.seq);
    run = event.run;
    events.push(event);
  }

  return { ok: true, run, events };
}
