# Method fix — issue #50: a task starts with no fence, and the supervisor re-runs it as a runner failure

Intake run in method mode, 2026-10-26. Decision: **accept** → method task **T19** (`docs/fences/T19.md`), Phase
PM, risk 3, gate `G-Method-50`. Four defects are reported: two in the issue body and two in the owner's
note in the thread. All four are in the runner's own code. One task fixes them, in two stages (PR-38).

## Symptom

1. T15 a1 passed with `Next prompt: none (the T16 fence was not written in this run; see human_attention)`
   (`docs/reviews/T15-a1.md:38`). The owner merged PR #48 (risk 3, human gate), which started T16 at once.
   The cycle then failed: `docs/fences/T16.md does not exist`. The fence was written later, by hand, outside the
   cycle (`1e61f06`).
2. The supervisor classed that failure as "an environment failure in 'Check out the task branch'" and re-ran it
   twice (`supervisor.max_auto_per_key` = 2).
3. The usage-limit notice on intake issue #50 is posted under the owner's account without the `Dev OS:` prefix.
   The next planning run then reads it as one of the owner's notes: it is the first "answer" in
   `.devos/request.md` of this run.
4. The supervisor closed request #49 as finished. Its plan (PR #52) added no task row; it gave its work to T17
   and T18 (OD-13), which are not built yet.

## Evidence

- Run https://github.com/Jovo-Jovi/devos-control-tower/actions/runs/40326964530 (`devos T16 · attempt 1`, job
  `cycle`, failed step "Check out the task branch (a reissue continues the same branch, PR-03)",
  `.devos/runlogs/40326964530.json`). The log, `.devos/runlogs/40326964530.log:301`:
  `##[error]docs/fences/T16.md does not exist: the reviewer has not issued this fence`. Then `:380`:
  `The cycle stopped on a runner failure (a guard, a missing secret or fence, or a push). Nothing was merged.`
- `git ls-remote --heads origin` shows `task/T16` @ `c49a735`: T16 is under way now with the fence from `1e61f06`.
- `git diff 47d47c5^1 47d47c5 -- docs/PHASES.md` (the merge of PR #52) adds 15 lines, all in one "Phase
  outlines" bullet that begins `- **T17 and T18 gain the link-request safeguards (OD-13, issue #49, …; rows and
  ids unchanged).**`. It adds no table row.
- `.devos/request.md:26-31` (this run): the limit notice ("Claude hit a usage limit while planning this. …
  `<!-- devos-intake-resume issue=50 … -->`") appears under "The human's answers and notes in the issue thread".

## Root cause

1. **No dispatcher checks that the next fence exists.** `scripts/devos/verdict.mjs:164-167` does see that the
   next fence is missing: it turns the PASS into `human_gate` with "Write or request the fence for T16, then
   re-run the cycle". But the owner's merge runs `.github/workflows/devos-advance.yml:61-73`. That step takes the
   next task from `next-task.mjs` and dispatches it with no fence check. `scripts/devos/next-task.mjs:36-66` also
   resolves a task without looking at its fence. The first fence check is the job-level failure at
   `.github/workflows/devos-cycle.yml:215`, inside the `cycle` job, so the run ends red as a "runner failure".
   The supervisor's idle rule (`scripts/devos/supervisor.mjs:223-231`) would also dispatch a task that has no
   fence.
2. **The supervisor reads a missing fence as an environment failure.** In `scripts/devos/supervisor.mjs:168`,
   any step whose name starts with `Check out` is an environment failure, and its action is `rerun-failed`.
   The failing step is "Check out the task branch …", so the missing fence is re-run, which cannot help. No
   rule looks for the line "does not exist: the reviewer has not issued this fence".
3. **The planning comment carries no runner prefix.** `.github/workflows/devos-intake.yml:210-217` builds
   `.devos/intake-comment.md` for every decision (accept, needs-info, reject, limit, guards, error) with no
   `Dev OS:` prefix. `:274` and `:277` post it with `secrets.DEVOS_PAT` (the owner's account, `:193`). The
   notes filter at `:122` drops only bodies that start with `Dev OS:`, so the notice counts as the owner's note.
4. **A request closes when its plan added no row.** `scripts/devos/supervisor.mjs:248-264` (`plannedTasks`)
   collects only rows added to the table. `:239-243` then closes the request when that list is empty. The cause
   text says so outright: "added no task, and it is merged". A plan that amends existing tasks names them in the
   lines it adds (an outline bullet) or in the fences it changes, and both are ignored.

## Fix (T19, `Surface: method`)

Stage 1 — runner scripts and their self-test:

- `scripts/devos/supervisor-rules.mjs` (new, pure, no side effect on import): `ENV_RE`, `FONTS_RE` and
  `FENCE_MISSING_RE` move here, along with the failure chain of `supervisor.mjs:158-174` as `runFailureRule`.
  It checks for a missing fence first; every other rule keeps its order, keys and actions. `idleIncident` is
  rule 4: a next task with no fence gives a `fence-missing` incident (action `fence-wait`) instead of
  `dispatch-next`. `tasksNamedByPlan` returns the task ids in the lines a plan added to `docs/PHASES.md`, plus
  the ids of the fences it changed.
- `scripts/devos/supervisor.mjs`: uses those three helpers. Rule 2 (a halted PR whose stop was a runner failure)
  also recognises a missing fence. `act` reports `fence-wait` once (`done: false`), with steps for the owner, and
  never re-runs or dispatches it. `plannedTasks` returns the named tasks, and a request stays open until every
  one is PASS on main.
- `scripts/devos/next-task.mjs`: emits `fence_missing=true|false`. The fence counts as present when it is in
  the checked-out tree or on `origin/task/<task>`.
- `scripts/devos/lib.mjs`:
  - `isRunnerComment(body)` recognises the runner's own comments: the `Dev OS:`, `Dev OS runner` and `Dev OS
    supervisor` openers, the `### Dev OS Tnn` and supervisor headings, and any `<!-- devos-…` marker. A note that
    only mentions Dev OS stays the owner's.
  - `requestMarkdown(issue)` is the request-notes program of `devos-intake.yml:118-126`, moved so it can be tested,
    with that filter.
