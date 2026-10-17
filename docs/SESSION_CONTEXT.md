# TOWER — Session context

**Phase:** P01 (Tower v1 foundation) · **Last verdict:** none · **Open carry-forwards:** none

## Done steps

| Step | What | State |
|---|---|---|
| B0 | Bootstrap: method files copied from the pilot (`AUTOMATION.md` §11), the Tower's documents (brief, glossary, scope, decisions, data/security/boundary models, design direction, i18n/content models, `PHASES.md`, `devos/setup.json`), Tower ADR-001…004, fence T01, the two configuration deviations (`B0-BOOTSTRAP.md` §4) | committed by the owner (signs OD-01 to OD-06) |

## Next action

Run `devos-cycle` on **T01** once the setup issue shows every `blocks: cycle` item present
(`CURSOR_API_KEY`, a Claude credential) and the owner has created the Supabase project (GitHub provider
on, everything else off), the Vercel project (Standard protection) and inserted the single
`owner_allowlist` row in the SQL editor after T01's migration is applied. T01 ends at gate
`G-Tower-Auth`: the owner reviews the sign-in screenshots (1280/390, three states), the Advisors
screenshot and the forged-metadata proof before merging.
