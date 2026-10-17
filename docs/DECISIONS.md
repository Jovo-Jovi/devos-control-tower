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

**Amendment A1 (2026-10-17) — Design system v2, "Night-shift control room"**
**Status:** SIGNED by the owner's merge of the pull request that lands it.
**1.** `DESIGN_SYSTEM.md` v2 replaces v1 as the approved direction: one dark theme derived from the
Raycast style (Refero Styles) the owner chose, Inter + Geist Mono, and a motion system (tokens §1,
choreography §4, rules §5) inspired by the prompt-motion.com gallery. Truthfulness, origin/age and
"meaning never by colour alone" are unchanged and outrank motion.
**2.** Motion is part of the enforced UI/UX gate: every UI task's evidence adds motion filmstrips,
reduced-motion screenshots and a zero layout-shift value (§7); the design ledger gains a *motion* row.
**3.** New dependency allowed: `motion` (Motion for React). No other animation library.
**4.** The sign-in shipped by T01 is retrofitted to v2 by a task planned before T04; the fences of T04–T07
are written against v2 (the v1 Design specifications in `devos-plan` are not copied as they are).
**Does not decide:** a light theme (later scope amendment).

### OD-07 — Design system v2 lands inside T04; the sign-in retrofit is T09
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** OD-06 Amendment A1 §4 (the timing of the v2 foundation and of the sign-in retrofit only)
**Requested by:** issue #5 (the owner's option (c) in the issue thread)
**Numbering note:** the "OD-07" and "OD-08" cited by the method files copied from the pilot (`CLAUDE.md`
"Automation v3", workflow and runner comments) are `devos-pilot`'s decisions, carried unchanged under
OD-03. This OD-07 is the Tower's. Likewise "T09" below is this repository's task id; the "plan label T08"
in `SCOPE.md` A-1 is a `devos-plan` label mapped in `plan/ID-MAP.md`.
**1.** No task is inserted before T04 and nothing is renumbered. **T04 lands the v2 foundation as part of
its own scope**, row unchanged: the tokens of `DESIGN_SYSTEM.md` §1 byte for byte in `src/styles/tokens.css`
(new values under the existing names, so the sign-in shipped by T01 turns dark with it); Inter + Geist Mono
through `next/font/google` in place of IBM Plex (§2); the `motion` dependency (OD-06 A1 §3); and the
primitives T04 itself uses — `LiveMark`, the `StatusChip` transition, `Counter`, the FLIP list, the
`StateBlock` sheen, `Toast`, and View Transitions between routes (§3–§5). T04's fence also carries
sign-in screenshots at 1280 and 390, proving the T01 states still read correctly in the dark tokens.
**2.** T05, T06 and T07 each add the further primitives they use (§3). The fences of T04–T07 are written
against v2 (`DESIGN_SYSTEM.md` §1–§8); the v1 Design specifications in `devos-plan` are not copied.
**3.** The sign-in retrofit (`DESIGN_SYSTEM.md` §4.1: first paint, redirecting, "Checking your access…",
the success transition with the shared product mark, denied, error, signed out) is **T09**, after T07,
**risk 3**, gate **G-Design-v2**. Until T09 the sign-in keeps T01's structure in the v2 tokens.
**4.** To make the "Checking your access…" interstitial truthful (it shows only while the code exchange is
pending), T09 turns `/auth/callback` into the page that shows it and moves the code exchange, unchanged,
into a new route handler `GET /auth/confirm`. The claim path, `public.is_owner()`, the 303/403 answers,
the header baseline and the CSP do not change. Supabase's redirect URL stays `/auth/callback`, so no
dashboard setting changes. `SECURITY_MODEL.md` §3 lists both routes.
**5.** Motion evidence (`DESIGN_SYSTEM.md` §7) in the runner (`scripts/devos/screens.mjs`) is a method
fix the owner files as a separate "Dev OS method fix" issue (Phase `PM`, its own intake, PR-28); it is
not planned here. Until it lands, every UI task's builder produces the filmstrips, the reduced-motion
screenshots and the layout-shift value from its own Playwright spec into `.devos/screens/`, under file
names its fence states.
**6.** Gate **G-Design-v2** (the owner merges T09): on production at 1280 and 390 the sign-in plays every
§4.1 state; with "reduce motion" on, the same states are clear without movement; the review shows the
filmstrips and a layout-shift value of 0 for every state.
**7.** The boundary is unchanged: no new form field, cookie, storage, third party or stored data; the new
route lies inside the `owner` zone (`src/app/**`), so the `devos:boundary` line does not change. No new
setting outside the repository (`docs/setup-items.json` not needed).
**Does not decide:** a light theme; the design of the §7 method fix (its own intake); a guard for
durations and easings (still a review finding, `DESIGN_SYSTEM.md` preamble); "use another account"
forcing GitHub's account chooser (the button restarts the same sign-in).

