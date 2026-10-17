# TOWER — Product brief

**Status:** SIGNED with the bootstrap commit (OD-01). Precedence 1, with `GLOSSARY.md`.
**Source:** `devos-plan` @ `1a3c2a9` — `seed/00-SEED.md` (Control Tower), `seed/05-decisions.md`
#3, #3b, `plan/M1.md`.

## What it is

**DEV_OS Control Tower** is a private, owner-only web application that **discovers, monitors, traces
and verifies** the projects that run on the Dev OS method. It receives one tiny authenticated event per
workflow step from each project (the event contract, `seed/06-event-contract.md`), observes the same
repositories through a GitHub App, and shows — per project, phase, task, attempt and step — what was
reported, what was observed, what is verified by both, what was imported from history, and how old each
fact is. From M1 it also shows the **agent usage** of every task attempt (builder and reviewer, per model
and account alias), with a coverage line that says how many attempts were actually measured.

It never participates in the work. A project's cycle completes, merges and deploys exactly the same
whether the Tower is up, slow or gone; events that cannot be delivered wait in the project's own journal
and arrive later, once, with their original time.

## Why it exists

The Dev OS method already runs projects as an automated builder/reviewer cycle (the pilot). What was
missing is a place that answers, truthfully and without reading any secret, "where is each project right
now, what did it claim, what can be verified, and what did it cost in model usage" — across many projects,
for the owner, from any machine. Tower-first order (decision 3b): once events flow, every later milestone
of the Dev OS ecosystem is traced from day one.

## Users

- **The owner** (GitHub `Jovo-Jovi`), the only person who can sign in. Identified by the GitHub
  **numeric user id** read server-side from `auth.identities`; never by username, never by metadata a
  user can edit (ADR-002). The owner registers projects, uploads history, reads everything.
- **Projects**, as machines: a GitHub Actions run presents an OIDC token (CI path); a local runner, from
  M2, presents a per-project write-only ingest key. They can only append events for the project they
  are registered as.
- **The GitHub App `devos-control-tower`**, as a machine: it delivers signed webhooks for the installed
  repositories (observed facts). It reads nothing it was not granted (ADR-003).
- Nobody else. No public page, no visitor, no second account until a signed OD adds one.

## Stack

Next.js App Router · TypeScript · CSS modules on one token stylesheet · pnpm · Vitest · Playwright ·
pgTAP. Postgres and Auth on Supabase (ADR-001; the GitHub provider only). Deployed to Vercel with
Standard Deployment Protection; machine routes answer on the production host only; no automation
bypass header anywhere in this repository (ADR-004). Built and reviewed by the same Dev OS automation as
the pilot, copied from `docs/method/AUTOMATION.md` §11 without change (OD-03).

## Success criteria for M1 (first useful point)

- The pilot's full history (25 tasks, 34 attempts, 6 phases) is imported and labelled **imported**.
- A live pilot task shows every step in the Tower within a minute of the step ending, labelled
  **reported**, and a reported `checks`/`verdict`/`gate` result backed by an observed commit status of
  the same sha and context is labelled **verified**.
- A forged, expired or wrongly addressed event is refused with `401`; nothing of it is stored but a
  reason code.
- The Tower down for a whole task changes nothing in the task; the queued events arrive later without
  duplicates.
- Unauthenticated access to any page or read API is refused; a non-owner GitHub account gets `403`.
- Every page and state passes the owner's design review at 1280 and 390.
- The Usage view shows the M1 attempts with the reviewer **measured**, the builder **unavailable**, and
  the coverage stated.
