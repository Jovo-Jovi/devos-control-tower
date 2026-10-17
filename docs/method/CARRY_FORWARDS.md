# TOWER — Carry-forwards

Every finding becomes a row. The reviewer describes the row in a verdict; the landing task allocates
the id from the live maximum and reports it. **Live maximum: CF-011.**

Statuses: `OPEN` · `CLOSED at <task>` · `ACCEPTED at <task>` · `MAINTENANCE` · `HANDOVER`.

| CF | Item (finding, where, evidence) | Owner | Status | Lands at |
|---|---|---|---|---|
| CF-001 | SECURITY_MODEL §2 amendment: the CSP ships `'strict-dynamic'`, a production style nonce, and `'unsafe-inline'`/`'unsafe-eval'` in development only; §2 lists none of these (`docs/reviews/T01-a3.md` a). | human (document edit) | OPEN | document amendment |
| CF-002 | I18N_MODEL §1 amendment: a `forbidden()` 403 is served on Next's error shell, and `lang`/`dir` reach `<html>` with the client render of the root layout (decided in T01-a2, proven by e2e in a3) (`docs/reviews/T01-a3.md` b). | human (document edit) | OPEN | document amendment |
| CF-003 | Node v24 is ahead of v22 on the builder's PATH (reports a2 and a3) (`docs/reviews/T01-a3.md` c). | human opens a "Dev OS method fix" issue (PR-28) | OPEN | method fix |
| CF-004 | The evidence pack's bundle scan matches supabase-js's `sb_secret_` prefix check (a1, a2 and a3) (`docs/reviews/T01-a3.md` d). | the same method fix | OPEN | method fix |
| CF-005 | Next's default not-found uses inline `style` attributes, which the production CSP blocks: a styled `src/app/not-found.tsx` belongs in T04 (`docs/reviews/T01-a3.md` e). | reviewer when writing T04 | OPEN | T04 |
| CF-006 | G-Tower-Auth production checks from fence v3 "At the gate" (Deployment Protection Standard, GitHub-only provider, Advisors screenshot, allow-list row, second-account 403, forged-metadata proof, `curl` 302/401) (`docs/reviews/T01-a3.md` f). | human and reviewer at merge | OPEN | G-Tower-Auth |
| CF-007 | The builder's environment lacks Playwright's Chromium: the first `pnpm e2e` of a3 could not launch it until `pnpm exec playwright install chromium` (report Notes). The runner installs it only for its own checks (`scripts/devos/run-checks.mjs:137`) (`docs/reviews/T01-a3.md` g). | the method fix of (c) | OPEN | method fix |
| CF-008 | Every unauthenticated POST with a schema-valid body writes one `event_rejections` row (`ingest.ts:136`). The 60/minute cap applies only after authentication, and the table has no retention. As designed (SECURITY_MODEL §3, contract §8), but unbounded (`docs/reviews/T02-a2.md` a). | human (cap or retention: a SECURITY_MODEL/DATA_MODEL amendment) | OPEN | document amendment |
| CF-009 | Some values pass contract §1.1 but `ingest_event` cannot cast them: a calendar-invalid `at` (`2026-02-30T00:00:00Z`) or a token count above 2 147 483 647. They answer 500, not 400, so the sender retries them until its window drops the line (`docs/reviews/T02-a2.md` b). | human (contract §1.1 note), then the reviewer writing T07 | OPEN | T07 |
| CF-010 | A JWKS response that is not 200 or not JSON throws a plain `JOSEError` (`node_modules/jose/dist/webapi/jwks/remote.js:20,24`), which `oidc.ts:50` maps to `bad_signature`. During a GitHub JWKS outage valid tokens get 401 plus a rejection row, not 503. The sender's action is the same (retry) (`docs/reviews/T02-a2.md` c). | reviewer, in the next fence that touches `src/lib/contract/oidc.ts` | OPEN | next fence that touches `src/lib/contract/oidc.ts` |
| CF-011 | `docs/adr/ADR-003-github-app.md:35-37` has `observations` store conclusion, PR number and labels. DATA_MODEL §2.8 (precedence 7, which wins over 9) has only `state`. Contract §2 expects `waiting` reasons as observed PR labels. Fence T03 follows DATA_MODEL and folds the conclusion into `state` (`docs/reviews/T02-a2.md` d). | human (an expand migration adding `pr_number`/`labels` before T06, or an ADR-003 amendment) | OPEN | before T06 |
