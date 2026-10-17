# TOWER — Security model

Precedence 3. Settings are named here and checked by name in `devos/setup.json`; no value appears in
this repository.

## 1. Principals and keys

| Principal | Credential | Where it lives | Who reads it |
|---|---|---|---|
| Owner (browser) | Supabase Auth session (GitHub provider) — cookie set by the Auth helper on this origin only | the browser | `src/lib/supabase/server/session.ts` |
| Server (user path) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel env (all environments) | client and session helpers |
| Server (machine path) | `SUPABASE_SECRET_KEY` (service role) | Vercel env **Production**, Sensitive; CI uses the local stack | `src/lib/supabase/server/admin.ts` only |
| GitHub Actions run of a registered project | OIDC JWT, `aud = TOWER_URL`, `iss = https://token.actions.githubusercontent.com` | minted per job, never stored | `/api/ingest` (pilot ADR-005) |
| Local runner (M2) | per-project ingest key, write-only, hashed at rest | the owner's OS keychain | `/api/ingest` |
| GitHub App `devos-control-tower` | `GITHUB_WEBHOOK_SECRET` (HMAC-SHA256 of the body) | Vercel env Production, Sensitive; the App's settings | `/api/github/webhook` (Tower ADR-003) |
| Deploy | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `DEVOS_BACKUP_PASSPHRASE` | GitHub repository secrets | `devos-deploy` only |
| Method fix that changes a workflow | `DEVOS_PAT` — a separate fine-grained token for **this** repository (pilot ADR-006 conditions) | GitHub repository secret | the runner's push step only |
| Builder / reviewer | `CURSOR_API_KEY[_2]`, `CLAUDE_CODE_OAUTH_TOKEN[_2]` or `ANTHROPIC_API_KEY[_2]` | GitHub repository secrets | `devos-cycle` |

Never present: `VERCEL_AUTOMATION_BYPASS_SECRET` (ADR-004), the owner's GitHub id as a secret or
variable (it is a database row), the pilot's tokens, any token in `report.mjs`.

## 2. Header baseline (T01, part of the skeleton) — **Assumption**

The pilot made headers their own risk-3 task (pilot T02). The Tower's skeleton carries the same baseline
from T01, because every page is behind sign-in from the first deploy; the owner confirms by merging T01.

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-<per request>'; style-src 'self'; img-src 'self' data: https://avatars.githubusercontent.com; connect-src 'self' https://<SUPABASE_URL host>; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://<SUPABASE_URL host>` (the Supabase host comes from the env at build time, never a literal) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `X-Frame-Options` | `DENY` |
| `Cache-Control` on pages | `private, no-store` (every page is owner data) |

Machine routes answer `application/json` with `Cache-Control: no-store` and no CSP (nothing renders).

## 3. Routes and their checks, in order

| Route | Auth | Order of checks | Answers |
|---|---|---|---|
| `/` and every page | owner session | 1 session? else `302 /sign-in` · 2 `select public.is_owner()` true? else sign out + `403` page | HTML |
| `/api/projects`, read APIs | owner session | as pages, but `401` without a session, `403` for a non-owner | JSON |
| `POST /api/ingest` (T02) | OIDC (CI) · ingest key (M2) | 1 production host (`VERCEL_ENV === 'production'` and `Host` = host of `TOWER_URL`) else `404` · 2 `Content-Length`/body ≤ 2 048 bytes else `413` · 3 schema (incl. the `usage` rule) else `400 schema` · 4 bearer: JWT → JWKS of the issuer, `iss`, `aud = TOWER_URL`, signature, `exp`; claim `repository` = a registered project's `repo`; `repository_owner_id` = that project's `owner_github_id`; or `key_…` path → hash lookup, not revoked, same project; else `401 { error: <reason> }` + one `event_rejections` row · 5 insert (`runs` upsert, `events` on conflict, `event_usage`) → `200` / `200 duplicate` / `409 duplicate_conflict` | JSON, exactly contract §8 |
| `POST /api/github/webhook` (T03) | HMAC | 1 production host else `404` · 2 `X-Hub-Signature-256` valid else `401`, nothing stored · 3 delivery id seen → `202`, nothing · 4 repository registered? else `202`, nothing · 5 store delivery + observation(s) → `202` | JSON |
| `POST /api/github/reconcile` (M5) | App installation token, server-side | per Tower ADR-003 | JSON |
| `/sign-in` | none | renders the GitHub button; states signed-out, denied (`?reason=not_owner`), error (`?reason=auth_error`) | HTML |

Rate limiting: Vercel's platform limits plus one in-route cap on `/api/ingest` of 60 requests per
minute per project (`429`, contract §8) — a sender journals and retries later. Sessions: Supabase Auth
defaults; the session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to the Tower origin. Recovery:
none in-app (ADR-002).

## 4. What is never logged

Tokens, keys, JWT claims, request bodies of refused events, the owner's id. Rejections keep a reason code
and a timestamp. Vercel function logs are not shipped anywhere.

## 5. Evidence at every gate

`pnpm guards` with `secrets: PASS` and `data: PASS`; the pgTAP run (`pnpm test:db`); for T01 the Supabase
Advisors (Security) screenshot with no errors or warnings; for T02 the vitest JWKS suite (expired, bad
signature, wrong issuer, wrong audience, unregistered repo, owner mismatch → `401`, `events` count
unchanged); `curl` proofs from `plan/M1.md` §7 pasted in the review with their output.
