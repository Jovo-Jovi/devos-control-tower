# TOWER — Carry-forwards

Every finding becomes a row. The reviewer describes the row in a verdict; the landing task allocates
the id from the live maximum and reports it. **Live maximum: CF-007.**

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
