#!/usr/bin/env node
// Decide whether the builder run is worth reviewing (PR-12). Runs after the builder's work is
// committed, so partial work is never lost.
//   ok     → continue to checks and review
//   quota  → Cursor is out of plan usage / rate limited: park the task (devos:quota-wait), same
//            attempt, no review spent; devos-resume retries it hourly
//   error  → the builder crashed or produced no output: halt without spending a review
// Usage: node scripts/devos/builder-status.mjs --task T01 --attempt 1 --exit <code> [--review-only true]
import { writeFileSync, mkdirSync } from "node:fs";
import { P, emit, config } from "./lib.mjs";
import { looksLikeLimit, readText, resumeMarker, parseJsonLoose, earliestNotBefore } from "./limits.mjs";

const arg = (n, d = "") => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const task = arg("task");
const attempt = Number(arg("attempt", "1"));
const exitRaw = arg("exit", "");
mkdirSync(P(".devos"), { recursive: true });

if (arg("review-only") === "true") {
  emit({ state: "ok", reason: "review-only re-run: builder skipped" });
  process.exit(0);
}

const out = readText(".devos/builder.json");
const err = readText(".devos/builder.err");
const json = parseJsonLoose(out);
const exit = exitRaw === "" ? NaN : Number(exitRaw);
const failed = exit !== 0 || !out.trim() || json?.is_error === true || json?.subtype === "error";
const detail = String(json?.result ?? json?.error ?? "").slice(0, 400) || err.trim().split(/\r?\n/).slice(-5).join(" ").slice(0, 400);

let state = "ok";
// PR-29: with a second Cursor account, both were tried; resume when the first one resets.
const waitUntil = earliestNotBefore("cursor", `${out}\n${err}`, config().resume?.default_wait_minutes ?? 60);
let reason = "builder finished";
if (failed) {
  state = looksLikeLimit(out, err) ? "quota" : "error";
  reason = `builder exit ${Number.isNaN(exit) ? "unknown" : exit}${detail ? `: ${detail}` : ""}`;
}

if (state !== "ok") {
  const head = state === "quota"
    ? `### Dev OS ${task} · attempt ${attempt} · **waiting for Cursor usage** → \`quota_wait\``
    : `### Dev OS ${task} · attempt ${attempt} · **builder error** → \`halt\``;
  const body = state === "quota"
    ? `Cursor stopped on a plan/usage or rate limit. Whatever it finished is committed on this branch. No review was spent and the attempt was not used up. The runner resumes it after **${waitUntil}** (UTC); remove the \`devos:quota-wait\` label to cancel that.`
    : `The Cursor CLI failed before finishing, for a reason that does not look like a usage limit. Whatever it finished is committed on this branch. No review was spent. Fix the cause (key, model id, install), then re-run devos-cycle with task=${task} attempt=${attempt}.`;
  writeFileSync(P(".devos/builder-summary.md"), [head, "", body, "", "```", reason, "```", "",
    state === "quota" ? resumeMarker(task, attempt, false, waitUntil) : ""].join("\n"));
}
emit({ state, reason, not_before: state === "quota" ? waitUntil : "" });
