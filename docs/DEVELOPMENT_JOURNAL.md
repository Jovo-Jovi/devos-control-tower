# TOWER — Development journal

Append-only. Newest entry last. One entry per task attempt, written by the builder; the reviewer's
verdicts live in `docs/reviews/`. Owner gates (CK1, G-Tower-v1) are recorded here by the owner.

---

## 2026-10-17 — B0 bootstrap (planner, Claude)

Tower-first order (decision 3b). Repository created from the pilot's `docs/method/AUTOMATION.md` §11 copy
list, method files unchanged; two configuration deviations recorded (`guard:i18n` one catalogue,
`guard:design` host allow-list for the GitHub origins). Documents written from `devos-plan`
(`seed/00-SEED.md`, `seed/05-decisions.md`, `seed/06-event-contract.md`, the seven ADRs, `plan/M1.md`):
brief, glossary, scope (S-1…S-7 = T01–T07), decisions OD-01…OD-06, data model (owner allow-list,
`is_owner()`, events with idempotency and `event_usage`, observations), security model (names only,
header baseline in T01 as an assumption), boundary model (Profile A, `owner` zone = the whole app),
design direction v1 "Control-room ledger", one-locale i18n model (assumption), content model, `PHASES.md`
with T01–T07, `devos/setup.json` by name. Fence T01 issued. The Tower's own reporting (TM01) follows
PM02 as a Phase `PM` method fix. Awaiting the owner's bootstrap push.

## 2026-10-17 — B0 GitHub App

GitHub App `devos-control-tower`, App ID **5353448**, owned by `Jovo-Jovi`. Installed on
`devos-pilot` and `devos-control-tower` only. Webhook
`https://devos-control-tower.vercel.app/api/github/webhook`, inactive until T03. Read permissions:
Actions, Checks, Commit statuses, Pull requests, Metadata. Subscribed events: `workflow_run`,
`check_run`, `status`, `pull_request`. GitHub delivers `installation` and `installation_repositories`
without a subscription checkbox. Repository variable `DEVOS_GITHUB_APP` = `true`.

App private key: none (generate only when M5 needs it).

Webhook secret: rotate when T03 activates the webhook.

Supabase sign-in uses the GitHub OAuth App `Ov23liYbG8WQ9sQogaTF`. It does not use the GitHub App
client id.

## 2026-10-17 — B0 bootstrap (execution)

Owner choices recorded before the bootstrap commit:

- The repository is **public**. The GitHub plan is Free, which provides branch protection on a public
  repository. The runbook's private repository was not used.
- `CLAUDE.md` and the builder rules for vocabulary and the single locale `en` name this repository.
  Method files otherwise stay the pilot's at `4ccbef7`.
- Supabase organisation `TOWER-DEV_OS` (`xfppwbpmzvaawosdcocx`), Free plan. Project
  `devos-control-tower`, ref `mbaetiooevqnqaxzxrcl`, region `eu-central-1`.
- Vercel project `devos-control-tower` (`prj_TCgrqbxOENdxzIjWfK8z8nxzdi7T`), team
  `team_axcyEdkIz5RpW3pHt9gtuWuq`, region `fra1`, hostname `devos-control-tower.vercel.app`.
  No Git link at B0. Deployment Protection is Standard. Protection Bypass entries: 0.
- The pilot's own Supabase project is paused: restore it (free plan: within 90 days) or set the
  pilot's repository variable `DEVOS_SUPABASE=false` before PM01 merges, or the pilot deploy fails.

## 2026-10-17 — T01 skeleton (builder, attempt 1)

Next.js 16.4.2 app shell with the Supabase module: `owner_allowlist` (RLS on, no policy, no grants
to `anon` or `authenticated`) and `public.is_owner()` (`security definer`, empty `search_path`),
proven by pgTAP including fixture identities `424242` (false, then true once the row exists) and
`999` (false). GitHub is the only enabled auth provider; email sign-up is off. Sign-in has the three
states; the denied state is HTTP 403 via `forbidden()`. The header baseline is on every route, with
a per-request CSP nonce. `/` redirects an anonymous request to `/sign-in`; `/api/projects` answers
401 without a session. No product tables, webhook, or portfolio. Awaiting the verdict and
G-Tower-Auth.

## 2026-10-17 — T01 skeleton (builder, attempt 2)

Reissue. Sign-out `POST` answers 303 through `NextResponse.redirect`. An anonymous request to any page except `/sign-in`, the auth routes, `/api/`, `/_next/` and `/favicon.ico` is `302 /sign-in`. Production `style-src` is `'self'` and the per-request nonce. The focus offset is `calc(var(--space-1) / 2)`. `DocumentLocale` is removed.

