# Issue #6 — Method improvement: motion evidence for design v2

- Kind: **method improvement** (PR-30): nothing failed; the human asks for new evidence. No run to
  diagnose (`.devos/runlogs/` holds only `recent-failures.json`, six `devos-deploy`/`ci` runs from
  before the request, none about screenshots).
- Planned as: **T08** (Phase `PM`, risk 3, gate `G-Method-6`), fence `docs/fences/T08.md`.
- Resume after merge: none. The flow is not stuck; the cycle continues with the next open task (T02),
  and T04, the first UI task of design v2, runs after this lands.

## Goal

`docs/DESIGN_SYSTEM.md` §7 (OD-06 A1) requires, per page and state the fence names, at 1280 and 390:
(1) a settled screenshot, (2) a motion filmstrip at 0, 80, 160, 320 and 640 ms after the trigger
(first paint, and each interaction the fence names), (3) a reduced-motion screenshot of the same
state, (4) the `layout-shift` value from `PerformanceObserver`, expected 0; and the reviewer judges
the design ledger's **motion** row (§7, last paragraph).

Today none of this exists:

- `scripts/devos/screens.mjs:67` opens every context with `reducedMotion: "reduce"`, so no
  screenshot ever shows normal motion, and there is no reduced/normal pair to compare.
- `scripts/devos/screens.mjs:66-77` takes one full-page screenshot per page and width after
  `networkidle`: no filmstrip, no layout-shift value, no interaction.
- `scripts/devos/screens.mjs:20-21` knows pages only (arguments or `devos.config.json`
  `screens.pages`): a fence cannot name a state (`/sign-in?reason=not_owner`) or an interaction.
- `scripts/devos/evidence.mjs:117-122` reports only a PNG count; `scripts/devos/render-prompt.mjs:29-31`
  tells the reviewer "full-page screenshots"; `devos/prompts/reviewer.md:51-53` asks only for a
  visual comparison, with no motion row and no layout-shift rule.

## Design (each file and what changes)

