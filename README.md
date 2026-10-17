# devos-control-tower — DEV_OS Control Tower, built by the automated Cursor ⇄ Claude cycle

**Status: bootstrapped on 2026-10-17 (B0).** The method is the pilot's, copied from
`Jovo-Jovi/devos-pilot` @ `4ccbef7`; the documents come from the planning repository `devos-plan`
@ `1a3c2a9`. The first task is **T01** (`docs/fences/T01.md`); nothing has been built yet.

The product is the **DEV_OS Control Tower**: a private, owner-only web application that **discovers,
monitors, traces and verifies** the projects that run on the Dev OS method. Each project's cycle sends
one tiny authenticated event per workflow step ([`docs/contract/EVENT_CONTRACT.md`](docs/contract/EVENT_CONTRACT.md));
a GitHub App delivers what GitHub observed; the Tower shows, per project, phase, task, attempt and
step, what was reported, what was observed, what both verify, what was imported from history, how old
each fact is, and what every attempt cost in agent usage. It never participates in the work: a project
completes, merges and deploys exactly the same whether the Tower is up, slow or gone. The first source
is the pilot itself. The brief is [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md).

---

## The method in brief

> The human owns **decisions**. Documents own **truth**. The reviewer owns **verdicts**. The
> builder owns **execution**. Nothing ships without a written, verified gate, and nothing starts
> before the thing it depends on has arrived.
> — the handbook, [`docs/method/DEV_OS_V2_REVIEWER.md`](docs/method/DEV_OS_V2_REVIEWER.md)

**The five pillars** (handbook §1):

1. **Written, signed scope.** Every scope question becomes a numbered decision (an OD) before any
   code that depends on it.
2. **Documents in precedence order.** When two documents conflict, the higher one wins or a formal
   amendment is written. Conflicts are never quietly smoothed over. The order is in
   [`CLAUDE.md`](CLAUDE.md).
3. **Roles that never overlap.** The reviewer never writes product code. The builder never invents
   scope. The human decides.
4. **Gates with written PASS/FAIL verdicts, computed from the repository.** A pasted report never
   counts as evidence.
5. **Dependencies first.** Design is approved before pages are built, and content arrives before
   the features that show it.

### Who does what

| Role | Who | Owns | Never |
|---|---|---|---|
| **Human** | you | decisions (ODs), the merge at every gate, accounts and secrets | merges before a verdict; puts a secret in a file or a chat |
| **Builder** | Grok 4.7 in the Cursor CLI | code, tests, migrations, its report | invents scope, runs git, edits fences or reviews |
| **Reviewer** | Claude Code: Sonnet 5.5 for light reviews, Opus 5.5 for deep reviews and planning | fences, verdicts, plans for requests and method fixes | writes product code (it may change only `docs/reviews/**` and `docs/fences/**`) |
| **Runner** | GitHub Actions + `scripts/devos/` | git, PRs, labels, statuses, the ledger | decides a verdict on its own (it applies `verdict.mjs`) |

### The words

| Word | Meaning | Lives in |
|---|---|---|
| **OD** | A signed decision. Scope exists only if an OD or the scope document says so. | `docs/DECISIONS.md`, `docs/SCOPE.md` |
| **Fence** | One self-contained task prompt with preconditions, steps, *Done when*, tests and *Do NOT*. It carries the builder's effort, from low to xhigh. | `docs/fences/Tnn.md` |
| **Report** | The builder's claim, with real command outputs | `docs/reports/Tnn.md` |
| **Verdict** | The reviewer's PASS or FAIL for each *Done when* row, judged from the tree | `docs/reviews/Tnn-aN.md` |
| **Gate** | A point only your merge can pass: risk 3, a named gate, a migration, a rules file or a method change | Gate column of `docs/PHASES.md` |
| **Ledger** | The task table. Only the runner writes Done and Verdict. | `docs/PHASES.md` |
| **Precedent (PR)** | A binding rule, usually learned from an incident | `docs/method/PRECEDENTS.md` |
| **Carry-forward (CF)** | A finding kept with an owner until it lands | `docs/method/CARRY_FORWARDS.md` |
| **Boundary gate** | Proof that no visitor data is accepted or kept outside a declared zone. It cannot be waived. | `docs/BOUNDARY_MODEL.md` |

### Rules that never bend

