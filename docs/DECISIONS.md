# TOWER — Decisions

Precedence 2, with `SCOPE.md`. A signed OD is never edited; a later OD amends it.
**Basis of signature for OD-01 to OD-06:** the owner's push of the bootstrap commit to `main` is the
confirming act. Every OD below restates a decision already taken in `devos-plan` (`seed/05-decisions.md`,
the Step-1/2/3/4 answers, the seven ADRs); none adds a new one.

---

### OD-01 — Tower purpose, profile and boundary
**Status:** SIGNED — bootstrap push
**Amends:** none
**Requested by:** the owner (`seed/00-SEED.md`, decision 3b)
**1.** TOWER is the private Control Tower of the Dev OS ecosystem: Discover · Monitor · Trace · Verify.
It is a separate product with its own repository and deployment and is **never a dependency** for any
project's local or automated work.
**2.** Profile **A** with one zone, `owner`, that covers the whole application (`BOUNDARY_MODEL.md`):
there is no public page. Forms, the session cookie and route handlers exist only for the owner and for
the two machine routes.
**3.** The **Boundary gate** holds for the public in full: nothing accepts or keeps a visitor's data;
analytics, trackers and third-party scripts are forbidden everywhere, zone included.
**4.** Personal data: none from the public. The Tower stores the owner's GitHub numeric id (allow-list)
and, in observations, an actor login only when it is the owner or a bot (`ADR-003`). No domain gate.
**Does not decide:** a second user, viewer access (`PROPOSALS.md` P-04), discovery beyond M1.

### OD-02 — One owner, who signs every gate
**Status:** SIGNED — bootstrap push
**1.** The owner (GitHub `Jovo-Jovi`) is the only person who can sign in, identified by the GitHub numeric
id read server-side from `auth.identities` (`provider = 'github'`, `provider_id`) through
`public.is_owner()`; `user_metadata`, `raw_user_meta_data` and `app_metadata` are never read (ADR-002).
**2.** The allow-list is one row in `public.owner_allowlist`, inserted once by the owner in the Supabase
SQL editor; the value is in no file, variable or secret of this repository.
**3.** The owner signs every human gate by merging (`G-Tower-Auth`, `G-Tower-Ingest`, `G-Method-*`,
`G-Tower-Observe`, `G-Tower-v1`) and reviews every UI task's screenshots at 1280 and 390.
**Does not decide:** recovery beyond re-inserting the row or relinking the identity out of band.

### OD-03 — Built by the same automation as the pilot, unchanged
**Status:** SIGNED — bootstrap push
**1.** The repository is created from the pilot's `docs/method/AUTOMATION.md` §11 copy list: runner
scripts, guards, workflows, prompts, schemas, skills, `devos.config.json`, handbook, `FULLSTACK_MODULE.md`,
`AUTOMATION.md`, `PRECEDENTS.md`. Nothing in them is rewritten for the Tower; the two configuration
deviations are listed in `plan/tower-bootstrap/B0-BOOTSTRAP.md` §4 and are configuration, not method.
**2.** Every Tower task passes through `devos-cycle` on GitHub (`plan/00-PLAN.md` "Where M1 runs").
Local interactive work may draft; a local result never counts as a task's PASS until the local runner has
parity (M2).
**3.** Task ids are `Tnn` as `guard:phases` requires; method fixes are `Tnn` rows with Phase `PM`
(PR-28). Plan labels (`TM01`, `TM02`, `T08`…) map to repository ids in `plan/ID-MAP.md`.
**4.** `DEVOS_PAT` for this repository, if a method fix must change a workflow file, is a **separate**
fine-grained token scoped to this repository only, under pilot ADR-006's conditions; it is never the
pilot's token.
**Does not decide:** the engine (`devos-engine`, M4) — until then the method is copied, not installed.

### OD-04 — Stack and hosting
**Status:** SIGNED — bootstrap push
**1.** Next.js App Router on Vercel (private project, Standard Deployment Protection); Postgres and Auth
on Supabase, the GitHub provider only; Firestore rejected for this product (Tower ADR-001).
**2.** Machine routes (`/api/ingest`, `/api/github/webhook`, later `/api/github/reconcile`) answer on the
production host only (`VERCEL_ENV === 'production'` and `Host` = the host of `TOWER_URL`), otherwise
`404`; no automation bypass header or secret name exists in this repository (Tower ADR-004).
**3.** `TOWER_URL` is the production URL and the OIDC audience (pilot ADR-005). A custom domain later is
a coordinated change announced in the contract's change log.
**4.** Settings are checked by **name only** (`devos/setup.json`, PR-27); values live in GitHub secrets,
GitHub variables and the Vercel Production environment, never in this repository.
**Does not decide:** a paid Supabase plan or a second organisation (M0 capacity check, owner's choice).

### OD-05 — Facts, origin and age; reporting never blocks
**Status:** SIGNED — bootstrap push
**1.** The Tower stores events exactly as `seed/06-event-contract.md` v1 defines them, orders them by
`seq` within a run and runs by server `created_at`, never by the sender's clock; `received_at`, `origin`
and `source` are server-set.
**2.** Every fact shows its origin — reported · observed · verified · imported — and its age; last
activity and last contact are two values; stale after `stale_after_minutes` per project (default 24 h);
a Tower-health banner replaces numbers when the Tower's own query fails.
**3.** Idempotency key `(project, run, seq)`: identical body again → `200 duplicate`; a different body →
`409 duplicate_conflict`, the first event wins, a reason-only rejection row.
**4.** Agent usage (`usage` on `build`/`review` terminal events) is stored as given, never estimated; a
tool that exposes nothing is `unavailable`; the Usage view states coverage and lists failed attempts
separately; no cost figure in v1.
**5.** Nothing the Tower does can delay, fail or change a project's step, verdict, merge or deploy.
**Does not decide:** snapshots or trend lines (`PROPOSALS.md` P-06, P-08).

### OD-06 — Design direction is approved as the frame; every UI task refines it under review
**Status:** SIGNED — bootstrap push
**1.** `DESIGN_SYSTEM.md` as committed in the bootstrap is the approved **direction** (idea, tokens, type,
components, compositions, quality floor). It is not a mock-up: each UI task's fence carries a Design
specification that refines the direction for its pages and states.
**2.** Enforced UI/UX: Design specification → Implementation → Visual verification (screenshots at 1280
and 390 for every page and state) → Acceptance. In M1 the owner and the reviewer judge by hand; M3 makes
the gate mechanical (`DESIGN REVISE`). A correct page with poor UI/UX does not pass.
**3.** No design tool is a dependency: the direction is text and tokens in this repository.
**Does not decide:** a second locale (`I18N_MODEL.md` records the one-locale assumption for the owner to
confirm).
