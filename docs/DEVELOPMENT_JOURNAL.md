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
