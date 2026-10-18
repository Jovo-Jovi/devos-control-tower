# Request — issue #18: design v3.1 art (the owner's backgrounds and planet in the product)

Intake run, 2026-10-18. Decision: **accept** → OD-09 (DRAFT), `DESIGN_SYSTEM.md` §1, §3, §5, §9 and §10 amended,
SCOPE A-6, a new row **T11** (risk 2, gate **G-Design-v3.1**), fence `docs/fences/T11.md` v1.

## What was asked (the human's words, from `.devos/request.md`, abridged)

> Land the owner's v3.1 art, approved and documented in `docs/design/v3/README.md` §3.4 and §14 (merged in PR #16):
> - **Backgrounds:** `bg-day.webp`, `bg-night.webp` and the portrait pair replace the procedural skies, the vector
>   skylines, the window lights and the drifting cloud layer (cover, anchored bottom centre, portrait pair at
>   ≤ 760 px, crossfade over `--dur-scene`, slow 1 → 1.04 scale on day; the twinkling stars stay in dark, upper half
>   only).
> - **Planet:** `planet-day.webp` and `planet-crimson.webp` replace the procedural strips; the crimson globe is
>   revealed by the moving mask disc on the switch; `planet-sphere-map.png` is replaced by the v3.1 map and
>   `feDisplacementMap` scale becomes 300.
> - Amend `docs/DESIGN_SYSTEM.md` §1, §3 and §9 accordingly (the asset names, the "sphere map never replaced" rule
>   and the byte budget: about 1 MB, only the theme's background and planet texture before first paint).
>
> **Placement:** T05 is open and stops at G-Design-v3 for the owner's look, so put this in **T05's scope** as a
> further attempt focus, not as a new row after T10.
>
> Done when, at the G-Design-v3 gate, on the preview at 1280 and 390 in light and dark: the backgrounds are the
> owner's plates, the planet spins and its crimson night side rolls over it on the switch, the poles are round, and
> the scene does not move when the page scrolls. Small change (one or two tasks), next up.

## What intake decided

- **The art and the amendments are accepted as asked** (OD-09 §1–§2). `DESIGN_SYSTEM.md` now holds the v3.1 token
  block (§1, with a paragraph listing what it removes and adds), the v3.1 `Scene` and `Planet` rows (§3), the
  removal of the cloud sea and cloud pan and the day plate's slow scale as a loop of amendment B (§5.2, §5.6), the
  seven files with their sizes and bytes, the sphere map "replaced once", the budget (1 009 318 of 1 048 576 bytes,
  computed with `stat -c %s` over the seven files) and the loading rule (§9), and the end of the builder's image
  step (§10). §5 and §10 are amended too because they named the removed layers; leaving them would contradict §3.
- **Placement differs from the request, because the tree changed.** When this intake ran, T05 had already passed
  (`docs/reviews/T05-a5.md`, `PASS a5`) and the owner had merged it (PR #17, `0a5dad7`), signing G-Design-v3. A ticked
  row is never reopened, so the work is a new row, **T11**, with its own gate **G-Design-v3.1** carrying the
  request's "done when" unchanged (OD-09 §3).
- **"Next up" cannot be granted by intake.** The runner takes rows in id order and `guard:phases` requires ascending
  ids, and intake may not renumber. T11 therefore runs after T10. To make it next, the owner renumbers the open rows on
  `main`, as for issue #13 (`1792346`); the fence's header says the reviewer reissues it if the tree moved first.
- **One task, risk 2.** No header, auth, data or boundary change: the images stay bundled (`img-src 'self'`), and
  `src/proxy.ts`, `next.config.ts` and the CSP stay. The gate makes the review deep.
- **Loading.** "Only the theme's background and planet texture before first paint" is built with CSS rules under
  `prefers-color-scheme` and the 760 px query (nothing is stored, so the first paint always follows the system theme).
  The other theme's images load after hydration. Test 6 of `e2e/shell.spec.ts` proves it with JavaScript off.
- **Mask geometry** (README §3.4: 520 px disc, edge 46 %→54 %): `--planet-crimson-mask-position` is `-90px -90px` in
  dark. That centres the disc on the 340 px planet, and its opaque core (46 % of the 367.7 px farthest-corner radius
  is 169 px) covers it. In light it is `300px -90px`, where the disc's outer edge (199 px from its centre, at x = 560)
  clears the planet. The sweep runs right to left, as v3's lights mask did. The README's 25 % dark atmosphere replaces
  v3's 35 %.

## What was left out, and why

- **A contrast test measured on the plates.** The §1 pairs keep their reference backdrops and the token test does not
  change. Readability behind the glass is judged on the screenshots at the gate (OD-09 §5). A measured test is a later
  change if the screenshots show a problem.
- **Removing the v3 baseline images from `docs/design/v3/assets/`.** They stay as the design record. Only the bundle
  in `src/components/scene/assets/` changes.
- **`docs/method/AUTOMATION.md` §6** still says `art.mjs` "prints the scene-art prompts". Product tasks may not
  edit method files, so a method task corrects that line. T11 corrects the user guide (`HOW_TO_USE_DEVOS_AND_WORKFLOWS.md`).
- **No setting outside the repository** and no `docs/setup-items.json` entry: nothing new is needed.
