# TOWER — Phases and tasks

The runner reads the table below, and `guard:phases` checks it.

- **Done:** `[x]` only with a PASS verdict file. The runner ticks it (OD-03 §1 of the pilot, unchanged),
  never the builder.
- **Gate:** a value other than `—` means this task closes a station gate. Its PASS stops the cycle for
  the owner. Every risk-3 task stops the cycle too.
- **Verdict:** `PASS aN — <file>` or `FAIL aN — <file>`, written by the runner.
- **Plan labels:** rows are `Tnn` as the guard requires. The Tower's method fix (plan label TM01, "Tower
  reports its own events") is added by intake from a "Dev OS method fix" issue after T10, as a `Tnn` row
  with Phase `PM`, risk 3, gate `G-Method-<issue>`; later milestones' tasks are added by intake at their
  start. The mapping is kept in `plan/ID-MAP.md` of `devos-plan`.

| Task | Phase | Station | Name | Risk | Gate | Done | Verdict |
|---|---|---|---|---|---|---|---|
| T01 | P01 | J4 | Skeleton: Next.js app, Supabase module, owner-only GitHub sign-in, header baseline, Tower ADRs | 3 | G-Tower-Auth | [x] | PASS a3 — docs/reviews/T01-a3.md |
| T02 | P01 | J4 | Schema and OIDC-verified ingestion route with idempotency and usage storage | 3 | G-Tower-Ingest | [x] | PASS a2 — docs/reviews/T02-a2.md |
| T03 | P01 | J4 | GitHub App webhook receiver: deliveries and observations (observed origin) | 3 | G-Tower-Observe | [x] | PASS a1 — docs/reviews/T03-a1.md |
| T04 | P02 | J5 | Design v3 foundation: light and dark themes, theme switch, scene and planet, app shell, not-found page, sign-in on the v3 tokens | 2 | — | [ ] | — |
| T05 | P02 | J5 | Overview as the tower map: projects and link states, panels, list and phone views, register project, Tower-health banner | 2 | G-Design-v3 | [ ] | — |
| T06 | P02 | J5 | Usage view: totals, by phase/task/attempt/agent/model/alias, coverage, failed attempts separate | 2 | — | [ ] | — |
| T07 | P02 | J5 | Project page: phases, run timeline by seq, origin labels and age, evidence links, verification | 2 | — | [ ] | — |
| T08 | PM | M | Method fix: motion evidence for design v2 (filmstrips, reduced motion, layout shift) | 3 | G-Method-6 | [x] | PASS a2 — docs/reviews/T08-a2.md |
| T09 | P02 | J5 | Sign-in retrofit to design v2: first paint, redirecting, checking-access interstitial, shared mark, denied, error, signed out | 3 | G-Design-v2 | [ ] | — |
| T10 | P02 | J5 | Pilot history export and import page; replay of 25 tasks labelled imported | 2 | G-Tower-v1 | [ ] | — |

Phase P01 = Tower v1 foundation (sign-in, ingestion, observation). Phase P02 = Tower v1 pages. Both
belong to milestone M1 of `devos-plan`; the CK1 checkpoint between T02/PM01 and T03 is an owner gate
recorded in `docs/DEVELOPMENT_JOURNAL.md`, not a row.

Phase outlines (method track):

