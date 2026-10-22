# How to use Dev OS and its workflows

This is the plain-language guide for the owner. It says what to do, where to click and what each
part of the automation is for. Topics are numbered and sorted, and the A–Z index below sends you
straight to one. Search this page (Ctrl+F or ⌘F) for a word in **bold**.

The full technical description is the operating manual, [`docs/method/AUTOMATION.md`](method/AUTOMATION.md).
Where this guide and the manual disagree, the manual is correct and this guide must be fixed.

---

## A–Z index

| Topic | Section |
|---|---|
| Account switching (Cursor, Claude) | [10](#10-usage-limits-and-accounts) |
| Approve or reject the supervisor | [7](#7-the-supervisor-the-self-healing-part) |
| Art and design changes | [12](#12-design-and-art-changes) |
| Branches (`task/`, `intake/`, `rescue/`) | [16](#16-labels-statuses-and-branches) |
| Commands (`/devos …`) | [8](#8-commands-cheat-sheet) |
| Daily routine | [1](#1-start-here-your-daily-routine) |
| Deploying production | [11](#11-deploying-production) |
| Gates and merging | [4](#4-approve-and-merge-a-gate) |
| Glossary | [19](#19-glossary) |
| Halted task | [13](#13-when-something-goes-wrong) |
| Labels | [16](#16-labels-statuses-and-branches) |
| Method fix (change the automation) | [14](#14-change-or-fix-the-automation) |
| Pause everything | [15](#15-pause-or-stop-everything) |
| Progress while the builder works | [5](#5-watch-progress) |
| Request new work | [3](#3-ask-for-new-work) |
| Revise a task | [6](#6-run-re-run-or-revise-a-task) |
| Run a task by hand | [6](#6-run-re-run-or-revise-a-task) |
| Scripts, one by one | [18](#18-scripts-a-z) |
| Secrets and settings | [9](#9-secrets-variables-and-settings) |
| Statuses (`devos/checks`, `devos/verdict`, `devos/gate`) | [16](#16-labels-statuses-and-branches) |
| Stuck or quiet builder | [5](#5-watch-progress), [13](#13-when-something-goes-wrong) |
| Stages (big tasks split in parts) | [5](#5-watch-progress) |
| Time slices (long builds) | [5](#5-watch-progress) |
| Usage limits | [10](#10-usage-limits-and-accounts) |
| Variables | [9](#9-secrets-variables-and-settings) |
| Workflows, one by one | [17](#17-workflows-a-z) |

---

## 1. Start here: your daily routine

Dev OS builds the Tower by itself. Your part is small:

1. **Open the repository's Issues and Pull requests** once or twice a day.
2. **Look for the label `devos:needs-you`.** That label means only you can act. Its comment says what
   to do.
3. **Merge PRs labelled `devos:human-gate`** when their `devos/gate` status is green (section 4).
4. **Answer the supervisor** on the issue "Dev OS: supervisor" if it asks for an approval (section 7).
5. **Add what the issue "Dev OS: setup needed" lists**, if it is open (section 9).

Everything else, such as building, checking, reviewing, retrying, waiting out usage limits and
continuing long builds, happens without you.

## 2. How it works in one picture

```
You file a request ─► devos-intake plans it ─► you merge the plan
                                                    │
                       ┌────────────────────────────┘
                       ▼
         devos-cycle (one task attempt)
         Grok builds ─► checks ─► screenshots ─► Claude reviews ─► verdict
                       │
        ┌──────────────┼──────────────────┬───────────────────┐
        ▼              ▼                  ▼                   ▼
   PASS, no gate   PASS at a gate     FAIL                usage limit / stop
   auto-merge,     waits for YOUR     next attempt        waits, then resumes;
   next task       merge ─► deploy    with a new fence    supervisor watches
```

- **Grok** (in Cursor) is the builder. It writes the code.
- **Claude** is the reviewer and planner. It writes verdicts, fences and plans, but never code.
- **GitHub Actions** is the runner. It moves git, opens PRs and applies labels.
- **You** sign decisions and gates by merging.

## 3. Ask for new work

1. Go to **Issues → New issue → "Dev OS change request"**.
2. Describe what you want in plain words. Attach images if they help.
3. Submit. The label `devos:request` starts **devos-intake**.
4. Claude plans the work on a branch `intake/issue-N`. If it has questions, they appear on your
   issue. Answer them there.
5. An **intake PR** (label `devos:intake`) appears. It holds a draft decision (OD), the new
   rows in `docs/PHASES.md` and the first fence.
6. **Merging the intake PR signs the decision.** `devos-advance` then starts the first new task.

An existing issue can be planned by labelling it `devos:request` or by commenting `/devos intake`.

## 4. Approve and merge a gate

A gate is a point where the work waits for your judgement. Examples are risk-3 work, a design
gate, a database or rules change, and any change to the automation itself.

1. Open the PR labelled **`devos:human-gate`**.
2. Check its three statuses: **`devos/checks`** (the runner's checks), **`devos/verdict`** (Claude's
   review) and **`devos/gate`** (the gate doctor says it is ready).
3. Read the doctor's comment and look at the screenshots linked from the review.
4. If all three are green and you agree, **merge**. Your merge is the sign-off. It also
   **deploys production** (section 11) and starts the next task.
5. If you want changes first, comment `/devos revise <what to change>` (section 6).

A `ci` result that appears after the merge belongs to `main`, not to the PR.

## 5. Watch progress

- **Live builder progress:** the issue labelled **`devos:notices`** ("Dev OS: run notices", issue #1
  here) gets one comment per run, edited every 5 minutes:
  - 🟢 **working**: files changed in the last few minutes.
  - 🟡 **quiet**: nothing changed for 15 minutes or more. This is still allowed.
  - ⏱️ **time slice used up**: the work was saved and a fresh run continues it.
  - 🔌 **lost connection**: Cursor's connection dropped. The run restarts once, then waits.
  - 🔴 **stuck**: no file change, no output and no computing for 30 minutes, so the run was stopped. The comment names what it was doing.
  - Every update also shows the builder's **last action** (for example `running shell: pnpm e2e`).
  - Under that: the builder's **plan** (its own to-do list, ✅ done · 🔄 now · ⬜ left), its **latest note**, and **one line for every 10 minutes**: how much it read, searched, ran and edited, which files it edited and which commands it ran.
  - When a run ends a time slice, parks or halts, the same report is posted on the task's PR.
  - ✅ **finished**: next come the checks and the review.
- **Time slices:** a long build is split into slices of 72 minutes, up to 4 slices
  (`builder.max_time_slices`). Each slice commits its work with "(time slice k)" in the commit
  message, and the next run continues the same attempt from the branch. A long build is never
  thrown away.
- **Actions tab:** **Actions → devos-cycle** shows every run and its steps. You never need the logs,
  but they are there.
- **The PR itself:** labels and comments show where a task stands (section 16).

- **Stages (big tasks):** before writing a task's instructions, Claude judges how big it is. A task
  too big for one run is split into **2–4 stages** (for example: server, then screens, then motion,
  then tests). Each stage is one builder run that leaves the code working, and it is checked when it
  finishes. Claude reviews the whole task once, after the last stage. A PR comment says
  "stage k of N done". Quality comes first: big tasks get split; they never get less effort.
- **Helpers:** Claude's review uses three read-only helper agents. The **fence auditor** checks every
  set of task instructions before it is used, the **design inspector** checks the screenshots against
  the design, and the **security auditor** reads every risky line. Claude still makes the decision.

## 6. Run, re-run or revise a task

- **Start the next task by hand:** go to **Actions → devos-cycle → Run workflow** and leave the fields
  empty. It picks the next open row in `docs/PHASES.md`.
- **The run form's fields** (all optional):
  - `task`, `attempt`: pick a task and an attempt.
  - `review_only`: review again without building.
  - `effort`, `fast`: the builder's effort for this run.
  - `revision`: this attempt is a revision.
  - `reuse_review`: keep an earlier review.
  - `go`: release a held heavy run.
  - `cursor_account`, `claude_account`: which account starts.
- **Revise a task:** comment on its PR:
  `/devos revise <what to change, in plain words>`
  Claude rewrites the fence and Grok builds the next attempt. A revision may go past `max_attempts`.
  If a usage limit interrupts it, it resumes as the same revision after the reset.
- **Release a held heavy run:** comment `/devos go` on the "Dev OS: run notices" issue (only when `DEVOS_HEAVY` = hold).
- **Change a plan before merging it:** comment on the request issue and then `/devos intake`; `/devos revise` works on task PRs only.
- **Get the gate doctor's opinion:** comment `/devos doctor` on the PR.

## 7. The supervisor (the self-healing part)

The supervisor (**devos-supervisor**) watches every Dev OS run. It starts after each devos workflow
finishes, every 30 minutes (at :11 and :41), and when you approve or reject.

**What it fixes by itself, at most 2 times per cause:**

- re-runs a run that failed on the environment (network, setup steps);
- re-runs the `ci` check on `main` when an outside service broke it (network, Google Fonts download). A failed production deploy is re-run the same way **only** when an outside service broke the build and the site was not touched; any other deploy failure is only **reported**;
- re-dispatches a stuck, stalled or timed-out run;
- continues a halted task from its branch when time ran out;
- recovers work saved on a `rescue/` branch after a push conflict;
- starts the next task when nothing is running but a task is waiting;
- **closes finished requests**: when the plan of a change request or method fix is merged and every task it added has passed and been merged, it comments and closes the issue (you can reopen it);
- wakes a parked task whose wait is long overdue.

**What it asks you about:** anything else. If no rule explains a failure, it asks Claude Opus for a
read-only diagnosis, at most 6 times a day. Then it:

- writes a **proposal** on the issue **"Dev OS: supervisor"** (label `devos:supervisor`);
- or opens a **method fix** or **change request** issue;
- or lists **setup steps** for something only you can add.

**How you answer:** reply on the "Dev OS: supervisor" issue, starting the comment with the command:

```
/devos approve <id>
/devos reject <id>
```

The `<id>` is printed in the proposal. **Editing an old comment does nothing**: post a new one.

Each incident is reported **once**. If you already answered a halt with `/devos revise`, it stays quiet.
After 2 automatic tries on the same cause, it stops trying and labels the PR `devos:needs-you`.
It never merges, never pushes to `main` and never sees a secret value.
**Turn it off:** set the repository variable `DEVOS_SUPERVISOR` to `off`. The cycle keeps running.
**See how it reads a past run:** `node scripts/devos/supervisor.mjs classify --run <run id>`.

## 8. Commands cheat-sheet

Post these as a **new comment** that **starts** with the command. Only the owner, members and
collaborators can use them.

| Command | Where | What it does |
|---|---|---|
| `/devos intake` | a request issue | plans it (again) from the start, e.g. after you answered its questions |
| `/devos intake resume` | a request issue | continues a plan that stopped part-way |
| `/devos revise <what>` | a task PR (`task/Tnn`) only | rewrites the fence and builds again |
| `/devos go` | the "Dev OS: run notices" issue | releases a heavy run held by `DEVOS_HEAVY=hold` |
| `/devos doctor` | a PR | the gate doctor checks it again |
| `/devos setup` | the setup issue or a waiting PR | re-checks settings and resumes what was waiting |
| `/devos approve <id>` | "Dev OS: supervisor" issue | does the supervisor's proposal |
| `/devos reject <id>` | "Dev OS: supervisor" issue | declines it; nothing is done |

Interactive Claude Code commands (run `claude` in this repository on your machine):

| Command | What it does |
|---|---|
| `/devos-review Tnn` | reviews a task branch by hand |
| `/devos-method <what went wrong>` | diagnoses an automation problem and starts its fix |
| `/devos-new-project <brief>` | bootstraps a new project with this method |

## 9. Secrets, variables and settings

**Never paste a secret value into an issue, a comment, a file or a chat.** To set a secret, type it
at a hidden prompt:

```
gh secret set NAME -R Jovo-Jovi/devos-control-tower
```

Or use **Settings → Secrets and variables → Actions**.

- **Secrets** (names only):
  - builder and reviewer: `CURSOR_API_KEY`, `CURSOR_API_KEY_2`, `CLAUDE_CODE_OAUTH_TOKEN` (or
    `ANTHROPIC_API_KEY`) and their `_2` copies;
  - your fine-grained token: `DEVOS_PAT`;
  - Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`;
  - database: the `SUPABASE_*` secrets and `DEVOS_BACKUP_PASSPHRASE`.

  The full list with steps is in `devos/setup.json` and [`SETUP.md`](../SETUP.md).
- **When something is missing,** the issue **"Dev OS: setup needed"** (label `devos:setup`) lists it
  by name with steps. Add it, and waiting runs resume by themselves. To check at once, comment
  `/devos setup`.
- **Repository variables:** set them under **Settings → Secrets and variables → Actions →
  Variables**. A change applies from the next run.

| Variable | Set it to | Effect |
|---|---|---|
| `DEVOS_PAUSED` | `true` | stops every `devos-*` workflow |
| `DEVOS_SUPERVISOR` | `off` | stops only the supervisor |
| `DEVOS_VERCEL` | `true` | previews and production deploys on Vercel |
| `DEVOS_GITHUB_APP` | `true` | the GitHub App exists and is installed |
| `DEVOS_SUPABASE` | `true` | deploy backs up the database, then runs migrations |
| `DEVOS_PREVIEW_DB` | `true` | previews use their own database |
| `DEVOS_R2` · `DEVOS_FIREBASE` | `true` | storage and Firestore deploy steps (inactive in the Tower) |
| `DEVOS_SUPABASE_CLI_VERSION` | a version | the pinned Supabase CLI (default 2.120.0) |
| `DEVOS_HEAVY` | `hold` | heavy runs wait for `/devos go` (default: announce only) |
| `DEVOS_CURSOR_ACCOUNT` · `DEVOS_CLAUDE_ACCOUNT` | `2` | start with account 2 |
| `DEVOS_ACCOUNT_SWITCH` | `off` | never switch accounts at a limit |

- **Behaviour settings** live in `devos.config.json`:
  - `max_attempts`;
  - builder and reviewer models and efforts;
  - required checks;
  - who may edit what (`surfaces`);
  - waits (`resume`);
  - modules;
  - time slices and the stuck limit (`builder.max_time_slices`, `builder.idle_stop_minutes`);
  - the supervisor's limits (`supervisor`).

  Change them through a method fix (section 14).

## 10. Usage limits and accounts

- When Cursor or Claude hits a usage limit, the run **switches to the other account** if a `_2`
  secret exists.
- If both accounts are out, the task is **parked** (label `devos:quota-wait`) with the reset time.
  Short waits are slept in place. Long waits are relayed by **devos-wait** until the reset, and
  **devos-resume** checks every 2 hours as a backstop.
- A limit with no reset time is retried after 60, 120, 240 … minutes.
- **To resume at once** after you have more quota, go to **Actions → devos-resume → Run workflow**.

A usage limit is a wait, not a failure. No attempt is spent.

## 11. Deploying production

- **Production deploys only when you merge to `main`.** That is usually a gate PR.
- The runner's own auto-merges (label `devos:auto-merged`) do **not** deploy. They pile up until your
  next gate merge ships them all.
- **To deploy now without a merge:** go to **Actions → devos-deploy → Run workflow → production**.
- **The deploy order:**
  1. settings check;
  2. guards;
  3. database backup and migrations (if `DEVOS_SUPABASE`);
  4. the Vercel build and upload;
  5. a strict smoke test of the live site.

  A failing step stops the deploy before the app moves.
- A failed deploy re-runs by itself once the setup issue is complete.

## 12. Design and art changes

- The design rules rank in this order: `docs/DESIGN_SYSTEM.md` first, then `docs/design/` (the
  approved designs: v3, with the art in `docs/design/v3/assets/`). A change that contradicts
  `DESIGN_SYSTEM.md` needs a change request, so the rules are amended before the code.
- **New images** (backgrounds, planet maps): file a "Dev OS change request" with the images
  attached, or add them on a branch and reference them in the request.
- **Art checks:** `node scripts/scene/art.mjs verify` checks the bundled scene images against the owner's v3.2
  set in `docs/design/v3/assets/v3.2/` (names, byte identity, sizes, bytes).
- **Visual review:** each UI task's run captures screenshots, a filmstrip and a reduced-motion
  screenshot (`screens.mjs`). Claude compares them with the design documents.

## 13. When something goes wrong

Find the symptom, then do what the right column says. In most rows you do nothing.

| You see | The automation does | You do |
|---|---|---|
| 🟡 quiet on the progress comment | keeps watching; stops at 30 min of no change | nothing |
| ⏱️ time slice used up | commits, continues in a fresh run (up to 4) | nothing |
| 🔌 lost connection / 🔴 stuck | restarts once, then parks or halts; the supervisor re-dispatches | nothing, unless the supervisor asks |
| Label `devos:quota-wait` | waits for the usage reset, then resumes | nothing (or run devos-resume) |
| Label `devos:setup-wait` / setup issue open | waits for the missing setting | add it, comment `/devos setup` |
| Label `devos:halted` | doctor and supervisor look; a safe fix is applied | if `devos:needs-you`: `/devos revise <what>` |
| Label `devos:needs-you` | nothing more on its own | read the comment and act |
| A `rescue/…` branch exists | the supervisor merges it back into the task branch | nothing |
| A proposal on "Dev OS: supervisor" | waits for you | `/devos approve <id>` or `/devos reject <id>` |
| No deploy after a task passed | correct: auto-merges do not deploy | merge the next gate, or run devos-deploy |
| "This workflow file may be malicious" | nothing runs until approved | check the last workflow change; approve if it is yours |
| Supabase CLI "rate limit exceeded" | — | fix or delete `DEVOS_SUPABASE_CLI_VERSION` |
| The automation keeps misbehaving | the supervisor may open a method fix | or open "Dev OS method fix" with the run link |
| Everything must stop now | — | set `DEVOS_PAUSED` = `true` |

## 14. Change or fix the automation

1. Go to **Issues → New issue → "Dev OS method fix"** (label `devos:method`).
2. Describe the problem or the improvement, and paste the run link if there is one.
3. Claude diagnoses it from the run logs and opens a PR with a Phase `PM` task.
4. You merge it. The fix runs **before** any product task. Grok builds it, Claude reads every line,
   and **you always merge it** (a gate).

Every method change must also update [`AUTOMATION.md`](method/AUTOMATION.md). The guard
`guard:manual` fails if a workflow, script, label, variable or command is missing from it.

## 15. Pause or stop everything

| Goal | Do this |
|---|---|
| Stop all Dev OS workflows | variable `DEVOS_PAUSED` = `true` (set back to `false` to restart) |
| Stop only the supervisor | variable `DEVOS_SUPERVISOR` = `off` |
| Stop one running run | **Actions → the run → Cancel workflow** |
| Hold heavy runs for your OK | variable `DEVOS_HEAVY` = `hold`, then `/devos go` per run |

## 16. Labels, statuses and branches

**Labels**

| Label | Means |
|---|---|
| `devos` | made by Dev OS |
| `risk-1` · `risk-2` · `risk-3` | the task's risk; risk 3 always waits for you |
| `devos:request` | a change request to plan |
| `devos:method` | a method fix to plan |
| `devos:intake` | a plan PR; your merge signs it |
| `devos:human-gate` | waits for your merge |
| `devos:auto-merged` | merged by the runner (no deploy) |
| `devos:halted` | stopped after its attempts; see the comment |
| `devos:quota-wait` | waiting for a usage limit to reset |
| `devos:setup-wait` | waiting for a missing setting |
| `devos:needs-you` | only you can act |
| `devos:setup` | the "Dev OS: setup needed" issue |
| `devos:notices` | the run notices issue with live progress |
| `devos:supervisor` | the supervisor's issue |

**Statuses on a PR**

- `devos/checks`: the runner's checks (guards, typecheck, lint, tests, build, e2e).
- `devos/verdict`: Claude's review.
- `devos/gate`: the gate doctor says the PR is ready for your merge.

A red check overrides a PASS.

**Branches**

- `task/Tnn`: one per task.
- `intake/issue-N`: a plan.
- `rescue/task/Tnn-<run id>`: work saved from a push conflict; the supervisor recovers it.

## 17. Workflows A–Z

All are in `.github/workflows/`. "Run by hand" means **Actions → the workflow → Run workflow**.

| Workflow | Starts when | What it does | Run by hand? |
|---|---|---|---|
| `ci.yml` | push to main | the same checks on `main` | yes |
| `devos-advance.yml` | you merge a task or intake PR | starts the next task, or the task a method fix unblocked | no |
| `devos-cycle.yml` | dispatched by other workflows | one attempt of one task: build, check, screenshots, review, verdict, merge or wait | yes (section 6) |
| `devos-deploy.yml` | your push or merge to main | production deploy in order (section 11); skips runner auto-merges | yes (production or preview) |
| `devos-doctor.yml` | ci finishes, push to main, `/devos doctor` | keeps one doctor comment per PR, sets `devos/gate`, adds `devos:needs-you` | yes |
| `devos-intake.yml` | label `devos:request` or `devos:method`, `/devos intake`, `/devos go`, `/devos revise` | plans requests and method fixes; revisions; releases held runs | resume only |
| `devos-resume.yml` | every 2 hours | resumes parked runs and plans; re-checks the setup issue | yes |
| `devos-setup.yml` | push to main, `/devos setup` | checks settings by name, keeps the setup issue, resumes waiting work | yes |
| `devos-supervisor.yml` | any devos run or `ci` finishing, every 30 min, `/devos approve` / `/devos reject` | the supervisor (section 7) | yes (dry run available) |
| `devos-wait.yml` | dispatched by waiting jobs | sleeps through long usage-limit waits, relaying itself | no |

## 18. Scripts A–Z

These run inside the workflows. You never need to run them, but each one has a single job.
Runner scripts are in `scripts/devos/`, guards in `scripts/guards/`.

| Script | What it does |
|---|---|
| `accounts.sh` | picks the Cursor/Claude account and switches at a usage limit |
| `agent-watchdog.sh` | runs the builder in 72-minute slices; stops a lost connection (exit 125) or a stuck run (exit 126); a slice that runs out while working (exit 124) is continued |
| `builder-model.mjs` | chooses the Grok model id from the fence's Effort and Fast |
| `builder-status.mjs` | after the build: ok, continue (next slice), park (limit or lost connection) or halt |
| `checks-status.sh` | posts the `devos/checks` status |
| `doctor.mjs` | the gate doctor's facts, rules and comment |
| `evidence.mjs` | writes `.devos/evidence.md`, the reviewer's evidence pack |
| `firebase.mjs` · `r2.mjs` · `supabase.mjs` | start a module's local service and its checks |
| `guard-surfaces.mjs` | checks who changed what (builder, reviewer, intake) |
| `heavy.mjs` | announces or holds heavy runs |
| `lib.mjs` | shared helpers: config, `PHASES.md` parsing |
| `limit-check.mjs` · `limits.mjs` | detect usage limits and their reset times |
| `loop.mjs` | runs the same cycle on your own machine |
| `modules.mjs` | starts every module a task needs |
| `next-task.mjs` | picks the next task and attempt (method fixes first) |
| `probe.mjs` | checks that a URL answers (smoke test) |
| `progress.sh` | edits the live progress comment on the notices issue |
| `render-prompt.mjs` | fills the prompts in `devos/prompts/` |
| `rescue.sh` | merges a `rescue/` branch back into its task branch |
| `review-mode.mjs` | chooses a light or deep review, the model and the effort |
| `run-checks.mjs` | runs guards, typecheck, lint, tests, build and e2e |
| `screens.mjs` · `screens.test.mjs` | screenshots, filmstrip, reduced motion and layout shift; its self-test |
| `setup-check.mjs` · `setup-issue.mjs` | check settings by name; keep the setup issue |
| `supervisor.mjs` | the supervisor: scan, act, approve, classify (section 7) |
| `sync-main.sh` | merges `main` into the task branch before every push; saves a `rescue/` branch on conflict |
| `vercel-deploy.sh` | uploads the prebuilt app to Vercel |
| `verdict.mjs` | reads the review, applies the rules and decides merge, gate, retry, wait or halt |

**Guards** (`node scripts/guards/run-all.mjs`; one guard: `--only <name>`):

| Guard | Fails when |
|---|---|
| `boundary` | anything could accept or keep visitor data |
| `data` | a migration, policy, grant or seed breaks the data rules |
| `design` | a raw colour, a physical CSS property or a missing token appears |
| `i18n` | message catalogues differ |
| `literals` | a hard-coded contact or locale appears |
| `manual` | `AUTOMATION.md` misses a workflow, script, label, variable or command |
| `naming` | a forbidden bare noun is used as a name |
| `phases` | the `PHASES.md` ledger is malformed or out of order |
| `secrets` | a credential or project ref appears in a file |
| `services` | storage or Firestore rules break their rules |

**Product script:** `scripts/scene/art.mjs` is the Tower's scene-art tool (section 12).

**Prompts and schemas:** `devos/prompts/` holds `builder`, `reviewer`, `intake`, `method`, `revise`,
`doctor` and `supervisor`. `devos/schemas/` holds the JSON each one must return.

## 19. Glossary

- **Attempt:** one try at a task. A FAIL leads to the next attempt, up to `max_attempts`.
- **Carry-forward (CF):** a finding kept with an owner until a later task lands it.
- **Fence:** the task's specification (`docs/fences/Tnn.md`), the only thing the builder reads.
- **Gate:** a point that waits for your merge.
- **Halt:** a task stopped after its attempts. It waits for a revision or the supervisor.
- **Intake:** Claude planning a request into decisions, ledger rows and a fence.
- **Ledger:** `docs/PHASES.md`, every task in order with its verdict.
- **Method fix:** a change to the automation itself (Phase `PM`).
- **OD:** an owner decision in `docs/DECISIONS.md`. Merging the intake PR signs it.
- **Park:** a run waiting (usage limit or setup) that resumes by itself.
- **Precedent (PR-nn):** a binding rule in `docs/method/PRECEDENTS.md`.
- **Rescue branch:** where a run's work is saved when its push conflicts.
- **Time slice:** 72 minutes of building. A long build continues in the next slice.
- **Verdict:** Claude's PASS or FAIL, in `docs/reviews/`.
