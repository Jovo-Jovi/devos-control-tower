# Request — issue #49: T15 follow-ups before link requests go live

Intake run, 2026-10-26. Decision: **accept** → OD-13 (DRAFT), SCOPE A-10, scope added to T17 and T18 (rows
unchanged), no new row, no fence written.

## What was asked (the human's words, from `.devos/request.md`)

> A forward migration to the link-request data layer (OD-12, T15), merged before T17:
> 1. **Retention without races.** `purge_link_requests()` re-checks each row as it deletes it (the same conditions in
>    the `delete … where`, or `for update skip locked`), so a request approved while the 03:17 run is in progress is
>    never deleted.
> 2. **One request per project.** A unique `link_requests.project_id` where it is not null, or a guard in
>    `approve_link_request` that answers `project_linked` and changes nothing. […] If the "Link requests" panel (T16)
>    has merged, its Approve shows `project_linked` as its own field message.
> 3. **A pending cap per owner.** Besides the global 50, at most 3 pending requests per `owner_github_id`. […]
> 4. **A full export.** `export_link_request` also returns the linked project's `event_usage` and `observations` rows.
>
> Not changing: the `/api/link` body, its order of checks and its answers (OD-12 §2), and event contract v1.
>
> Done when: pgTAP proves a purge leaves an approved request and its project in place; a second request cannot be
> linked to an already linked project; the fourth pending request of one owner answers `rate_limited` and creates
> nothing, while another owner's new request still goes pending; the export includes usage and observations. Every
> existing pgTAP and unit test still passes. After the deploy, Supabase → Advisors → Security shows no error and no
> warning.
>
> Size: small change (one or two tasks). Priority: next up.

The owner's answers in the issue thread (they replace the earlier placement note):

> 1. Placement: (b). No new rows and no renumbering. A DRAFT OD puts the safeguard migration at the start of T17's
>    scope […]. Approve's own `project_linked` message goes into T18's scope […]. Leave the rows of `docs/PHASES.md`
>    and `docs/fences/T16.md` as they are: T16 is being built now. T17's fence does not exist yet; the reviewer writes
>    it from this OD when T16 passes.
> 2. Yes. In `supabase/tests/007_link_protection.sql`, change only the owner id argument in the purge set-up block
>    (lines 226–247) from '0' to '999'. Every assertion, description and plan count stays as it is.

## What I decided

- **OD-13 (DRAFT)** amends OD-12 §2 (6), §4, §6 and §9. It takes both of the owner's options for item 2: the unique
  index makes the invariant hold in the database, and the guard gives a clean answer instead of a `23505`.
- **Purge:** the conditions are repeated in each `delete … where` (the first of the two ways the request offers). Under
  read committed, a delete that waits on a row locked by a concurrent approval re-checks the new row version, so the
  approved request does not match and is skipped. A skipped row gets no audit row and no count.
- **Cap:** one transaction-scoped advisory lock before the counts. This also closes carry-forward (e) of
  `docs/reviews/T15-a1.md` (the 50 cap was checked without a lock). Repeat calls for an existing row never count.
- **Export:** two new keys, `event_usage` and `observations`. Every existing key stays, so T16's export (which passes
  the document through) and the `007` export assertions are unaffected.
- **Placement (answer 1):** no row added, edited or renumbered. One "Phase outlines" bullet in `docs/PHASES.md`
  tells the reviewer who writes the T17 and T18 fences what OD-13 adds. This follows the OD-07 precedent for T04
  (issue #5). Rows, verdicts and `docs/fences/T16.md` are untouched.
- **Existing tests (answer 2):** I checked the counts against `main`. The seed holds one pending request of owner `0`.
  In `006_link_requests.sql`, owner `0` never has more than 2 pending when a new repository asks, and the cap test
  at line 504 answers `rate_limited` either way, so `006` stays unchanged. In `007`, owner `0` has 2 pending when line
  226 runs: the seed's and `t15-pend-ex` (`t15-pend-del` was deleted at line 210). Line 226 makes 3, so line 227
  would be the 4th. With `'999'` in lines 226–247, owner `999` has at most 2 pending before any
  new request there. These counts come from reading the files, not from running them; T17's builder and reviewer
  prove them with the pgTAP run.
- **Documents:** `DATA_MODEL.md` §2.10, §4, §9 and §10, and `PROTECTION_MODEL.md` §5 and §7, now describe the
  target, each marked "from T17 (OD-13)".

## What I left out, and why

- **A new row and a fence (T19):** the owner chose option (b). T17's fence is written by the reviewer when T16 passes,
  as the cycle does.
- **Editing `docs/fences/T16.md`:** T16 is being built. Until T18, a `project_linked` answer falls under T16's
  `failed` mapping (a generic message, nothing changed), which is safe.
- **`for update skip locked` in the purge:** either way satisfies the request. The repeated condition is simpler and
  needs no second query.
- **A per-repository rate, configurable caps, telling the developer more than `429`:** not asked. Listed in OD-13
  "Does not decide".
- **Setup items:** none. No secret, variable or dashboard setting is new.