- `scripts/devos/verdict.mjs:166`: the human-attention text says that merging will not start the next task
  until its fence is on main.
- `scripts/devos/supervisor-rules.test.mjs` (new, `node:test`): the reproductions below.

Stage 2 — workflows, manual, precedent, ledgers:

- `devos-cycle.yml` `resolve`: output `fence_missing`. When it is true, a warning and a step summary are
  written, and the setup step, the heavy step and the `cycle` job are skipped. The run ends green, starts
  nothing and uses no attempt. `:215` stays as a backstop.
- `devos-advance.yml`: no dispatch when the next fence is not on main. A `Dev OS:` comment on the merged PR says
  that the task waits and what starts it.
- `devos-intake.yml`: every comment body written to `.devos/intake-comment.md` starts with `Dev OS: `. The request
  notes come from `requestMarkdown`.
- `docs/method/AUTOMATION.md` §2, §3, §4, §7 and §9 change, plus one precedent row, the T19 report and the
  ledgers.

Not chosen: making the cycle write a missing fence before the merge (a second reviewer pass on a PASS). That
would be a new Claude run on every such PASS, at gate cost. The verdict already stops at `human_gate` and names
the gap. After this fix the next task waits visibly instead of failing, and the owner has the reviewer write the
fence (as was done for T16 in `1e61f06`).

## What could break

- Rule order in `runFailureRule`: a regression could reclassify known failures. Test 2 pins every existing
  rule's action and key.
- A fence that exists only on the task branch (a reissue) must not count as missing, which is why `next-task.mjs`
  also checks `origin/task/<task>`.
- `devos-cycle.yml` conditions: the setup and heavy steps must still run for a task that has its fence.
- Request closing is now stricter. A plan whose added lines name an old task that is already PASS does not
  block, because only open tasks block.
- Workflow changes need `DEVOS_PAT` with the Workflows permission (PR-28). It is checked by `setup-check.mjs --for
  cycle` for method fixes.
- Issue #49 stays closed: the supervisor never reopens an issue. The owner reopens it by hand if they want it
  tracked until T17 and T18.

## How the fix is proven

`node --test scripts/devos/supervisor-rules.test.mjs`, seven tests. Each reproduction feeds the real failing
input to the changed function:

1. The step name and log line of run 40326964530 give `fence-missing` / `fence-wait`. On main they give an
   environment failure / `rerun-failed`.
2. The other run-failure rules give the same actions and keys as before.
3. `tasksNamedByPlan` of `docs/PHASES.md` at `47d47c5^1` and at `47d47c5` (PR #52) gives `["T17","T18"]`. On
   main, the rule found none and closed #49.
4. `isRunnerComment` is true for the old limit notice and false for the owner's note. `requestMarkdown` keeps only
   the owner's note.
5. `next-task.mjs` emits `fence_missing=true` for a synthetic ledger whose next fence is absent, and exits 0.
6. `idleIncident` gives `fence-wait` without a fence and `dispatch-next` with one.
7. The intake workflow's own programs. The decision program, run on a limit and on an accepted method plan, writes
   a comment that starts with `Dev OS: `. The notes program writes only the owner's note.

Also: `node --check` on each changed script, `node scripts/guards/run-all.mjs`, and the three changed workflows
parsed as YAML.