- **Fetch, never paste.** The tree is the evidence; a report is only a claim (PR-02).
- **Red checks override PASS** (PR-08), and **nothing merges before its verdict** (PR-13).
- **Agents never hold a git credential** (PR-04). **No secret ever enters a file**, and no workflow
  receives every secret at once (PR-32, PR-33).
- **A usage limit is a wait, not a failure.** The run switches account, or parks and resumes
  (PR-12, PR-29, PR-31).
- **The automation is repaired through the same cycle**, with a deep review and your merge (PR-28).

---

## How the automation runs it

```
 you open the issue form "Dev OS change request"
        │
        ▼
 devos-intake: Claude plans it ──► intake PR (draft OD, PHASES rows, first fence, settings needed)
        │ your merge signs the OD
        ▼
 ┌──────────────── devos-cycle: one run = one attempt of one task ─────────────────┐
 │ next task from PHASES.md → Grok builds on task/Tnn with local Supabase, R2 and  │
 │ Firestore running → surface guard → PR → every check → evidence pack →         │
 │ Claude reviews (light or deep) → verdict.mjs decides → ledger updated           │
 └────┬──────────────┬─────────────────┬────────────────┬──────────────────┬──────┘
      │ PASS,        │ PASS at a       │ FAIL,          │ usage limit      │ a setting
      │ no gate      │ gate            │ attempts left  │                  │ is missing
      ▼              ▼                 ▼                ▼                  ▼
  auto-merge,    waits for your    reissued fence,  other account,    "setup needed"
  next task      merge, then       next attempt     or park and       issue lists it;
                 next task                          resume at reset   resumes when added

 a merge you make to main ──► devos-deploy: backup → migrations → Firestore rules + seed
                              → app upload → smoke test
```

Before you merge a gate PR, check its three statuses: **`devos/checks`**, **`devos/verdict`** and
**`devos/gate`**. A `ci` result that appears after the merge belongs to `main`, not to the PR.

**Everything the machine does** is in the operating manual,
[`docs/method/AUTOMATION.md`](docs/method/AUTOMATION.md). It covers:

- every flow, workflow, script, guard, label, status and variable;
- what happens when something fails;
- how to change the automation safely.

`guard:manual` fails any change that leaves the manual behind.

## Your part

1. **Ask for work** with the "Dev OS change request" issue form. Answer the planner's questions on
   the issue, then merge the intake PR to sign its decision.
2. **Merge PRs labelled `devos:human-gate`** once `devos/gate` is green. That merge is your sign-off.
3. **Add what the "Dev OS: setup needed" issue lists.** Waiting runs then resume by themselves.
4. **If the automation misbehaves, or you want it to work differently**, open a "Dev OS method fix"
   issue with the run link. Or run `claude` here and type `/devos-method <what went wrong>`.
5. **To stop everything**, set the repository variable `DEVOS_PAUSED` to `true`.

---

## Where the Tower stands

| | |
|---|---|
| Bootstrap | B0 on 2026-10-17: method from `devos-pilot` @ `4ccbef7`, documents from `devos-plan` @ `1a3c2a9` |
| Decisions | OD-01…OD-06 signed by the bootstrap push (`docs/DECISIONS.md`); Tower ADR-001…004 in `docs/adr/` |
| Plan | milestone M1 of `devos-plan`: Tower v1 observing the pilot (`docs/SCOPE.md`, `docs/PHASES.md`) |
| Stack | Next.js on Vercel (Standard Deployment Protection, region `fra1`) · Supabase Postgres + Auth (GitHub provider, owner-only, `eu-central-1`) · a GitHub App for observed facts (ADR-001…004) |
| Event contract | `docs/contract/EVENT_CONTRACT.md` v1 (`seed/06-event-contract.md` of `devos-plan`, pinned) |
| Built so far | nothing; T01 is next |

| Phase | What | Tasks | Gate |
|---|---|---|---|
| P01 | Tower v1 foundation: owner sign-in, OIDC-verified ingestion, GitHub App webhook receiver | T01–T03 | G-Tower-Auth, G-Tower-Ingest, G-Tower-Observe |
| P02 | Tower v1 pages: portfolio, usage view, project timeline, pilot history replay | T04–T07 | G-Tower-v1 |