### OD-08 — Design system v3: two themes, the scene and the tower map
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** OD-06 Amendment A1 §1 (the approved direction becomes v3; its "Does not decide: a light theme" is now
decided) and OD-07 §1–§3 and §6 (what T04 lands, the design the T05–T07 fences follow, the sign-in retrofit's
design and its gate test)
**Requested by:** issue #13 (the owner's answers in the issue thread: layout (a), import last)
**Numbering note:** as OD-07 says, the "OD-07" and "OD-08" cited by the method files copied from the pilot
(`CLAUDE.md` "Automation v3", workflow and runner comments) are `devos-pilot`'s decisions. This OD-08 is the
Tower's.
**1.** `docs/DESIGN_SYSTEM.md` v3 ("Energy-blade control tower") replaces v2 as the approved direction: a light and
a dark theme with **Auto** (the system setting) as the default and a header switch **Auto · Light · Dark**, the
tokens of its §1, the scene and planet behind every page, and the overview `/` as the tower map. The approved
design folder `docs/design/v3/` (README, mockup, assets, screens) ranks with it at precedence 8; where they differ,
`DESIGN_SYSTEM.md` holds. v2's three rules (truthfulness, never colour alone, motion never lies) are unchanged and
outrank motion.
**2.** The motion amendments A–E of `docs/design/v3/README.md` §8 are signed as `DESIGN_SYSTEM.md` §5 states them:
(A) the theme switch is a 1.8 s transition of the scene and planet (`--dur-scene`); (B) the scene's ambient loops
are allowed and all stop under reduced motion and while the page is hidden; (C) `stroke-dashoffset`,
`offset-distance` and `mask-position` join the animated properties, `filter` and `box-shadow` stay static;
(D) one text accent, one energy colour (never text), gradients only in the scene, tower and planet; (E) reduced
motion switches the theme instantly and keeps every meaning.
**3.** The theme lasts for the open document only: the switch sets `data-theme` on `<html>`, and nothing is
stored (no cookie, browser storage, URL parameter or database value). A reload returns to Auto.
**4.** The ledger is as the owner renumbered it on `main` (commit `1792346`): **T04** = design v3 foundation
(tokens for both themes, theme switch, Inter + Geist Mono, the `motion` dependency, scene and planet, the app shell,
the styled not-found page, the sign-in on the v3 tokens and scene); **T05** = the overview as the tower map with
`/api/projects`, the §6 values, cards, blades, panels, list, phone layout, the register page and the Tower-health
banner, gate **G-Design-v3**; **T06** usage view; **T07** project page; **T09** sign-in retrofit; **T10** history
import with **G-Tower-v1**, last. `docs/fences/T04.md` v2 replaces the v1 fence of the old scope (attempt 1 changed
no file). The fences of T05, T06, T07, T09 and T10 are written against v3.
**5.** **T09 is built against v3** (the owner's answer 2): OD-07 §3–§4 stand (the states of v2 §4.1, "Checking your
access…" on the `/auth/callback` page, the code exchange moved unchanged to `GET /auth/confirm`, risk 3), with the
scene and planet as the atmosphere instead of v2's gradients. Its row keeps its id, its wording and the gate id
**G-Design-v2**; OD-07 §6's test applies to the v3 states in both themes. The reviewer who passes T07 reissues
`docs/fences/T09.md` against v3 (its v1 checks v2 tokens such as `--glow-accent`, which v3 removes).
**6.** Data: no migration, table, view or function. Every value of the map comes from the existing tables through
the owner's session (RLS `is_owner()`), as `docs/design/v3/README.md` §6 lists; `aggregatePortfolio` grows the
latest task and phase, the execution (`runs.source`), tasks and phase passed of seen; nothing is estimated, and a
value the tables cannot give is `—` with its legend.
**7.** The scene's images are bundled from `src/components/scene/assets/` (served under `/_next/static/media/`)
instead of `public/scene/`: the sign-in proxy redirects every other path without a session (`src/proxy.ts`), and
serving `public/` to `/sign-in` would need a proxy change. `src/proxy.ts`, `next.config.ts`, the CSP and every
header stay unchanged (`img-src 'self'` already covers the bundled images).
**8.** Realistic art (`docs/design/v3/README.md` §13, `DESIGN_SYSTEM.md` §10) is part of **T04**, after the
foundation, time-boxed and never blocking: original prompts committed with the task, a check script, the baseline
kept when the image tool is not available or an image fails a check; the reviewer looks at every replaced image.
**9.** Gate **G-Design-v3** (the owner merges T05): on production at 1280 and 390, in light and dark, the map shows
every registered project with the correct link state and "of seen" counts; the theme switch turns the planet into
night and back in about 1.8 s; with reduce motion on, the switch is instant and every loop stops with the same
meaning; the review carries the README §10 evidence (theme-switch filmstrip, reduced-motion screenshots in both
themes, layout shift 0, the contrast recomputed).
**10.** The boundary is unchanged: no new form field, cookie, storage, third party or stored data; the theme is
not persisted (§3); every new file lies inside the `owner` zone or holds no form control or storage, so the
`devos:boundary` line does not change. No new host (fonts are self-hosted by `next/font` at build). No new
setting outside the repository (`docs/setup-items.json` not needed), no key, no method change.
**11.** Two carry-forwards of `docs/reviews/T03-a1.md` are settled by v3: (c) `LiveMark` follows the poll of
`/api/projects`, never Supabase Realtime (`DESIGN_SYSTEM.md` §3); (d) the font variables are `--font-inter` and
`--font-geist-mono`, so `--font-mono` no longer refers to itself (§1). T04 lands both rows as closed.
**Does not decide:** theme persistence (README §11 D1: a preference cookie is a Boundary amendment, a `theme`
column a schema change); pages that do not exist (D2); instances, lifecycle and ledger totals (D3, an event-contract
change); observed-only repositories (D4); an in-app "Reduce motion" control (README §8 B names one, §2 places
none); self-hosted fonts through `next/font/local` (PR-24's permanent fix, its own small change); a guard for
durations and easings.
