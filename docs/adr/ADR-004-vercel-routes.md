# ADR-004 — Vercel routes: Standard Deployment Protection, production-only machine routes, no bypass header

**Status:** Accepted, 2026-10-17 (Step-1 answer G8). Lands in `devos-control-tower/docs/adr/` by T01.
**Source:** `devos-plan` @ `1a3c2a9` — `plan/00-UNDERSTANDING.md` G8 and its answer, `plan/M1.md`
T01/T02 acceptance, pilot `PRECEDENTS.md` PR-15 (Vercel login page on protected URLs).

## Context

Vercel's Deployment Protection answers unauthenticated requests on protected URLs with its login page
(seen in the pilot, PR-15). Machine callers — the pilot's `report.mjs` with an OIDC token, GitHub's webhook
deliveries, the Tower's own reconcile workflow — cannot pass an SSO login. Vercel offers an automation bypass
header for that case; it is a shared long-lived secret that would have to live in the pilot's settings and
in GitHub's webhook configuration, which contradicts "no stored reusable credential". The production domain
is not protected by Standard protection, so the application itself must refuse everything unauthenticated.

## Decision

- Deployment Protection = **Standard** on the Vercel project (previews and non-production URLs protected).
  Verified by name in T01's acceptance; never "Only preview" or disabled.
- **No automation bypass header in the Tower**: `rg -n -i "protection-bypass|AUTOMATION_BYPASS"` in the
  Tower repository returns nothing — no header, no `VERCEL_AUTOMATION_BYPASS_SECRET` name, in code,
  workflows, guards or `setup.json` (acceptance line in T01, repeated by the Tower's `guard:secrets` pattern
  list). **Scope note (verified 2026-10-17):** the pilot's `doctor.mjs`, `devos-cycle`, `devos-deploy`,
  `devos-doctor` and `devos-setup` use `VERCEL_AUTOMATION_BYPASS_SECRET` to probe the *pilot's own* protected
  previews; that stays as it is and is out of this ADR's scope. The rule here is that nothing ever reaches a
  **Tower** route by bypass: Tower machine routes are production-only (below), and no reporting project
  ever needs a Tower bypass secret.
- Machine routes — `/api/ingest` (T02), `/api/github/webhook` (T03), `/api/github/reconcile` (M5) — answer
  **only on the production host**: `VERCEL_ENV === 'production'` and the request `Host` equals the host of
  `TOWER_URL`; otherwise `404`. A preview deployment therefore refuses them twice: Vercel's login page and,
  if ever reached, the host check.
- Dashboard pages and read APIs are protected at the application level by the owner gate (ADR-002): `/` →
  `302` to sign-in, `/api/*` → `401` without a session. Nothing is served to an anonymous request.
- `TOWER_URL` is the production URL and is also the OIDC audience (pilot ADR-005). A custom domain later is a
  new audience: a coordinated change in the Tower (`TOWER_URL`) and in every reporting project
  (`tower.url`), announced in the contract's change log.
- Screenshots during `devos-cycle` keep the pilot's behaviour: `screens.mjs` detects the Vercel login on a
  protected preview and falls back to the local server (no bypass).

## Consequences

- T02's acceptance includes: `POST /api/ingest` on a preview URL → refused; on production without a token →
  `401`; with a valid token → `200`.
- A production incident on the Tower never exposes an unauthenticated page: the application gate does not
  depend on Vercel's protection.
- The M3 fixture switch (`DEVOS_SCREENS=1`) follows the same line: it is allowed on previews and local
  servers, fails a production build, and the deploy smoke step probes the production domain for the fixture
  marker (`plan/M3.md` PM08).