Between T02 and T03 the pilot adopts its reporting method fix (plan label PM01) and the owner runs the
CK1 checkpoint: a real pilot cycle run whose events land in the Tower's Postgres, proven by SQL and
recorded in `docs/DEVELOPMENT_JOURNAL.md`. After T07 the pilot's companions report too (PM02) and the
Tower reports its own events (plan label TM01, a Phase `PM` method-fix row added by intake). The
plan-label → task-id map is `plan/ID-MAP.md` in `devos-plan`.

---

## Using it for the next project

This repository was bootstrapped by hand from the runbook `plan/tower-bootstrap/B0-BOOTSTRAP.md` of
`devos-plan` instead of `/devos-new-project`: the brief, the documents and fence T01 were written by the
planner there. For the next project the steps are the pilot's:

1. Create a new **private** repository.
2. **Copy the method from here:**
   - `scripts/devos/` and `scripts/guards/`
   - `devos/`
   - `.github/workflows/` and `.github/ISSUE_TEMPLATE/`
   - `.cursor/`
   - `.claude/commands/`
   - `devos.config.json`
   - `docs/method/`: the handbook, `FULLSTACK_MODULE.md`, `AUTOMATION.md` and `PRECEDENTS.md`.
     Keep the precedents: they are the rules the runner implements. PR-34 is this repository's
     configuration ruling; restore the pilot's `i18n.mjs` constant and `design.mjs` host rule unless
     the next project needs the same deviations.
3. Run `claude` in the new repository and type `/devos-new-project <one-paragraph brief>`. It does
   the fit research and writes the documents, the ODs, `PHASES.md` and fence T01.
4. Copy `.claude/settings.json` **last**. It locks the reviewer to reviews and fences.
5. Follow [`SETUP.md`](SETUP.md): accounts, secrets and variables. Then push the bootstrap; that
   push signs the ODs.
6. Run `devos-cycle`. From then on, the [steps above](#your-part) are your whole job.

---

## Map

| Path | What |
|---|---|
| [`docs/method/DEV_OS_V2_REVIEWER.md`](docs/method/DEV_OS_V2_REVIEWER.md) | The method: pillars, journey J0–J11, documents, governance, gates, templates |
| [`docs/method/AUTOMATION.md`](docs/method/AUTOMATION.md) | The operating manual of the automated cycle |
| [`docs/method/PRECEDENTS.md`](docs/method/PRECEDENTS.md) | Binding rules PR-01…PR-34, each with the incident or request it came from |
| [`docs/method/FULLSTACK_MODULE.md`](docs/method/FULLSTACK_MODULE.md) | Database, storage and Firestore modules: local copies, checks, deploy order (the Tower uses the database module only) |
| [`docs/method/CARRY_FORWARDS.md`](docs/method/CARRY_FORWARDS.md) | Findings kept with an owner until they land (empty at B0) |
| [`SETUP.md`](SETUP.md) | Accounts, secrets, variables, Supabase, Vercel, the GitHub App |
| [`CLAUDE.md`](CLAUDE.md) · `.cursor/rules/` | The reviewer's rules · the builder's rules |
| `devos.config.json` | Models, efforts, attempts, required checks, who may edit what, modules, waits |
| `docs/PRODUCT_BRIEF.md` · `docs/GLOSSARY.md` · `docs/SCOPE.md` · `docs/DECISIONS.md` | The brief · the words · the scope · the ODs |
| `docs/DATA_MODEL.md` · `docs/SECURITY_MODEL.md` · `docs/BOUNDARY_MODEL.md` · `docs/DESIGN_SYSTEM.md` · `docs/I18N_MODEL.md` · `docs/CONTENT_MODEL.md` | The models the fences cite |
| `docs/PHASES.md` · `docs/SESSION_CONTEXT.md` · `docs/DEVELOPMENT_JOURNAL.md` | The ledger · the session · the journal (owner gates CK1 and G-Tower-v1 are recorded here) |
| [`docs/contract/EVENT_CONTRACT.md`](docs/contract/EVENT_CONTRACT.md) · `docs/adr/` | The event contract v1 (pinned copy) · Tower ADR-001…004 |
| `docs/fences/` · `docs/reports/` · `docs/reviews/` · `docs/requests/` | Every task's prompt, claim, verdict and request plan |
| `devos/` · `scripts/devos/` · `scripts/guards/` · `.github/workflows/` | Prompts, schemas and settings list · runner · build-failing guards · workflows |
| `.claude/commands/` | `/devos-review Tnn`, `/devos-method`, `/devos-new-project` |
