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
