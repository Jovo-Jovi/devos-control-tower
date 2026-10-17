# TOWER — Phases and tasks

The runner reads the table below, and `guard:phases` checks it.

- **Done:** `[x]` only with a PASS verdict file. The runner ticks it (OD-03 §1 of the pilot, unchanged),
  never the builder.
- **Gate:** a value other than `—` means this task closes a station gate. Its PASS stops the cycle for
  the owner. Every risk-3 task stops the cycle too.
- **Verdict:** `PASS aN — <file>` or `FAIL aN — <file>`, written by the runner.
- **Plan labels:** rows are `Tnn` as the guard requires. The Tower's method fix (plan label TM01, "Tower
  reports its own events") is added by intake from a "Dev OS method fix" issue after T07, as a `Tnn` row
  with Phase `PM`, risk 3, gate `G-Method-<issue>`; later milestones' tasks are added by intake at their
  start. The mapping is kept in `plan/ID-MAP.md` of `devos-plan`.

| Task | Phase | Station | Name | Risk | Gate | Done | Verdict |
|---|---|---|---|---|---|---|---|
| T01 | P01 | J4 | Skeleton: Next.js app, Supabase module, owner-only GitHub sign-in, header baseline, Tower ADRs | 3 | G-Tower-Auth | [x] | PASS a3 — docs/reviews/T01-a3.md |
| T02 | P01 | J4 | Schema and OIDC-verified ingestion route with idempotency and usage storage | 3 | G-Tower-Ingest | [x] | PASS a2 — docs/reviews/T02-a2.md |
| T03 | P01 | J4 | GitHub App webhook receiver: deliveries and observations (observed origin) | 3 | G-Tower-Observe | [x] | PASS a1 — docs/reviews/T03-a1.md |
| T04 | P02 | J5 | Portfolio, register project, Tower-health banner | 2 | — | [ ] | — |
| T05 | P02 | J5 | Usage view: totals, by phase/task/attempt/agent/model/alias, coverage, failed attempts separate | 2 | — | [ ] | — |
| T06 | P02 | J5 | Project page: phases, run timeline by seq, origin labels and age, evidence links, verification | 2 | — | [ ] | — |
| T07 | P02 | J5 | Pilot history export and import page; replay of 25 tasks labelled imported | 2 | G-Tower-v1 | [ ] | — |
| T08 | PM | M | Method fix: motion evidence for design v2 (filmstrips, reduced motion, layout shift) | 3 | G-Method-6 | [x] | PASS a2 — docs/reviews/T08-a2.md |
| T09 | P02 | J5 | Sign-in retrofit to design v2: first paint, redirecting, checking-access interstitial, shared mark, denied, error, signed out | 3 | G-Design-v2 | [ ] | — |

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
