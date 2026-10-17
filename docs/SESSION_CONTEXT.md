# TOWER — Session context

**Phase:** P01 (Tower v1 foundation) · **Last verdict:** none · **Open carry-forwards:** none

## Done steps

| Step | What | State |
|---|---|---|
| B0 | Bootstrap: method files copied from the pilot (`AUTOMATION.md` §11), the Tower's documents (brief, glossary, scope, decisions, data/security/boundary models, design direction, i18n/content models, `PHASES.md`, `devos/setup.json`), Tower ADR-001…004, fence T01, the two configuration deviations (`B0-BOOTSTRAP.md` §4) | committed by the owner (signs OD-01 to OD-06) |
| T01 | Skeleton: Next.js app, Supabase module, owner-only GitHub sign-in, header baseline, Tower ADRs | built — awaiting verdict |

## Next action

Review of T01 attempt 2. The build halted on S3: `forbidden()` cannot serve HTTP 403 and `lang`/`dir` on the same server document. The other reissue items are in the tree. Gate **G-Tower-Auth** stays with the owner after a passing review: the sign-in screenshots (1280 and 390, signed-out, denied, error), the Supabase Advisors security screenshot, and the forged-metadata proof. The single `owner_allowlist` row is inserted in the SQL editor after this migration is applied; it is not in the repository.