S3 halts. `forbidden()` before streaming, including a static page whose only call is `forbidden()`, is HTTP 403 on Next's `<html id="__next_error__">`, which has no `lang` or `dir`. The root layout's `lang` and `dir` are in the Flight payload. `<Suspense>` around the check keeps those attributes and answers 200. `await connection()` in the root layout is not what strips them. No documented path yields both the 403 and the document locale.

## 2026-10-17 — T01 skeleton (builder, attempt 3)

Reissue after `docs/reviews/T01-a2.md`. The 403 stays on Next's error shell. `signIn.denied` is now the design-system sentence. The request test checks that sentence on the 403 body, and checks `lang="en" dir="ltr"` in the server HTML of `/sign-in` and `/sign-in?reason=auth_error`. The browser test checks `lang="en"` and `dir="ltr"` on all three states. The scaffold, the proxy, sign-out, the root layout and the Supabase module are unchanged. Awaiting the verdict and G-Tower-Auth.

## 2026-10-17 — Pilot leftovers removed (owner request)

Method files copied at B0 still pointed at the pilot's product. Fixed on `main` by the owner's
session (no behaviour of the method changed beyond these targets):

- `devos-deploy.yml` smoke test probes `vars.TOWER_URL` at `/` (generated URLs sit behind Vercel
  Authentication; no bypass secret, ADR-004). Repository variable `TOWER_URL` is the owner's to set.
- `scripts/devos/screens.mjs` takes default pages from `devos.config.json` `screens.pages`
  (`/sign-in`, `/`) instead of the pilot's `/ar /en /ar/notices /en/notices`.
- `scripts/devos/doctor.mjs` probes `/` and reports a preview behind the Vercel login as expected
  (info), no longer asking for a bypass secret; `render-prompt.mjs` preview hint likewise.
- `scripts/guards/naming.mjs`: the pilot's `notices` route exception removed.
- Builder rule `10-security-data` and skill `devos-compose-ui`: the pilot's library/content and
  bilingual-state wording replaced by the Tower's (no contact data; states loading, empty, error,
  stale, offline). `CLAUDE.md`: preview probe and data-integrity lines.

Kept on purpose: the inactive R2 and Firebase module code and rules (they switch on only when their
files exist; the engine stays byte-close to the pilot for M4 `upgrade`), and the method handbook's
NEL history. `pnpm guards` after the change: all PASS.

## 2026-10-17 — T02 schema and ingestion (builder, attempt 2)

Reissue after `docs/reviews/T02-a1.md`. The a1 migration, down file and seed are unchanged. Generated
types, the contract parser, OIDC verification (`jose@6.2.12`), `POST /api/ingest`, the `/api/ingest`
proxy exemption, pgTAP, unit and e2e tests, and carry-forwards CF-001…CF-007. Awaiting the verdict
and G-Tower-Ingest.

## 2026-10-17 — T08 motion evidence (builder, attempt 2)

Reissue after `docs/reviews/T08-a1.md` (fence defect: Node 22 was not first on PATH). `screens.mjs`
captures, per state and width, a settled screenshot in normal motion, a five-frame filmstrip from a
CDP screencast, a reduced-motion screenshot and the layout-shift value, and writes
`.devos/screens/motion.json`. The evidence pack and the reviewer prompt summarise it. Precedent
PR-35. Awaiting the verdict and G-Method-6.

## 2026-10-17 — T03 GitHub App webhook receiver (builder, attempt 1)

`POST /api/github/webhook` checks the production host, verifies `X-Hub-Signature-256` with HMAC-SHA256
on the raw body, and stores one `webhook_deliveries` row and one `observations` row for a registered
repository. Unknown events, unregistered repositories and redeliveries answer 202 and store nothing.
The conclusion is folded into `state` (DATA_MODEL §2.8). Carry-forwards CF-008…CF-011 landed from
T02's review. Awaiting the verdict and G-Tower-Observe.

## 2026-10-17 — Runner: hung builder watchdog (owner-requested fix)

