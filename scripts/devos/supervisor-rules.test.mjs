// Self-test for the supervisor's pure rules and the request-notes filter. No network, no gh, no .devos file.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isRunnerComment, requestMarkdown } from "./lib.mjs";
import { runFailureRule, tasksNamedByPlan, idleIncident } from "./supervisor-rules.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const LIMIT_NOTICE = "Claude hit a usage limit while planning this. The partial plan is kept on the intake branch.\n\nResumes after 2026-10-26T16:03:00Z (UTC). Checked 1 time(s) so far; last check 2026-10-26T13:47Z (UTC).\n<!-- devos-intake-resume issue=50 not_before=2026-10-26T16:03:00Z checks=1 -->";

const CHECKOUT = "Check out the task branch (a reissue continues the same branch, PR-03)";

test("Reproduction of run 40326964530", () => {
  const missing = runFailureRule({
    step: CHECKOUT,
    task: "T16",
    attempt: 1,
    run: 40326964530,
    tail: "Switched to a new branch 'task/T16'\n##[error]docs/fences/T16.md does not exist: the reviewer has not issued this fence\n##[error]Process completed with exit code 1.",
  });
  assert.equal(missing.rule, "fence-missing");
  assert.equal(missing.action, "fence-wait");
  assert.equal(missing.key, "T16:fence-missing");
  assert.equal(missing.fence, "T16");
  assert.equal(missing.rescue, null);

  const env = runFailureRule({
    step: CHECKOUT,
    task: "T16",
    attempt: 1,
    run: 40326964530,
    tail: "fatal: unable to access 'https://github.com/x/y/': Could not resolve host: github.com",
  });
  assert.equal(env.rule, "env");
  assert.equal(env.action, "rerun-failed");
  assert.equal(env.fence, null);
  assert.equal(env.rescue, null);
});

test("Existing rules unchanged", () => {
  const cases = [
    {
      step: "Resolve",
      tail: "DEVOS: attempt 4 exceeds max_attempts 3",
      rule: "attempt-limit",
      action: "redispatch",
      key: "T05:a2:attempt-limit:99",
      rescue: null,
      cause: "the resumed run lost its revision flag and was refused as an attempt over max_attempts",
    },
    {
      step: "Push",
      tail: "the push conflicts with this task's work; saved on branch rescue/task/T05-99 (see the run)",
      rule: "push-conflict",
      action: "recover-rescue",
      key: "T05:a2:push-conflict",
      rescue: "rescue/task/T05-99",
      cause: "main changed during the run and the push conflicted",
    },
    {
      step: "Build",
      tail: "The job has timed out",
      rule: "step-timeout",
      action: "redispatch",
      key: "T05:a2:step-timeout",
      rescue: null,
      cause: 'step "Build" timed out',
    },
    {
      step: "Install pnpm, Claude Code and the Cursor CLI",
      tail: "npm error code E404",
      rule: "env",
      action: "rerun-failed",
      key: "T05:a2:env:Install pnpm, Claude Code and the Cursor CLI",
      rescue: null,
      cause: 'an environment failure in "Install pnpm, Claude Code and the Cursor CLI"',
    },
    {
      step: "Builder",
      tail: "Setup needed: no Cursor key",
      rule: "setup",
      action: "setup",
      key: "T05:setup",
      rescue: null,
      cause: "a missing secret, variable or permission",
    },
    {
      step: "Review",
      tail: "unexpected token",
      rule: "unknown",
      action: "ask-claude",
      key: "T05:a2:unknown:Review",
      rescue: null,
      cause: "",
    },
  ];
  for (const c of cases) {
    const got = runFailureRule({ step: c.step, tail: c.tail, task: "T05", attempt: 2, run: 99 });
    assert.equal(got.rule, c.rule, c.step);
    assert.equal(got.action, c.action, c.step);
    assert.equal(got.key, c.key, c.step);
    assert.equal(got.rescue, c.rescue, c.step);
    assert.equal(got.cause, c.cause, c.step);
    assert.equal(got.fence, null, c.step);
  }
});

test("Reproduction of #49's closing", () => {
  const beforeText = execFileSync("git", ["show", "47d47c5^1:docs/PHASES.md"], { cwd: ROOT, encoding: "utf8" });
  const afterText = execFileSync("git", ["show", "47d47c5:docs/PHASES.md"], { cwd: ROOT, encoding: "utf8" });
  assert.deepEqual(tasksNamedByPlan(beforeText, afterText, []), ["T17", "T18"]);

  const before = "| T01 | P01 | J4 | A | 2 | — | [x] | — |\n| T02 | P01 | J4 | B | 2 | — | [ ] | — |";
  const after = `${before}\n| T20 | P04 | J5 | X | 2 | — | [ ] | — |`;
  assert.deepEqual(tasksNamedByPlan(before, after, []), ["T20"]);
  assert.deepEqual(tasksNamedByPlan(before, before, ["docs/fences/T16.md", "docs/requests/issue-9.md"]), ["T16"]);
  assert.deepEqual(tasksNamedByPlan(before, before, []), []);
});