1. **`scripts/devos/screens.mjs`** — restructured into exported functions plus a `main()` that runs
   only when the file is executed (the `builder-model.mjs:77` pattern), so tests and
   `evidence.mjs` can import it without launching a browser.
   - **States.** `parseScreensLine(fenceText)` reads the fence header bullet
     `- Screens: <entry> · <entry> …`, each entry in backticks: `<name> <path>[ <action> <selector>]`,
     name `^[a-z0-9][a-z0-9-]*$`, path starting `/` (query allowed), action `click | hover | focus`,
     selector = the rest (a Playwright selector). Bad or duplicate entries are reported, not fatal.
     Source order: command-line paths → the fence of `--task` (default `process.env.TASK`, already a
     job-level variable of `devos-cycle`'s `cycle` job, so **no workflow change**) → `devos.config.json`
     `screens.pages`. Page-only sources get a name derived from the path as today (`root`, `sign-in`).
   - **Captures per state × width** (`WIDTHS` 1280×900 and 390×844 unchanged):
     - normal-motion context (`reducedMotion: "no-preference"`): a CDP screencast
       (`Page.startScreencast`, PNG, every frame, acknowledged) records frames with timestamps from
       the trigger to trigger + 640 ms + margin. Trigger = first contentful paint for a plain state;
       for an interaction state, the moment just before the action, after the page settled. Frame
       for target 0 = first frame at or after the trigger; for t > 0 = latest frame at or before
       trigger + t. Written as `<name>-<width>-film-000|080|160|320|640.png`, each with its real
       offset recorded;
     - then the settled full-page screenshot `<name>-<width>.png` (settled = network idle, fonts
       ready, every finite animation finished, capped at `screens.settle_max_ms`);
     - layout shift: an init script sums `layout-shift` entries without `hadRecentInput` from
       navigation to settled;
     - reduced-motion context (`reducedMotion: "reduce"`): same state (and action), settled
       full-page `<name>-<width>-reduced.png` and its own layout-shift value;
     - each context records what `matchMedia("(prefers-reduced-motion: reduce)")` reports, which is
       the proof the two captures differ in motion preference.
   - **Manifest** `.devos/screens/motion.json`: source, task, where the states came from, the
     targets, parse errors, and one record per state × width (files, frame offsets, clock used,
     layout shift normal and reduced, settle capped or not, error). A capture that throws records its
     error and the run continues with the next one.
   - `motionSummary(manifest)` (Markdown lines for the evidence pack) and `motionCounts(manifest)`
     (numbers for the reviewer prompt) are exported.
2. **`devos.config.json`** `screens`: add `filmstrip_ms` `[0, 80, 160, 320, 640]` and
   `settle_max_ms` `3000`; keep `pages`; the `$comment` names the `- Screens:` fence line.
3. **`scripts/devos/evidence.mjs`** — the "Screenshots" section becomes "Screenshots and motion":
   `motionSummary` of the manifest (a table per state × width: settled, reduced, frames n/5, layout
   shift normal/reduced, flags), any non-zero layout shift and every capture error stated in words;
   without a manifest, the PNG count as today plus "no motion manifest: motion is unproven".
4. **`scripts/devos/render-prompt.mjs`** `SCREENS_LINE` — from `motionCounts`: states, widths,
   settled / reduced / filmstrip-frame counts, and "read the evidence pack's motion table".
5. **`devos/prompts/reviewer.md`** — the visual check reads, per state and width, the settled, the
   reduced-motion screenshot and the five filmstrip frames, and judges the seven-row design ledger of
   `docs/DESIGN_SYSTEM.md` §7 including **motion** (purpose test, tokens, once-only, reduced motion)
   and **truthfulness**; a layout shift above 0, a missing manifest for a UI diff, or a state the
   fence names with no capture is a FAIL. In step 5, a UI fence carries a `- Screens:` header line
   naming every page, state and interaction to capture.
6. **`devos/prompts/intake.md`** — the first fence of a UI task carries the same `- Screens:` line.
7. **`scripts/devos/screens.test.mjs`** (new, `node --test`): the reproduction (below), against a
   synthetic page served by the test itself.
8. **`docs/method/AUTOMATION.md`** §2, §4, §7, §8 and **`docs/method/PRECEDENTS.md`** (new row,
   "Live maximum" updated).

## Settings the human must add

None. Chromium comes from the project's own `@playwright/test` (the cycle already runs
`playwright install --with-deps chromium` before `screens.mjs`); no secret, variable or service.

## What could break

- **Run time**: three captures per state × width instead of one. With the default two pages, about
  4 × (film + settle + reduced) — tens of seconds; the step stays `continue-on-error`.
- **Signed-in states**: pages behind sign-in redirect to `/sign-in`; until the fixture switch
  (`DEVOS_SCREENS=1`, Tower ADR-004, M3) exists, a fence can only name states reachable without a
  session. The manifest records the path captured; the reviewer sees a redirect for what it is.
- **Timing honesty**: screencast frames arrive on change only; the chosen frame is what was on
  screen at the target, and its real offset is recorded, so a slow runner shows as late offsets,
  never as faked timing.
- **File names change** from `<page>-desktop|phone.png` to `<name>-<width>[-reduced|-film-NNN].png`.
  Nothing parses the old names (`render-prompt.mjs:12` and `evidence.mjs:119` only count PNGs).
- **The builder-model parser** reads `Effort:`/`Fast:` from the first 30 fence lines
  (`builder-model.mjs:27-29`); the `Screens:` line must not contain those words, which its grammar
  cannot produce.
- Nothing weakens a non-waivable rule: no workflow, surface, gate, secret or Boundary rule changes;
  screens remain runner-generated evidence (PR-02, PR-22).

## How it is proven

`node --test scripts/devos/screens.test.mjs` (exactly the six tests in `docs/fences/T08.md`): the
fence-line parser; frame selection on synthetic timestamps; on a synthetic page in Chromium, the
normal-motion context reports no reduced-motion preference and the reduced one does (the defect at
`screens.mjs:67` makes both report `reduce`); five filmstrip frames for a first-paint fade and for a
click, frame 0 differing from frame 640; layout shift 0 on a still page and above 0 on a page that
inserts a block; the evidence summary flags the shift. Plus `node --check` on each changed script,
`node scripts/guards/run-all.mjs`, and the greps in the fence's Done-when.
