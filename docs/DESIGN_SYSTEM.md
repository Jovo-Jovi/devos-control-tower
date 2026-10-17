# TOWER — Design system v2 ("Night-shift control room")

**Status:** approved **direction** (OD-06, amendment A1, 2026-10-17). Precedence 8. Supersedes v1
("Control-room ledger"). Each UI fence carries a Design specification that refines this direction for its
pages and states; the reviewer verifies screenshots **and motion filmstrips** against both. `guard:design`
applies unchanged (logical properties only, tokens only, no raw colour or px outside
`src/styles/tokens.css`); durations and easings outside the tokens are a review finding until the guard
checks them.

References the owner chose: **Raycast** as catalogued by Refero Styles ("midnight command center, coral
neon": near-black surfaces, hairline borders, one warm accent, Inter + Geist Mono) for the look; the
**prompt-motion.com** gallery (Product UI, Charts, Kinetic type) for the ambition of the motion. Neither is
copied: no Raycast logo, artwork, wording or layout is reproduced; the Tower keeps its own name, content
and compositions.

## 0. Idea

A night-shift control room: **dark, quiet surfaces where the only light is information.** Everything the
Tower knows arrives, settles and ages on screen the way it does in the system it watches — an event
*lands*, a status *changes*, a project *goes quiet*. Motion is how the Tower tells time and causality;
it is never decoration.

Three rules carry over from v1 unchanged and outrank everything below:

1. **Truthfulness.** Every fact shows its origin (reported · observed · verified · imported) and its age.
   `unavailable` is `—` with a legend, never `0`. No progress claim the data lacks.
2. **Meaning never by colour alone** — words and shape first, colour and motion support them.
3. **Motion never lies.** A number never counts up from 0 to a value it did not pass through; a bar never
   grows past what is known; a "live" pulse appears only while an event stream is actually connected.

## 1. Tokens (`src/styles/tokens.css` — the only file with raw values)

Variable names are v1's where the role is the same, so a theme swap is a value change, not a refactor.

```css
:root {
  color-scheme: dark;

  /* surfaces (darkest → lightest) and ink */
  --color-canvas: #040506;        /* page background, the only one */
  --color-paper: #040506;         /* v1 name kept: alias of canvas */
  --color-surface: #0b0c0e;       /* cards, panels, table bodies */
  --color-raised: #111214;        /* inputs, pressed, popovers */
  --color-badge: #1b1c1e;         /* neutral chip fill */
  --color-line: #1f2023;          /* hairline separators */
  --color-line-strong: #6a6b6c;   /* chip and input borders (3.66:1 on surface) */
  --color-ink: #f4f4f5;           /* text (17.8:1 on surface) */
  --color-ink-muted: #9c9c9d;     /* secondary text (7.1:1 on surface) */
  --color-ink-faint: #6a6b6c;     /* non-text marks only, never body copy */

  --color-accent: #ff6363;        /* coral: focus ring, live mark, brand mark, links (6.7:1) */
  --color-accent-ink: #0b0c0e;
  --color-accent-wash: #452324;   /* warm surface behind accent content */
  --color-action: #e6e6e6;        /* primary button fill (no chromatic CTA) */
  --color-action-ink: #0b0c0e;    /* 15.7:1 on action */

  /* step status: text on tinted bg, every pair ≥ 6.6:1 (computed) */
  --color-pass: #59d499;     --color-pass-bg: #0e2419;
  --color-fail: #ff7a6e;     --color-fail-bg: #2a1211;
  --color-waiting: #f5c451;  --color-waiting-bg: #2a2108;
  --color-revise: #b69cff;   --color-revise-bg: #1d1631;
  --color-skipped: #a1a1aa;  --color-skipped-bg: #18181b;
  --color-started: #63a1ff;  --color-started-bg: #0c1a33;
  --color-stale: #e0a458;    --color-stale-bg: #261a0b;

  /* origin (shape carries the meaning) */
  --color-origin-verified: #f4f4f5;
  --color-origin-imported: #8a8b8f;

  /* atmosphere: the one place gradients are allowed (sign-in, empty portfolio) */
  --glow-accent: radial-gradient(60% 50% at 50% 0%, rgb(255 99 99 / 0.16), transparent 70%);
  --glow-cool: radial-gradient(50% 40% at 80% 10%, rgb(99 161 255 / 0.10), transparent 70%);
  --glass: rgb(11 12 14 / 0.72);  /* header bar, with --blur-glass */
  --blur-glass: 24px;

  /* elevation: hairline + inner light instead of drop shadows */
  --edge: inset 0 1px 0 rgb(255 255 255 / 0.05), 0 0 0 1px var(--color-line);
  --edge-hover: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 0 1px var(--color-line-strong);

  /* space (8-based, v1 names kept) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 80px;

  --radius-1: 6px;   /* chips */
  --radius-2: 8px;   /* inputs, buttons */
  --radius-3: 16px;  /* cards */
  --radius-pill: 9999px;

  --font-body: var(--font-sans), system-ui, sans-serif;
  --font-mono: var(--font-mono), ui-monospace, monospace;
  --text-0: 0.6875rem; --text-1: 0.8125rem; --text-2: 0.9375rem; --text-3: 1.25rem;
  --text-4: 1.5rem;    --text-5: 2rem;      --text-6: 3.5rem;
  --leading: 1.5; --leading-tight: 1.15;

  --content-max: 1200px;

  /* motion — see §5. Durations and easings live only here. */
  --dur-instant: 90ms;    /* press, toggle, focus */
  --dur-quick: 160ms;     /* hover, chip state change, tooltip */
  --dur-base: 240ms;      /* enter/exit of a component */
  --dur-slow: 420ms;      /* page-level choreography, shared element */
  --dur-ambient: 2400ms;  /* live pulse, skeleton sheen; loops only */
  --stagger: 40ms;        /* per item in a list entrance; total capped at 320ms */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* entrances: fast start, soft landing */
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);       /* exits */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* moves and morphs */
  --ease-spring: linear(0, 0.36 9%, 0.84 22%, 1.04 33%, 1.01 45%, 1 100%); /* settles with a hint of overshoot */
  --rise: 8px;            /* entrance travel distance */
}
```

`docs/DESIGN_SYSTEM.md` §1 is the source of these values; the task that lands them copies them byte for
byte. One theme (dark). A light theme is a later scope amendment.

## 2. Type

- **Inter** 400/500/600 for text (`--font-sans`), **Geist Mono** 400/500 for ids, shas, run keys, seq,
  counts, times and eyebrows (`--font-mono`), both through `next/font/google` (self-hosted at build).
- Scale: display `--text-6` 500 (sign-in only) · page title `--text-4` 600 · section `--text-3` 600 ·
  body `--text-2` · table and chip `--text-1` · meta (age, origin, alias) `--text-0` · eyebrow
  `--text-0` mono uppercase, letter-spacing 0.08em.
- Numbers: `tabular-nums`, right-aligned, `Intl.NumberFormat`; missing = `—`.
- Times: relative in text ("4 min ago"), absolute ISO in `title` and in mono table columns. Relative
  ages re-render every 30 s without moving the layout.

## 3. Components

All v1 components remain with their v1 meaning; v2 changes their look and adds the motion column.

| Component | Look | Motion (tokens from §1, rules from §5) |
|---|---|---|
| `AppHeader` | glass bar (`--glass` + blur), product mark left, avatar + login right, sign-out | on scroll > 8px the bottom hairline fades in (`--dur-quick`); never hides |
| `LiveMark` | 6px coral dot + "live" word, only while the realtime channel is open | ambient pulse (scale 1→1.6, opacity 0.6→0, `--dur-ambient`); disconnected → dot turns `--color-ink-faint`, word "offline", no pulse |
| `StatusChip` | tinted pill `--radius-1`, word first (`verdict · pass`) | status change = **crossfade + 1-frame tint flash** (`--dur-quick`); `started` has a breathing dot (`--dur-ambient`) |
| `OriginChip` | reported outlined · observed dotted · verified filled ink · imported filled grey; always the word | becoming *verified* = the outline fills from the start edge (`--dur-base`, `--ease-in-out`) — the one "stamp" moment |
| `AgeText` | muted meta | none; text swaps in place |
| `FreshnessLabel` | fresh / stale pair | going stale: the row's ink transitions to muted over `--dur-slow` and the label slides in from the end edge |
| `HealthBanner` | full-width fail-tinted bar under the header | slides down `--dur-base`; numeric regions under it crossfade to `StateBlock error` |
| `StateBlock` | loading / empty / error in words, fixed min-height | loading = 3 hairline rows with a left-to-right sheen (`--dur-ambient`); loaded = crossfade, **no layout shift** |
| `ProjectRow` | surface card row, hairline edge, hover `--edge-hover` | list entrance: rise `--rise` + fade, staggered; new project = slides in at its sorted position, others move (FLIP, `--ease-in-out`) |
| `Timeline` / `EventRow` | vertical rail with seq ticks, mono seq | **a new event lands**: rail extends, row rises into place, its chip appears last (`--dur-base` + 1 stagger); older rows shift down by FLIP; never re-animates rows already seen |
| `EvidenceLink` | mono, start-truncated path | hover: underline draws from start edge (`--dur-quick`) |
| `Counter` (new) | a number with its unit | value changes roll per digit (odometer, `--dur-slow`) **only between two real values**; first render = fade in, no count-up |
| `Bar` (new, Usage only) | thin bar for measured share | grows from 0 to its value once on first view (`--dur-slow`, `--ease-out`); `unavailable` = hatched empty bar, never animated |
| `UsageTable` / `CoverageLine` | v1 rules | coverage line first; table rows stagger in on first view only |
| `OwnerForm` | inset inputs (`--color-raised`), labels above | focus ring draws in (`--dur-instant`); invalid field = 2-cycle horizontal nudge (4px, `--dur-base`) + error text reveal; submit button morphs into its pending state, then into ✓ text |
| `Toast` (new) | bottom-start, surface + edge | in: rise + fade `--dur-base`; out: fade `--dur-quick`; auto-dismiss 5 s; pausable on hover/focus |
| `ImportResult` | plain table | counts appear row by row (stagger), no progress bar |

## 4. Compositions and their choreography

Every page has a **first-paint choreography** (≤ `--dur-slow` + 320ms stagger in total), designed
**states**, and **transitions** between them. Route changes use the View Transitions API (Next.js
`ViewTransition` / CSS `view-transition-name`) with a crossfade + `--rise` default and named shared
elements listed below.

### 4.1 Sign-in `/sign-in` (retrofit of T01)

- **Layout:** canvas with `--glow-accent` + `--glow-cool` atmosphere; centred card (`--radius-3`,
  `--edge`), product mark, display line "Control Tower", one sentence, the GitHub button
  (`--color-action`).
- **First paint:** atmosphere fades in (`--dur-slow`); card rises (`--rise`, `--ease-out`); title,
  sentence, button stagger in.
- **Press → redirecting:** button compresses (scale 0.98, `--dur-instant`), label crossfades to
  "Opening GitHub…" with a 3-dot sequence; the card stays put (no layout change).
- **Returning from GitHub (`/auth/callback`):** an interstitial "Checking your access…" with a hairline
  progress sweep — truthful: it runs only while the callback request is pending.
- **Success:** the product mark is a **shared element** — it travels from the card into the header's mark
  position while the card dissolves and the portfolio's first paint begins (`--dur-slow`).
- **Denied (`not_owner`):** card nudges (2 cycles, 4px, `--dur-base`); the message "This GitHub account is
  not the owner. Signed out." reveals under the button; the button reads "Use another account".
- **Error (`auth_error`):** the reason in words reveals with a fail-tinted hairline at the card's top
  edge; "Try again" button.
- **Signed out (from the header):** header and content fade (`--dur-base`), sign-in card rises.

### 4.2 Portfolio `/`

- Totals line as `Counter`s (projects · tasks passed / total · measured attempts) with `LiveMark`;
  `ProjectRow` list; "Register project".
- **First paint:** header in place (no animation), totals fade, rows stagger.
- **Live:** a new event for a project → that row's latest `StatusChip` changes (§3) and the row's age
  resets; if the sort order changes, the row moves by FLIP. A project going stale → §3 `FreshnessLabel`.
- **States:** loading (skeleton rows, sheen) · empty (atmosphere + "No project yet. Register the first
  one." + button, rises in) · error (`HealthBanner` + `StateBlock error`) · stale rows.
- **To project page:** the clicked row's name is a shared element into the project header.

### 4.3 Register `/projects/new`

- `OwnerForm` (key, repository, stale window). Submit → pending morph → success toast + navigation to
  the project page (shared name). Invalid → field nudge + error text.

### 4.4 Project `/projects/[key]`

- Header (shared name, repo, freshness, `LiveMark`); phases as segmented rail (tasks as ticks coloured by
  latest status — word on hover/focus and in a list below for screen readers); runs as `Timeline`s.
- **First paint:** header settles, phase rail draws from start edge (`--dur-slow`), newest run's events
  stagger.
- **Live:** a new event lands (§3 `EventRow`); a run's verdict *pass* makes its rail segment fill; a
  newly verified fact plays the `OriginChip` stamp once.

### 4.5 Usage `/projects/[key]/usage`

- `CoverageLine` first, then totals (`Counter`s) by agent and by model with `Bar`s, `UsageTable`,
  failed-attempts table, legend.
- **First paint:** coverage line, then counters fade, bars grow once, table rows stagger.

### 4.6 Import `/projects/[key]/import`

- Idle (drop zone with dashed edge; drag-over = edge brightens, `--dur-quick`) · uploading (truthful
  byte progress only if the browser reports it; otherwise indeterminate sweep with the word
  "Uploading…") · result (`ImportResult` rows stagger) · error.

## 5. Motion rules

1. **Purpose test.** Every animation answers one of: *what just arrived*, *what changed*, *where did it
   go*, *what is waiting*, or *what is stale*. If it answers none, it is removed.
2. **Only `transform` and `opacity`** (plus `clip-path` for the draw/fill effects). Never animate
   layout properties, `filter` on large areas, or box-shadow.
3. **Durations from tokens only**; nothing interactive above `--dur-slow`; total first-paint
   choreography ≤ 740ms; ambient loops only for `LiveMark`, `started` and skeleton sheen.
4. **Never block reading or input.** Content is interactive from its first frame; entrances never delay
   a click target by more than `--dur-base`.
5. **Animate once.** Entrances play on first view of a page; returning to a page, refreshing data, or
   re-rendering does not replay them. Live changes animate only the thing that changed.
6. **`prefers-reduced-motion: reduce`:** every entrance, move and stagger becomes an opacity crossfade of
   `--dur-quick` or nothing; ambient loops stop (static dot); odometers swap values; shared elements
   crossfade. Meaning is identical with motion off.
7. **Performance:** 60 fps on a mid-range phone; no CLS from animation (`layout-shift` = 0 in the
   evidence); JavaScript motion only where CSS cannot do it (FLIP, odometer, shared elements).
8. **Library:** CSS transitions/keyframes and the View Transitions API first; **Motion** (`motion`
   package, `motion/react`) for FLIP lists, odometer and gesture-driven pieces. No other animation
   library, no Lottie, no canvas/WebGL backgrounds.

## 6. Quality floor

v1's floor, re-measured on the dark palette: text ≥ 4.5:1 (every pair in §1 computed ≥ 6.6:1), chip and
input borders ≥ 3:1; focus ring 2px `--color-accent` with 2px offset, drawn in `--dur-instant`; keyboard
reachable in reading order; no colour-only or motion-only meaning; tables become stacked label/value rows
at 390 with no horizontal scroll; no layout shift; avatar alt = login; third-party hosts only as
`guard:design` allows.

## 7. How the reviewer checks it

Per page and state in the fence, at **1280 and 390**:

1. **Screenshots** of the settled state (`.devos/screens/`).
2. **Motion filmstrip:** frames at 0, 80, 160, 320 and 640 ms after the trigger (first paint, and each
   interaction the fence names), so timing and order are visible in still images.
3. **Reduced-motion screenshot** of the same state, proving equal meaning.
4. **Layout-shift value** from Playwright (`PerformanceObserver` `layout-shift`) = 0.

Then the design ledger (seven rows): hierarchy · consistency with this document · accessibility ·
responsiveness · craft · **motion** (purpose test, tokens, once-only, reduced motion) · **truthfulness**.
A correct page that fails the ledger does not pass. The owner's look at the deployed page is the final
check of motion *feel* at each UI gate.

## 8. Do / Don't

- Do animate arrivals, changes, moves, waits and staleness. Don't animate anything else.
- Do keep one accent (coral) and let status colours carry state. Don't add a second accent or gradients
  outside the sign-in and empty-portfolio atmosphere.
- Do roll a number between two real values. Don't count up from zero or animate an estimate.
- Do play entrances once. Don't replay them on refresh, polling or navigation back.
- Do design loading, empty, error, stale and offline states with their own motion. Don't use a lone
  spinner.
- Do say origin and age beside every fact. Don't let motion stand in for a word.