test("Runner comments are not the owner's notes", () => {
  assert.equal(isRunnerComment(LIMIT_NOTICE), true);
  assert.equal(isRunnerComment("Dev OS: starting T05 attempt 1 now."), true);
  assert.equal(isRunnerComment("### Dev OS T15 · attempt 1 · **PASS** → `human_gate`"), true);
  assert.equal(isRunnerComment("### 🟢 Dev OS supervisor · T16 · fence-missing"), true);
  assert.equal(isRunnerComment("Dev OS runner stopped on a failure in run https://github.com/o/r/actions/runs/1."), true);
  assert.equal(isRunnerComment("Also in this fix:\n  1. The usage-limit notice on an intake issue is posted under the owner's account without the `Dev OS:` prefix."), false);
  assert.equal(isRunnerComment("Dev OS keeps re-running T16; please fix."), false);
  assert.equal(isRunnerComment("/devos intake resume"), false);

  const md = requestMarkdown({
    title: "Method fix: X",
    body: "B",
    labels: [],
    comments: [
      { authorAssociation: "OWNER", body: LIMIT_NOTICE },
      { authorAssociation: "OWNER", body: "/devos intake resume\nAlso in this fix: keep #49 open." },
      { authorAssociation: "OWNER", body: "Dev OS: starting T05 attempt 1 now." },
      { authorAssociation: "NONE", body: "drive-by note" },
    ],
  });
  assert.equal(md, "# Method fix: X\n\nB\n\n## The human's answers and notes in the issue thread\n\n- Also in this fix: keep #49 open.\n");
});

const resolveDirs = [];
after(() => {
  for (const dir of resolveDirs) rmSync(dir, { recursive: true, force: true });
});

test("The resolve step waits for a fence", () => {
  const dir = mkdtempSync(join(tmpdir(), "devos-fence-"));
  resolveDirs.push(dir);
  mkdirSync(join(dir, "scripts/devos"), { recursive: true });
  mkdirSync(join(dir, "docs/fences"), { recursive: true });
  copyFileSync(join(ROOT, "scripts/devos/lib.mjs"), join(dir, "scripts/devos/lib.mjs"));
  copyFileSync(join(ROOT, "scripts/devos/next-task.mjs"), join(dir, "scripts/devos/next-task.mjs"));
  copyFileSync(join(ROOT, "devos.config.json"), join(dir, "devos.config.json"));
  const phases = readFileSync(join(ROOT, "docs/PHASES.md"), "utf8").split(/\r?\n/);
  writeFileSync(join(dir, "docs/PHASES.md"), [
    phases[14],
    phases[15],
    "| T01 | P01 | J4 | A | 2 | — | [x] | PASS a1 — docs/reviews/T01-a1.md |",
    "| T02 | P01 | J4 | B | 2 | — | [ ] | — |",
    "",
  ].join("\n"));
  writeFileSync(join(dir, "docs/fences/T01.md"), "fence\n");

  const env = { ...process.env };
  delete env.GITHUB_OUTPUT;
  const run = (label) => {
    const child = spawnSync("node", ["scripts/devos/next-task.mjs"], { cwd: dir, encoding: "utf8", env });
    assert.equal(child.status, 0, `${label}\n${child.stderr}`);
    return child.stdout.split(/\r?\n/);
  };
  const missing = run("fence absent");
  assert.ok(missing.includes("task=T02"), missing.join("\n"));
  assert.ok(missing.includes("fence_missing=true"), missing.join("\n"));

  writeFileSync(join(dir, "docs/fences/T02.md"), "fence\n");
  const present = run("fence present");
  assert.ok(present.includes("fence_missing=false"), present.join("\n"));
});

test("The supervisor's idle rule", () => {
  const base = {
    next: { task: "T16" },
    busy: false,
    waitingForOwner: false,
    otherIncidents: 0,
    intakePrs: 0,
    minutesSinceLastRun: 60,
    idleMinutes: 20,
    taskPrHeads: [],
  };
  const waiting = idleIncident({ ...base, fence: false });
  assert.equal(waiting.kind, "fence-missing");
  assert.equal(waiting.key, "T16:fence-missing");
  assert.equal(waiting.action, "fence-wait");
  assert.ok(waiting.owner_steps.includes("docs/fences/T16.md"));

  const idle = idleIncident({ ...base, fence: true });
  assert.equal(idle.kind, "idle");
  assert.equal(idle.key, "T16:idle");
  assert.equal(idle.action, "dispatch-next");

  assert.equal(idleIncident({ ...base, fence: true, busy: true }), null);
  assert.equal(idleIncident({ ...base, fence: true, taskPrHeads: ["task/T16"] }), null);
});
