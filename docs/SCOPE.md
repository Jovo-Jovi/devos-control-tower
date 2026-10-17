# TOWER — Scope

Precedence 2, with `DECISIONS.md`. Derived from OD-01 to OD-06 and `plan/M1.md` (there is no
quotation: the Tower has one owner and no price).

## 1. Scope as signed (baseline, M1 — Tower v1 observing the pilot)

| # | Deliverable | Station | Task |
|---|---|---|---|
| S-1 | Skeleton: Next.js app, Supabase module, owner-only GitHub sign-in (`auth.identities` claim path, `public.is_owner()`, RLS owner-only), header baseline, Tower ADR-001…004, Standard Deployment Protection, sign-in page with signed-out / denied / error states | J4 | T01 |
| S-2 | Schema (`projects`, `runs`, `events`, `event_usage`, `event_rejections`) and `POST /api/ingest`: production host only, OIDC-verified, idempotent, contract answers exactly as §8 | J4 | T02 |
| S-3 | GitHub App webhook receiver: HMAC check, `webhook_deliveries`, `observations` — origin **observed** | J4 | T03 |
| S-4 | Portfolio `/`, `/projects/new`, Tower-health banner; states loading / empty / error / stale | J5 | T04 |
| S-5 | Usage view `/projects/[key]/usage`: totals; by phase / task / attempt / agent / model / account alias; coverage per agent; failed attempts separate | J5 | T05 |
| S-6 | Project page `/projects/[key]`: phases and tasks, run timeline by `seq`, origin labels reported / observed / verified / imported with age, evidence links | J5 | T06 |
| S-7 | Pilot history export (`scripts/tower/export-history.mjs`) and import page `/projects/[key]/import`; replay of the pilot's 25 tasks labelled **imported** | J5 | T07 |

The Tower reporting its own events (plan label TM01) is a method fix planned from a "Dev OS method fix"
issue after T07 (Phase `PM`, PR-28); it is in scope of M1 and outside this table because intake assigns
its id (`plan/ID-MAP.md`).

## 2. Out of scope

A second user or viewer; any public page; local ingest keys and `devos connect` (M2); the mechanical
design gate (M3 — in M1 the owner reviews by hand at 1280 and 390); automatic project discovery, other
owners' projects, consent, the scope panel (M5); anonymous pings or manifest search (decision 4, not
taken); cost figures or estimated usage (v1 shows measured numbers or `unavailable`); charts that imply
values the data lacks; any change to the pilot's `main` from this repository; the Vercel automation
bypass header in any form; reading `user_metadata`, `raw_user_meta_data` or `app_metadata`. Anything
else is out of scope until an OD adds it.

## 3. Amendments

| # | Amendment | Decision | Tasks |
|---|---|---|---|
| A-1 (M2) | Ingest keys: `/projects/[key]/keys` owner page — issue (shown once, stored hashed), revoke; key path in `/api/ingest` (`source = local`) | OD to be drafted at M2 intake | plan label T08 |
| A-2 (M3) | The Tower adopts the pilot's mechanical design gate (plan label TM02) and a retro-review of every page under it | OD at M3 intake | plan labels TM02, T09 |
| A-3 (M5) | Discovery: App repo list, manifest detection, classes, consented connect, scope panel, §E scenarios as e2e; conditional telemetry only if decision 4 (b)/(c) | OD at M5 intake | plan labels T10–T14 |
| A-4 (M1) | Design system v2 built: the v2 foundation (tokens §1, Inter + Geist Mono, `motion`, the primitives T04 uses) inside T04's scope; further primitives in T05–T07, whose fences follow v2; the sign-in retrofit `DESIGN_SYSTEM.md` §4.1 with the "Checking your access…" interstitial (`/auth/callback` page, `/auth/confirm` route) | OD-07 (DRAFT, issue #5), amends OD-06 A1 §4 | T04–T07 (rows unchanged), T08 |

Amendments are written by intake when their milestone starts; the plan labels map to repository ids in
`plan/ID-MAP.md`.

## 4. Delivered scope

Filled at the end of M1 (gate `G-Tower-v1`) from `node scripts/inventory.mjs` — routes, components,
tables, guards, tests — with one row per S-item and its verdict file.