T04 attempt 1 (run 39030193670) changed no file in 80 minutes: at minute 13 the Cursor CLI printed
"Connection lost, reconnecting … Retry attempt 1" and never returned. The step hit its 80-minute
timeout, so the job skipped the commit, the PR and the park/halt comment, and nothing visible
happened. `scripts/devos/agent-watchdog.sh` now runs the CLI with a 72-minute budget and a stall check
(a lost connection that is still the CLI's last line and no change to the tree or its output for 10
minutes). A stall is restarted once in place; a second stall, or one too late to restart, ends with a
`devos-stall:` line that `builder-status.mjs` parks like a usage limit (resume after
`resume.stall_wait_minutes`, default 10). A spent budget halts with a PR comment as before. T04 was
not re-dispatched: the design v3 change request (#13) rewrites it first.

## 2026-10-17 — Ledger renumbered for design v3 (owner session, issue #13)

The owner chose layout (a) of the intake's question on #13: T04 becomes the design v3 foundation, a new
T05 the overview as the tower map (gate G-Design-v3), the usage view T05 → T06, the project page T06 →
T07, the history import T07 → T10 with G-Tower-v1, after the T09 sign-in retrofit. Forward references in
SCOPE, DATA_MODEL, CONTENT_MODEL, the event contract, README and SETUP follow the new ids; signed
decisions, requests, reviews and earlier fences keep their wording (history). `docs/fences/T04.md` is the
old scope's v1 fence until intake reissues it; nothing dispatches T04 before then.

## 2026-10-17 — T04 design v3 foundation (builder, attempt 1)

Light and dark themes from `DESIGN_SYSTEM.md` §1, a theme switch that only sets `data-theme` on `<html>`,
the scene and planet behind the app shell, a styled not-found page, and sign-in on the v3 tokens.
Catalogue grew from 14 keys to 27. `motion` 14.3.0 is installed and not imported. Scene images stay the
baseline art (722875 bytes); generation was outside the time box. Carry-forwards CF-012…CF-015 landed
from T03's review; CF-005, CF-013, CF-014 and CF-015 are closed. Awaiting the verdict.

## 2026-10-17 — Runner: long builds continue in time slices; live progress; stuck detection (owner request)

T05 attempt 1 used the whole 72-minute budget while still writing files and halted, which needed a
manual `/devos revise`. The owner asked for long sessions to keep going without a halt while still
proving they are not stuck. Now:
- **Time slices.** A slice that ends while the builder is still changing files is committed with
  "(time slice k)" and the same attempt continues in a fresh run from the branch (`builder-status.mjs`
  → `continue`, the park step dispatches it), up to `builder.max_time_slices` (4, about 4 h 48 min). A
  slice that changed nothing, or the last slice, halts with the reason and the `/devos revise` path.
- **Stuck detection.** Nothing changing at all (tree, CLI output) for `builder.idle_stop_minutes` (30)
  is "stuck" (`devos-stuck:`, exit 126): restarted once, then halted. The lost-connection stall
  (exit 125) keeps its restart-then-park path.
- **Live progress.** `scripts/devos/progress.sh` keeps one comment per run on the "Dev OS: run notices"
  issue up to date every 5 minutes: working / quiet / finished / slice used / stuck, minutes, files
  changed, a link to the run. Its token is removed from the agent's environment by the watchdog.

## 2026-10-17 — Runner: a merge conflict at push time no longer loses the build

T05 attempt 2 finished its build (68 min, 26 files) but the push failed: main had gained journal
entries during the run (the owner-session runner fixes) and the builder's own journal entry conflicted
with them in `sync-main.sh`. The runner's checkout was discarded, and the build with it. Now
`docs/DEVELOPMENT_JOURNAL.md` merges by union (`.gitattributes`), so two appended entries never
conflict, and any other conflict first pushes the run's unmerged work to `rescue/<branch>-<run id>`.

## 2026-10-17 — T05 Overview as the tower map (attempts 1 and 2)

Attempt 1 (`1f76c4a`) landed the portfolio aggregate, the owner read of projects, `GET /api/projects`,
the register action, the map pieces and the 93-key catalogue, then ran out of budget with no report.
Attempt 2 kept that work and added the missing styles, the shell (poll status, Overview and Register
project links, view transitions, the live mark), the overview page, the register page, seven overview
tests, and the scene fixed to the viewport (`position: fixed`, `100lvh`). Playwright's Chromium was
installed once so `pnpm e2e` could launch. CF-016 is open for the human at G-Design-v3: ignition of
eight blades is 1 210 ms, against the 740 ms first-paint cap. Awaiting the verdict, then the owner's gate.

## 2026-10-17 — T05 Overview as the tower map (attempt 3)

Attempt 3 kept the attempt-2 tree and changed only what `docs/reviews/T05-a2.md` failed. The Tower
panel stays inside its box, skeletons share the card slots and appear in the phone list, glass uses
the backdrop blur with a solid fallback, bars and the ring move by stroke offset, and counts go
through `Intl.NumberFormat`. Particles are absent under reduced motion, route motion runs only on
navigation, and a failed registration puts the trimmed values back in the fields. Settled and reduced
captures are full page. `syntheticPortfolio` is produced by `aggregatePortfolio`. CF-017 is open for
the human: the 30 s poll reads every event, run and usage row. Playwright's Chromium was installed
once in this environment so `pnpm e2e` could launch. Awaiting the verdict, then the owner's gate
G-Design-v3.
## 2026-10-17 — Runner: the Dev OS supervisor (owner request)

The owner asked for the workflow to repair itself and only ask for approvals. `devos-supervisor.yml`
runs after every Dev OS workflow, every 30 minutes and on `/devos approve|reject <id>`;
`scripts/devos/supervisor.mjs` finds stopped or stalled work, explains it with fixed rules (Claude
Opus, read-only, only when none fits), fixes what is safe on its own within a per-cause limit, and
turns everything else into something the owner approves (a method-fix issue, a change request, a
proposed revision, or setup steps). Reports go to the "Dev OS: supervisor" issue. On today's
incidents, the rules read T04 a1 (hung builder) and T05 a2 (push conflict) as "re-dispatch", which
is what was done by hand. `scripts/devos/rescue.sh` recovers a rescue branch onto its task branch.

## 2026-10-17 — T05 Overview as the tower map (attempt 4)

Attempt 4 kept the attempt-3 tree and changed only what `docs/reviews/T05-a3.md` failed. The bar's
SVG sits absolutely in its track, so it no longer forces the labels onto two lines, and each map
card stays inside its slot. BRAVO's fixture carries a half fill (1 of 2). The attempt-3 layout-shift
paste now includes the three keys it lacked. Awaiting the verdict, then the owner's gate G-Design-v3.

## 2026-10-18 — T05 Overview as the tower map (attempt 5)

Attempt 5 kept the attempt-4 tree and changed only defect (B) of `docs/reviews/T05-a4.md`. The bar SVG
keeps `position: absolute` and `inset: 0`, and also takes `inline-size: 100%` and `block-size: 100%`,
so the fill covers the track's full height. Test 3 checks that box at 1280 and 800, and that BRAVO's
stroke is hit at the top and bottom of its first track. Playwright's Chromium was installed once in
this environment so `pnpm e2e` could launch. Awaiting the verdict, then the owner's gate G-Design-v3.

## 2026-10-18 — T06 Usage view (attempt 1)

`/projects/[key]/usage` reads one project's attempts through the owner's session and the view
`usage_by_attempt` (`security_invoker`). Coverage comes first, then totals by agent and by model,
then attempts, with failed attempts in their own table. A null number is an em dash. The seed adds
`USAGE` and `QUIET`; `USAGE` events are moved two hours earlier so `FIXTURE` stays newest.
CF-018…CF-021 are open from the T05 a5 carry-forwards, and CF-011 and CF-012 now land at T07.
Playwright's Chromium was installed once so `pnpm e2e` could launch. The attempt halts on Done-when
D5: `supabase gen types` quotes `"usage_by_attempt"`, so the fence's unquoted search cannot print 1
and still match a fresh generation. Awaiting the reviewer's ruling on that check. A PASS, if the
reviewer gives one, waits for the human (schema change).

## 2026-10-18 — T06 Usage view (attempt 2)

Attempt 2 keeps the attempt-1 tree. The corrected D5 pattern matches the generated
`"usage_by_attempt"` key once, and a fresh `supabase gen types` matches the committed file. The
usage head renders `AgeText` only when `lastContactAt` is not null, so QUIET shows "No contact yet"
once, from `FreshnessLabel`. The task-group header spans all ten columns. Awaiting the verdict. A
PASS waits for the human (schema change).

## 2026-10-18 — T07 Project page (attempt 1)

`/projects/[key]` shows phases and tasks, each run's step events in `seq` order, and what GitHub
observed. `verify_reported_events` is the only writer of `verified`: it runs inside `ingest_event` and
after a matching status observation. A disagreeing state, a non-result step, a different commit, a
`waiting` gate and an import all stay as stored. The seed adds `TRACE` and moves its runs back so
`FIXTURE` stays the newest project on the map. CF-018 is closed, CF-012 is accepted, and CF-009 and
CF-011 are retargeted. Playwright's Chromium was installed once so `pnpm e2e` could launch. Awaiting
the verdict. A PASS waits for the human (schema change).

## 2026-10-18 — T07 Project page (attempt 2)

Attempt 2 keeps the attempt-1 tree. The rail and the evidence underline scale from
`transform-origin: 0 0`, so the computed origin begins at the inline start. The project head is
capped with the planet tokens so its box ends before the globe wherever the two share vertical
space; below 40rem the head sits under the scaled globe and keeps the column width. Each task
row passes `still` to `StatusChip`, so a past `started` does not breathe in the rail. Awaiting
the verdict. A PASS waits for the human (schema change).

## 2026-10-18 — T09 Sign-in retrofit (attempt 1)

The sign-in card on the v3 scene gains v2's states: first paint, "Opening GitHub…", "Checking your
access…" at `/auth/callback` while the unchanged code exchange runs at `/auth/confirm`, the shared
product mark, the denied nudge, the error hairline and the signed-out crossfade. Owner-only access,
the claim path and the headers stay. CF-021 is closed with the layout-shift sources files. CF-022
is open for the human: Next's router payload carries the request URL. Playwright's Chromium was
installed once so `pnpm e2e` could launch. Awaiting the verdict. A PASS stops at gate G-Design-v2
for the owner.

## 2026-10-18 — T09 Sign-in retrofit (attempt 2)

Attempt 2 keeps the attempt-1 tree. The error hairline sits inset on the card's top edge, and the
checking hairline has a track. The success film was a blank canvas because the capture paused the
view-transition snapshots before Chromium had painted them; the new page was already in the document.
The film now waits for those frames, then seeks. Every transition frame shows the page. Awaiting the
verdict. A PASS stops at gate G-Design-v2 for the owner.

## 2026-10-19 — T10 Pilot history export and import page (attempt 1)

The history export reads `docs/PHASES.md` and `docs/reviews/` through read-only git and writes
contract events. The owner imports that file at `/projects/[key]/import`. One invalid line refuses
the upload and names the line, and a refused file is not stored. Stored events go through
`ingest_event` with source `import`, so each one is labelled imported. The import spec runs after
the other end-to-end specs. Its captures cover idle, uploading, result and error in both themes.
Playwright's Chromium was installed once so `pnpm e2e` could launch. Awaiting the verdict. A PASS
stops at gate G-Tower-v1 for the owner.

## 2026-10-19 — T11 Design v3.1 art (attempts 1 and 2)

Attempt 1 built S1–S6 and halted on a fence defect: the geometry comment contained a word D6 item 1
rejects, and `.crimsonMask` had a one-value `mask-size`, so the crimson disc did not cover the globe
in dark. Attempt 2 fixed the comment and the mask size, then did the guide and the ledgers. Awaiting
the verdict. A PASS stops at gate G-Design-v3.1 for the owner.

## 2026-10-22 — T12 Sharp globe (attempt 1)

The displacement filter and the 340×340 sphere map are gone. Each globe is a canvas that samples the
2048×1024 strip per device pixel on an orthographic sphere. `PlanetGlobe` takes WebGL 1 when that
context exists: a frame loop while motion is allowed, and one draw per change when reduced motion, a
hidden pause or a hidden document asks for a still globe. When WebGL is missing it draws the same
sphere on a 2D canvas, still. Until the first draw, the flat strip stays as the poster. The 120 s spin
and the theme-switch half-turn stay on the CSS wrappers; the canvas reads their `translateX`. A lost
WebGL context drops the drawn frame and rebuilds on restore. Evidence from the shell spec's Sharp
globe test is `.devos/screens/planet-*.png` (the page, the slot, reduced motion, no WebGL, and the
roll frames `planet-roll-0000.png` through `planet-roll-1800.png`) and `planet-layout-shift.json`.
Awaiting the verdict. A PASS stops at gate G-Planet-Sharp for the owner.

## 2026-10-22 — T13 Theme switch on sign-in (attempt 1)

The existing ThemeSwitch sits at the foot of every sign-in state, outside the card. Auto, Light and Dark set `data-theme` on the open document only; a reload returns to Auto, and nothing is stored. The card, the scene and the switch's own code are unchanged. Evidence is `e2e/sign-in.spec.ts` test `Theme switch on sign-in` and `.devos/screens/t13-*.png` (signed-out, denied and error, in light and dark, at 1280 and 390). Playwright's Chromium was installed once so `pnpm e2e` could launch. Awaiting the verdict.

## 2026-10-22 — T14 Link preview (attempt 1)

Every page's head now carries an Open Graph website card and a Twitter summary-large-image card. The image is a 1200×630 JPEG captured from the production build's `/sign-in` in the dark theme with reduced motion, by `scripts/site/link-preview.mjs`. It is imported by the root layout and served from `/_next/static/media/`. Absolute URLs use `TOWER_URL` when that value is an http or https URL. The proxy, headers and routes are unchanged. Awaiting the verdict. A PASS stops at gate G-Link-Preview for the owner.