- **T08 (PM, issue #6, `docs/requests/issue-6.md`):** `scripts/devos/screens.mjs` captures, per state the
  fence's `- Screens:` line names and at 1280 and 390, the settled screenshot in normal motion, a five-frame
  motion filmstrip (0, 80, 160, 320, 640 ms after first paint or the named interaction), a reduced-motion
  screenshot and the layout-shift value, in `.devos/screens/motion.json`; the evidence pack and the reviewer
  prompt carry them (`docs/DESIGN_SYSTEM.md` §7). Runs before the open product tasks (PR-28); lands before T04.

## Phase outlines

- **Renumbered 2026-10-17 by the owner (issue #13, design v3).** T04 attempt 1 changed no file (the Cursor CLI
  lost its connection; run 39030193670). Old T04 "Portfolio, register project, Tower-health banner" is split into
  T04 (design v3 foundation) and a new T05 (the overview as the tower map, which takes over the portfolio,
  register page and health banner); the usage view moves T05 → T06, the project page T06 → T07, the history
  import T07 → T10 and keeps G-Tower-v1, so the milestone closes after the sign-in retrofit (T09). The design is
  `docs/design/v3/README.md`; the OD, `DESIGN_SYSTEM.md` v3 and the fences come from intake (#13). Where the
  outlines below say T05–T07, read T06, T07 and T10.
- **Design v3 (OD-08, issue #13, `docs/requests/issue-13.md`).** OD-08 supersedes, for T04–T07, T09 and T10, the
  "under design v2" bullets below: every fence from T04 on is written against `docs/DESIGN_SYSTEM.md` v3 and
  `docs/design/v3/`, with evidence in light **and** dark (§7: screenshots, first-paint and theme-switch filmstrips,
  reduced motion, layout shift 0, contrast). Until the runner can sign in (M3), each UI task's own Playwright spec
  captures the owner-only pages through `e2e/support/owner.ts` (created by T04).
- **T04 — Design v3 foundation (fence v2, `docs/fences/T04.md`).** Tokens §1 byte for byte (both themes); Inter +
  Geist Mono on `--font-inter`/`--font-geist-mono`; the `motion` dependency; `ThemeSwitch` (Auto · Light · Dark,
  nothing stored); `Scene` and `Planet` behind every page from the root layout, images bundled from
  `src/components/scene/assets/` (OD-08 §7); the shell (`AppSidebar` with Overview only, the glass top bar) and the
  `/` page head; a styled `not-found`; the sign-in card as glass on the scene (CSS only); the token contrast test;
  `e2e/support/owner.ts`; the realistic-art step with `scripts/scene/art.mjs` (OD-08 §8); the four carry-forwards of
  `docs/reviews/T03-a1.md` landed (ids from the live maximum: CF-011 + 4). No data, route or header change.
- **T05 — Overview as the tower map (gate G-Design-v3, risk 2).** README §4–§7 on `/`: the data layer the old T04
  fence v1 specified (`git show 1792346:docs/fences/T04.md`, S2–S3: pure `src/lib/portfolio/aggregate.ts` with `PortfolioProject`/`Portfolio`,
  `loadPortfolio()` through the owner's session, paged, `"unavailable"` on error; `requireOwner()` returns
  `githubId`; `GET /api/projects` → 200 `Portfolio` or 503, `no-store`) plus the README §6 fields (latest task and
  phase, execution from `runs.source`, tasks and phase passed of seen, link state, recent activity, ingestion
  health counts); the 30-second poll driving `LiveMark`; the tower, up to eight cards, blades by link state,
  ignition, live changes, detail panel, filters, the List view, the phone tower card, counts card, Tower panel,
  System overview, Recent activity, Ingestion health; every §7 state in both themes; `/projects/new` (the old
  T04 v1 S7 form and `registerProject` action) and the sidebar's Register project link; `HealthBanner` on a 503.
  The primitives it uses (`LiveMark`, `StatusChip`, `OriginChip`, `AgeText`, `FreshnessLabel`, `Counter`,
  `StateBlock`, `Toast`, `HealthBanner`). The fence keeps to a specification (PR-22) so the build fits the 72-minute
  budget. The owner signs G-Design-v3 by merging (OD-08 §9).
- **T06, T07, T10 against v3.** Their pages (`DESIGN_SYSTEM.md` §4.5) sit in the T04 shell on the scene, in both
  themes, and add to the sidebar only routes that exist.
- **T09 against v3 (OD-08 §5).** OD-07 §3–§4 unchanged in substance; the atmosphere is the scene and planet, the
  card is glass, every state in both themes; the gate test of OD-07 §6 applies to the v3 states. The reviewer who
  passes T07 reissues `docs/fences/T09.md` (v1 is written against v2 tokens).
- **T04–T07 under design v2 (OD-07 §1–§2; rows and ids unchanged).** The reviewer who writes each of these
  fences writes it against `docs/DESIGN_SYSTEM.md` v2, not the v1 specifications in `devos-plan`. T04's fence
  adds the v2 foundation to T04's scope: tokens §1 byte for byte in `src/styles/tokens.css` (values swapped
  under the existing names), Inter + Geist Mono via `next/font/google` in `src/app/layout.tsx`, the `motion`
  dependency, and the primitives T04 uses (`LiveMark`, `StatusChip` transition, `Counter`, FLIP list,
  `StateBlock` sheen, `Toast`, route View Transitions), plus sign-in screenshots at 1280 and 390 in the dark
  tokens. T05–T07 add the primitives they use. Until the §7 method fix lands, each UI fence names the
  filmstrip, reduced-motion and layout-shift files its own Playwright spec writes (OD-07 §5).
- **T09 — Sign-in retrofit to design v2 (OD-07 §3–§4, risk 3, gate G-Design-v2).** `DESIGN_SYSTEM.md` §4.1
  on `/sign-in` and its 403 denied state: atmosphere, card, display line, first-paint choreography, press →
  "Opening GitHub…", "Checking your access…" on a new `/auth/callback` page while the unchanged code exchange
  runs in the new route handler `GET /auth/confirm`, the product mark as a cross-document shared element into
  the header, denied nudge with "Use another account", error hairline with "Try again", signed-out crossfade;
  reduced-motion equivalents; CSS and View Transitions only. Evidence: settled, reduced-motion and filmstrip
  screenshots for five states at 1280 and 390, layout shift 0. Fence: `docs/fences/T09.md`.
