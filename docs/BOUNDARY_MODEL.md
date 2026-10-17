# TOWER — Boundary model (non-waivable, OD-01 §3)

Precedence 4.

<!-- devos:boundary {"profile":"A","zones":[{"name":"owner","src":["src/app/**","src/lib/supabase/**","src/proxy.ts"],"urls":["/"],"personal_data":false}]} -->

The line above is read by `guard:boundary` (PR-19) exactly as in the pilot. Only a signed OD changes it.
The Tower has **no public page**: the whole application is the `owner` zone, declared by OD-01 §2. Inside
it, forms, the owner's session cookie and route handlers are allowed; analytics, trackers and
third-party scripts are **never** allowed, zone or not.

## 1. The rule

Nothing in the Tower accepts, stores or sends a member of the public's data. The Tower holds the owner's
GitHub numeric id (one row), events and observations about repositories, and — in observations — an
actor login only when it is the owner or a bot. Visitors do not exist as a concept: an anonymous request
is sent to sign-in or refused.

## 2. What is forbidden in `src/**` even inside the zone

- any analytics or tracking package (PostHog, GA, Sentry browser SDK, Plausible, Mixpanel, Segment),
  `navigator.sendBeacon`, any `<script src="https://…">` in built HTML
- any `fetch` from the browser to a host other than this origin and the Supabase Auth host
- reading `user_metadata`, `raw_user_meta_data` or `app_metadata` (ADR-002)
- logging a request body, a token, a key or a JWT claim
- storing an event body that was refused (only `event_rejections.reason` and `received_at`)
- the Vercel automation bypass header or its secret name (ADR-004)

The Tower's own Supabase project and the GitHub API (server-side, for the App) are not third parties.

## 3. Evidence at every gate

`pnpm guards` output with `boundary: PASS` and `secrets: PASS`; the reviewer's own scan of the built HTML
for third-party scripts and beacons, stated with the command; from T02 on, `curl -sI
https://<TOWER_URL>/api/ingest` shows no `set-cookie` (machine routes never start a session); `rg -n
"user_metadata|raw_user_meta_data|app_metadata" src/ supabase/` → nothing.

## 4. Zones

### `owner` (OD-01 §2): the whole application

| | |
|---|---|
| Source | `src/app/**`, `src/lib/supabase/**`, `src/proxy.ts` |
| URLs | every page and API under `/` |
| Who | the owner only (`DATA_MODEL.md` §1, §6); the two machine routes accept machines authenticated by OIDC, ingest key or HMAC and start no session |
| Personal data | **none from the public**. The owner's identity lives in Supabase Auth's `auth` schema; `public` holds the allow-list row and bot/owner logins in observations |
| Allowed inside | forms (`/projects/new`, `/projects/[key]/import`, M2 `/projects/[key]/keys`), server actions, the Supabase Auth session cookie, route handlers (`/api/ingest`, `/api/github/webhook`, `/api/projects`, M5 `/api/github/reconcile`) |
| Never allowed, even inside | analytics, trackers, third-party scripts, beacons, browser storage of anything but the Auth helper's own cookie, logging bodies or credentials, a browser call to Supabase beyond the Auth redirect |
| Proof | `guard:boundary` (zone-aware), `guard:data`, `guard:secrets`, the pgTAP RLS tests, the reviewer's no-`set-cookie` check on the machine routes |

A zone with personal data from the public would need a new OD, `docs/PROTECTION_MODEL.md` and the
Personal-Data Protection gate (handbook §10.3). Viewer access for other people (`PROPOSALS.md` P-04) is
such a change and is not in M1.
