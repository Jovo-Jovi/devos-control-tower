# TOWER — Session context

**Phase:** P04 (Owner controls and the neon map) · **Last verdict:** T20 PASS a2 · **Open carry-forwards:** CF-001…CF-011 except CF-005, CF-016, CF-017, CF-019, CF-020, CF-022, CF-023, CF-031, CF-033, CF-036, CF-037, CF-038, CF-039, CF-041

## Done steps

| Step | What | State |
|---|---|---|
| B0 | Bootstrap: method files copied from the pilot (`AUTOMATION.md` §11), the Tower's documents (brief, glossary, scope, decisions, data/security/boundary models, design direction, i18n/content models, `PHASES.md`, `devos/setup.json`), Tower ADR-001…004, fence T01, the two configuration deviations (`B0-BOOTSTRAP.md` §4) | committed by the owner (signs OD-01 to OD-06) |
| T01 | Skeleton: Next.js app, Supabase module, owner-only GitHub sign-in, header baseline, Tower ADRs | PASS a3 |
| T02 | Schema and OIDC-verified ingestion route with idempotency and usage storage | PASS a2 |
| T08 | Method fix: motion evidence for design v2 (filmstrip, reduced motion, layout shift) | PASS a2 |
| T03 | GitHub App webhook receiver: deliveries and observations (observed origin) | PASS a1 |
| T04 | Design v3 foundation: light and dark themes, theme switch, scene and planet, app shell, not-found page, sign-in on the v3 tokens | PASS a1 |
| T05 | Overview as the tower map: projects and link states, panels, list and phone views, register project, Tower-health banner | PASS a5 |
| T06 | Usage view: totals, by phase/task/attempt/agent/model/alias, coverage, failed attempts separate | PASS a2 |
| T07 | Project page: phases, run timeline by seq, origin labels and age, evidence links, verification | PASS a2 |
| T09 | Sign-in retrofit to design v2: first paint, redirecting, checking-access interstitial, shared mark, denied, error, signed out | PASS a2 |
| T10 | Pilot history export and import page; replay of 25 tasks labelled imported | PASS a1 |
| T11 | Design v3.1 art: the owner's backgrounds and planet in the scene | PASS a2 |
| T12 | Sharp globe: a per-pixel WebGL sphere on the 2048 strips replaces the displacement filter | PASS a1 |
| T13 | Theme switch on the sign-in pages | PASS a1 |
| T14 | Link preview | PASS a1 |
| T15 | Link requests data layer | PASS a1 |
| T16 | Link requests panel | PASS a3 |
| T17 | Link route and safeguards | PASS a1 |
| T18 | Disconnected projects and the whole flow | PASS a1 |
| T19 | Method fix: a task without its fence waits instead of failing; supervisor, request closing and planning notes | PASS a1 |
| T20 | Delete a registered project | PASS a2 |
| T21 | Collapsed link-request groups | built a1 — awaiting verdict |

## Next action

Review of T21 attempt 1, then the owner's merge; T22 follows.
