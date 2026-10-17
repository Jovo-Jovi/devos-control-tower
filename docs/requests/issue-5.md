# Request — issue #5: implement design system v2 (OD-06 A1)

Intake run, 2026-10-17. Decision: **accept** → OD-07 (DRAFT), SCOPE A-4, task T09, fence `docs/fences/T09.md`.

## What was asked (the human's words, from `.devos/request.md`)

> **What should change.** Implement design system v2 (docs/DESIGN_SYSTEM.md, OD-06 A1) as a foundation task
> placed before T04: tokens §1, Inter and Geist Mono, the motion dependency, motion primitives (LiveMark,
> StatusChip transition, Counter, FLIP list, Toast, StateBlock sheen, View Transitions with the shared logo),
> and the full sign-in retrofit §4.1 (first paint, redirecting, checking access, success transition, denied,
> error, sign-out). Write the fences for T04–T07 against v2, not the v1 specs in devos-plan. Plan the motion
> evidence (§7: filmstrips, reduced-motion screenshots, layout-shift value) as a method fix for screens.mjs.
>
> **Why.** The Tower should feel world-class: motion that explains arrivals, changes and staleness, on a dark
> control-room theme.
>
> **Done when.** On production at 1280 and 390, sign-in plays every §4.1 state; with reduce motion on, the same
> states are clear without movement; the filmstrips and layout shift 0 are in the review.
>
> Size: large or cross-cutting. Priority: next up.

The owner's answers in the issue thread:

> 1. Option (c). No renumbering. Draft the OD amending OD-06 A1 §4: T04 lands the v2 foundation as part of its
>    scope: tokens §1 (values swapped under the existing names, so sign-in turns dark with it), Inter + Geist
>    Mono, the `motion` dependency, and the primitives T04 itself uses (LiveMark, StatusChip transition,
>    Counter, FLIP list, StateBlock sheen, Toast, View Transitions). T05–T07 add any further primitives they
>    use; all four fences are written against v2. The sign-in retrofit (§4.1, including the "Checking your
>    access…" interstitial) is T08, risk 3, gate G-Design-v2.
> 2. I am filing a "Dev OS method fix" issue for the §7 motion evidence now, so it lands before T04. Until it
>    exists, a UI task's builder adds the filmstrips and the layout-shift value from its own Playwright spec.

## What I decided

- **OD-07 (DRAFT)** amends OD-06 A1 §4 exactly as answer 1 says: no task before T04, no renumbering; the v2
  foundation is part of T04's scope (rows unchanged); T05–T07 add their own primitives; all four fences follow
  v2; the sign-in retrofit is **T09**, risk 3, gate **G-Design-v2**. It is OD-07 because it is the next free
  number in this repository's `DECISIONS.md`; the OD notes that the "OD-07/OD-08" cited by the copied method
  files are the pilot's.
- **The interstitial needs a route change.** "Checking your access…" must show only while the code exchange
  is pending (§4.1). Today `/auth/callback` is a route handler that exchanges and redirects, so nothing can be
  shown. T09 makes `/auth/callback` a page that shows the interstitial and replaces itself with the new route
  handler `GET /auth/confirm`, which holds T01's exchange logic unchanged. The return URL Supabase knows stays
  `/auth/callback`, so no dashboard setting changes. `SECURITY_MODEL.md` §3 gains the two rows. Boundary:
  inside the `owner` zone, no new data, cookie or third party; `devos:boundary` unchanged.
- **CSS and View Transitions only for the sign-in.** The success transition crosses documents (GitHub →
  `/auth/callback` → `/auth/confirm` → `/`), so the shared mark is a cross-document view transition
  (`@view-transition`, `view-transition-name`), not a React transition. The production CSP has no
  `'unsafe-inline'` for styles, so the fence forbids `style` props, which also excludes server-rendered
  `motion` initial styles in this tree.
- **Motion evidence until the method fix lands:** T09's own Playwright spec writes 10 settled, 10
  reduced-motion and 50 filmstrip screenshots and a layout-shift JSON (answer 2, OD-07 §5).
- **PHASES.md:** one row (T09) and a new "Phase outlines" section: a T09 bullet, and a bullet that tells the
  reviewer who writes the T04–T07 fences what OD-07 adds to them (no row is edited).
- **T09 fence** written now (v1). It runs after T07 and cites no path T04–T07 create; its preconditions check
  T04's foundation by content (tokens, fonts, `motion`). The reviewer who passes T07 reissues it if the tree of
  that day differs.

## What I left out, and why

- **A separate foundation task before T04** (the original text): superseded by the owner's option (c).
- **Fences for T04–T07:** each is written by the reviewer when the task before it passes (the cycle's rule);
  OD-07 §2 and the Phase outlines bind them to v2. T02's fence already exists and is not a UI task.
- **The §7 method fix for `scripts/devos/screens.mjs`:** the owner files it as its own "Dev OS method fix"
  issue (PR-28); its intake plans it as a Phase `PM` row. Not planned here.
- **"Use another account" forcing GitHub's account chooser:** not in §4.1's wording; the button restarts the
  same sign-in. Recorded in OD-07 "Does not decide".
- **A light theme, a duration/easing guard:** out of scope (OD-06 A1, `DESIGN_SYSTEM.md` preamble).


**Renumbered 2026-10-17 (owner session):** the method fix for issue #6 took id T08 first, so this plan's task is **T09** (row, fence, OD-07, SCOPE A-4, SECURITY_MODEL). Quoted comments keep their original wording.

**Completed 2026-10-17 (intake run resumed after the limit):** the partial files were checked against `main` @
`69c9e42` (paths, scripts, tokens in `DESIGN_SYSTEM.md` §1, `deep_paths`, `probe.mjs`/`guard-surfaces.mjs`
usage; `node scripts/guards/run-all.mjs --only phases` → `PASS (9 tasks, 1 PASS)`). No task was added (no
T10). The T09 fence's rehearsal line now cites `69c9e42`, its environment line carries T01's Node 22 note,
and it gains a `- Screens:` line in the format T08 (issue #6) defines, so the runner's motion capture covers
the three page states once T08 lands; the builder's own spec still covers all five states (OD-07 §5).
