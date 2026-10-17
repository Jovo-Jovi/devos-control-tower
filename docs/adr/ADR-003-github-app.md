# ADR-003 — GitHub App `devos-control-tower`: permissions, events, webhook secret by name, observed origin

**Status:** Accepted, 2026-10-17 (decision 3; Step-1 answer Q6; Step-3 correction 4). Lands in
`devos-control-tower/docs/adr/` by T01; used by T03 (receiver) and M5 (reconcile).
**Source:** `devos-plan` @ `1a3c2a9` — `seed/05-decisions.md` #3 and #3a, `plan/00-UNDERSTANDING.md`
Q6, `plan/M1.md` T03, `plan/M5.md` T10–T12.

## Context

The Tower needs signals that do not come through the reporting path, so that a reported completion can be
checked against something GitHub itself observed. The pilot's `devos/checks`, `devos/verdict` and
`devos/gate` are **commit statuses** (verified in `scripts/devos/checks-status.sh`, `scripts/devos/doctor.mjs`
and `devos-cycle.yml`), not check runs; the final `devos/checks` and `devos/verdict` of an attempt are posted
on the review commit, the PR head. Webhooks are the cheapest observed source; a GitHub App is the only way to
receive them for every repository of an account with scoped, revocable, non-personal permissions. In M5 the
same App lists the repositories it is installed on and detects the engine manifest.

## Decision

- App name `devos-control-tower`, owned by the owner's account, installed on the owner's account first.
  Other owners install it themselves (consent) or use `devos connect`; the Tower never asks GitHub about an
  account that has not installed it.
- Permissions (all **read**): Actions, Checks, Commit statuses, Pull requests, Metadata. No write
  permission in M1–M4. M5 manifest detection needs **Contents: read**; that is a permission update requested
  in M5 and accepted by the owner on the installation — not granted now.
- Events: `workflow_run`, `check_run`, `status`, `pull_request`, `installation`,
  `installation_repositories` (the last two are metadata-only and feed integration health from M5; the
  receiver stores unknown kinds nowhere and answers `202`).
- Webhook secret: Vercel environment variable `GITHUB_WEBHOOK_SECRET`, checked **by name** by
  `setup-check`; signature `X-Hub-Signature-256` verified with HMAC-SHA256 on the raw body before anything is
  parsed. App id and private key: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, server environment only, used
  only by the M5 reconcile route to mint short-lived installation tokens — never stored, never in M1–M4
  code paths.
- Receiver `POST /api/github/webhook` on the production host only (ADR-004). `webhook_deliveries` keeps the
  delivery id unique (`X-GitHub-Delivery`); a redelivery is a `202` no-op. `observations` stores only:
  project, sha, kind, context (for `status`), state, conclusion, PR number and labels (for `pull_request`),
  actor login **only when the actor is the owner or a bot**, `at` (GitHub's timestamp), `received_at`. Raw
  payloads are not stored. Deliveries for repositories not registered as projects → `202`, nothing stored.
- Origin: everything that arrives through the App is **observed**. A reported `checks`, `verdict` or `gate`
  event becomes **verified** when an observation with the same repository, commit and context
  (`devos/checks`, `devos/verdict`, `devos/gate`) and a matching state exists (pilot ADR-004 §verification).

## Consequences

- The verification source is independent of the sender even though the pilot's own workflow posts the
  statuses: they travel through GitHub, not through `report.mjs`, and carry GitHub's timestamp.
- The App cannot write anything; `PROPOSALS.md` P-01 (App installation token replacing `DEVOS_PAT`) would
  add Contents and Workflows **write** — a separate decision when due.
- Installation on another account is visible in `/scope` (M5) as the scope of what the Tower can see; what it
  cannot see is stated there in plain words.
- Revocation (`installation.deleted`) marks the integration revoked and keeps the last known state labelled;
  nothing is deleted automatically.
