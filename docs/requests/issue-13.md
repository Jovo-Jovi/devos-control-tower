# Request — issue #13: design v3 (tower map, light and dark themes, day/night scene)

Intake run, 2026-10-17. Two runs: the first stopped on a Claude usage limit with a partial plan on
`intake/issue-13`, and this run completed it. Decision: **accept** → OD-08 (DRAFT), `DESIGN_SYSTEM.md` v3, SCOPE
A-5, fence `docs/fences/T04.md` v2. No new row: the owner renumbered the ledger on `main` (`1792346`).

## What was asked (the human's words, from `.devos/request.md`, abridged)

> Make the approved design v3 the Tower's look: `docs/design/v3/README.md` is the specification.
> - Light and dark themes with an Auto default and a header switch (session only, no browser storage), the token
>   table of README §1.
> - The scene behind every page: a day sky with clouds, a night sky with stars, spires, and a planet that rotates
>   from day into night when the theme changes (README §3).
> - The portfolio `/` becomes the tower map (README §4–§7).
> - Every value from tables that exist (README §6): no migration, no new table.
> - `DESIGN_SYSTEM.md` becomes v3, with the motion amendments A–E of README §8 signed in a new OD.
> - Realistic images with Grok in Cursor (README §13): original prompts only, size, ratio and seam checks; the
>   baseline stays when the tool is not available or an image fails a check (never blocking); the reviewer looks
>   at every image. No new key, secret or method change.
>
> Out of scope (README §11): theme persistence (D1), pages that do not exist (D2), instances, lifecycle and
> ledger totals (D3), observed-only repositories (D4).
>
> Done when: on production at 1280 and 390, in light and dark, the map shows every registered project with the
> correct link state and "of seen" counts; the theme switch turns the planet into night and back in about 1.8 s;
> reduce motion makes the switch instant and stops every loop with the same meaning; the README §10 evidence is in
> the review.

The first planning run asked how to order the work, because intake may not renumber rows. The owner answered in
the issue thread:

> 1. **Layout (a).** The ledger is renumbered on main (commit 1792346): T04 = design v3 foundation; new T05 = the
>    overview as the tower map …, gate G-Design-v3; usage view T06; project page T07; T08 unchanged; sign-in
>    retrofit stays T09; history import T10 with G-Tower-v1.
> 2. **Import last.** The T09 sign-in retrofit runs before T10 … Please retarget T09 to v3 (the scene and planet
>    as its atmosphere) in the plan.
>
> Please write the OD, `DESIGN_SYSTEM.md` v3, the SCOPE rows, the request record and the T04 fence v2 …, each
> fence sized for the builder's 72-minute budget.

## What I decided

- **OD-08 (DRAFT)** makes v3 the approved direction. It amends OD-06 A1 §1 (v2's "a light theme" in "Does not
  decide" is now decided) and OD-07 §1–§3 and §6. It signs amendments A–E as `DESIGN_SYSTEM.md` §5 states them. The
  theme is session-only: `data-theme` on `<html>`, nothing stored (§3). It records the owner's ledger (§4) and the
  T09 retarget, where OD-07 §3–§4 and the gate test stand on the v3 states (§5). It confirms that the data comes
  only from existing tables (§6). The gate is G-Design-v3 on T05 (§9). The boundary is unchanged (§10). Two T03-a1
  carry-forwards, (c) and (d), are settled (§11).
- **No new task row and no new id.** The owner's renumbering already put T04 (foundation) and T05 (map, gate
  G-Design-v3) in the table. This intake adds only "Phase outlines" bullets for T04, T05, T06/T07/T10 and T09.
  The rows, their ids and the T09 row's wording and gate (G-Design-v2) are unchanged: intake does not edit
  existing rows.
- **`DESIGN_SYSTEM.md` v3** replaces v2. It has the §1 token block for both themes, the components, compositions,
  motion rules, quality floor, review procedure (screenshots, filmstrips, theme-switch filmstrip, reduced motion,
  layout shift, contrast), images (§9) and realistic art (§10). The design folder ranks with it, and the file holds
  where they differ.
- **Contrast** of §1 was recomputed with the README §1 method (glass composited over the canvas and over the
  darkest scene colour), and every stated value matched. T04's unit test recomputes it.
- **Fence T04 v2** is the foundation: tokens, fonts, `motion`, `ThemeSwitch`, `Scene`/`Planet`/`SceneRuntime`,
  shell and page head, not-found (CF-005), sign-in glass by CSS only, the token contrast test, the owner e2e helper,
  the evidence of both themes from its own spec, and the realistic-art step, last and time-boxed. Effort: high. It
  sits in the 72-minute budget because it reads and writes no data and leaves the map to T05.
- **Two departures from the README, recorded in the documents:**
  - Images are bundled from `src/components/scene/assets/`, not `public/scene/` (OD-08 §7, `DESIGN_SYSTEM.md` §9).
    `src/proxy.ts` redirects every path outside `/_next/`, `/api/`, `/sign-in`, `/auth/callback`, `/auth/sign-out` and `/favicon.ico` to `/sign-in` when
    there is no session, so a `public/` image could not reach the sign-in page without a proxy change. That change
    is a header/auth change (risk 3) that the request did not ask for.
  - `sky-day.jpg` keeps its committed 1600×900. README §13 says 2400×1350, and it also says "same sizes as the
    baseline"; the committed file is the baseline (`file docs/design/v3/assets/sky-day.jpg`).
- **`CONTENT_MODEL.md` §3** route table now gives `/`, `/projects/new` and `/api/projects` the tasks that build
  them (T04 shell, T05 map).

## What I left out, and why

- **Theme persistence (D1):** a preference cookie is a Boundary amendment, and a `theme` column is a schema
  change. The owner put both out of scope.
- **Pages that do not exist (D2), instances, lifecycle and ledger totals (D3), observed-only repositories (D4):**
  each needs its own request, and D3 needs an event-contract change.
- **An in-app "Reduce motion" control** (README §8 B names one, §2 places none): the system setting governs.
  Listed in OD-08 "Does not decide".
- **Fences for T05–T07, T09, T10:** each is written by the reviewer who passes the task before it (the method's
  normal order). OD-08 §5 and the T09 outline say that T09's v1 fence is reissued against v3.
- **Self-hosted fonts through `next/font/local`** (PR-24's permanent fix): a separate small change.

## Cost

Planning: two runs (the first stopped at the usage limit: 14 min, 60 turns, per the issue thread). This run's
figures are in the PR comment.
