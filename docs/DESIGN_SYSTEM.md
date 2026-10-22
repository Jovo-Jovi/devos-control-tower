# TOWER — Design system v3 ("Energy-blade control tower")

**Status:** approved **direction** (OD-08, DRAFT until the owner merges the intake PR of issue #13; OD-06 A1
for v2). **v3.1** amendments to §1, §3, §5, §9 and §10 (the owner's art): OD-09, DRAFT until the owner merges the
intake PR of issue #18. The **sharp globe** amendments to §3, §5.2, §5.10, §9 and §10 (a per-pixel sphere replaces
the displacement filter): OD-10, DRAFT until the owner merges the intake PR of issue #35. Precedence 8. Supersedes v2 ("Night-shift control room"). The approved design folder
`docs/design/v3/` (README, mockup, assets, screens) ranks with this file. Where this file says "README §n", that
section of `docs/design/v3/README.md` is binding as written; where the two differ, **this file holds**, because it
records the intake decisions (§1 font names, §3 image location, §10 sizes). Each UI fence carries a Design
specification that refines this direction for its pages and states; the reviewer verifies screenshots **and
motion filmstrips in both themes** against both. `guard:design` applies unchanged (logical properties only, tokens
only, no raw colour or px outside `src/styles/tokens.css`); durations and easings outside the tokens are a review
finding until the guard checks them.

Nothing is copied from a film, game or brand: the scene, tower, planet and textures are original. No character,
ship, logo or title of any franchise appears, and none may be added. v2's references (Raycast as catalogued by
Refero Styles, the prompt-motion.com gallery) stay what they were: inspiration, never copied.

## 0. Idea

A control tower that stands in a world which turns from day to night. **Light** is a bright sky with drifting
clouds, white spires and azure energy; **dark** is a crimson night with stars, a lit horizon and red energy. Every
project is a card around the tower, joined to it by a **light blade** whose look tells the state of that link.

Three rules carry over from v1 and v2 unchanged and outrank everything below:

1. **Truthfulness.** Every fact shows its origin (reported · observed · verified · imported) and its age.
   `unavailable` is `—` with a legend, never `0`. No progress claim the data lacks.
2. **Meaning never by colour alone** — words and shape first, colour and motion support them.
3. **Motion never lies.** A number never counts up from 0 to a value it did not pass through; a bar never grows
   past what is known; a "live" mark, a particle or a hum appears only while the Tower's poll is answering.

## 1. Tokens (`src/styles/tokens.css` — the only file with raw values)

Two themes, one set of names (v2's kept, so components do not change). `:root` is **light**; the dark values are
declared twice, for **Auto** under `prefers-color-scheme: dark` and for the switch's `data-theme="dark"`; with
`data-theme="light"` the `:root` values hold. The UI tokens change at once; the scene and the planet carry the
transition (§5 A). Scene colours are not themed: both scenes are always drawn, and `--scene-light` /
`--scene-dark` (0 or 1) choose which one shows. The font variables are `--font-inter` and `--font-geist-mono`
(the `next/font` variables), so `--font-mono` no longer refers to itself (carry-forward (d) of
`docs/reviews/T03-a1.md`).

```css
:root {
  color-scheme: light;

  /* theme position (0 or 1): the scene's layers follow it */
  --scene-light: 1;
  --scene-dark: 0;

  /* surfaces and ink: light */
  --color-canvas: #eef4fb;        /* page ground under the scene */
  --color-paper: #eef4fb;         /* v1 name kept: alias of canvas */
  --color-surface: #f7f9fc;       /* solid fallback for --glass */
  --color-raised: #ffffff;        /* inputs, popovers, detail panel */
  --color-badge: #e6edf5;         /* neutral chip fill */
  --color-line: #d8e2ee;          /* hairlines */
  --color-line-strong: #66748a;   /* chip and input borders */
  --color-ink: #13202f;           /* text */
  --color-ink-muted: #4c5a6a;     /* secondary text */
  --color-ink-faint: #8693a2;     /* non-text marks only */
  --color-accent: #0d57bf;        /* links, focus ring */
  --color-accent-ink: #ffffff;
  --color-accent-wash: #e3edfb;
  --color-action: #13202f;        /* primary button fill */
  --color-action-ink: #ffffff;
  --color-energy: #2f8cff;        /* blade edge, seam, LEDs, glows: never text */
  --color-energy-core: #ffffff;   /* blade core, particles */
  --color-energy-wash: rgb(47 140 255 / 0.16);

  /* step status: text on tinted bg */
  --color-started: #0b5cad;  --color-started-bg: #e3eefb;
  --color-revise: #6b3fbf;   --color-revise-bg: #eee7fb;
  --color-pass: #136b41;     --color-pass-bg: #e3f3ea;
  --color-skipped: #55524c;  --color-skipped-bg: #ecebe7;
  --color-waiting: #865600;  --color-waiting-bg: #fbf0d2;
  --color-fail: #b3261e;     --color-fail-bg: #fbe9e6;
  --color-stale: #7a4806;    --color-stale-bg: #fbeedd;

  /* origin (shape carries the meaning) */
  --color-origin-verified: #13202f;
  --color-origin-imported: #66748a;

  /* glass and elevation */
  --glass: rgb(255 255 255 / 0.55);
  --glass-strong: rgb(255 255 255 / 0.82);
  --edge: inset 0 1px 0 rgb(255 255 255 / 0.95), 0 0 0 1px rgb(30 123 255 / 0.16);
  --edge-hover: inset 0 1px 0 rgb(255 255 255 / 0.95), 0 0 0 1px rgb(30 123 255 / 0.32);
  --lift: 0 14px 36px rgb(19 32 47 / 0.12), 0 2px 6px rgb(19 32 47 / 0.06);

  /* tower map: light */
  --track: rgb(19 32 47 / 0.1);
  --hatch: rgb(19 32 47 / 0.2);
  --tower-1: #ffffff;
  --tower-2: #c3d1e3;
  --module: rgb(255 255 255 / 0.72);
  --slot: #d3dde9;

  /* planet position: light */
  --planet-turn-x: 0px;
  --planet-crimson-mask-position: 300px -90px;
  --planet-atmo-opacity: 1;

  /* scene colours (not themed) */
  --scene-night-star: #ffffff;
  --scene-star-dim: 0.25;

  /* planet layers (not themed) */
  --planet-shade: radial-gradient(circle at 36% 30%, rgb(255 255 255 / 0.22), transparent 30%), radial-gradient(circle at 50% 50%, transparent 55%, rgb(0 0 0 / 0.28) 76%, rgb(0 0 0 / 0.62) 100%);
  --planet-atmo: radial-gradient(circle, transparent 64%, rgb(170 210 255 / 0.18) 68%, rgb(190 222 255 / 0.55) 71%);
  --planet-glow-day: 0 0 0 1px rgb(255 255 255 / 0.35), 0 0 36px rgb(150 195 255 / 0.65), 0 0 110px rgb(150 195 255 / 0.3);
  --planet-glow-night: 0 0 0 1px rgb(255 90 90 / 0.22), 0 0 36px rgb(255 43 43 / 0.32), 0 0 120px rgb(255 43 43 / 0.16);
  --mask-planet-crimson: radial-gradient(circle, #000 0 46%, transparent 54%);

  /* geometry: scene, planet, shell */
  --cloud-texture-ratio: 1.7778;   /* the cloud tiles keep sky-clouds.webp's 2048×1152 ratio */
  --cloud-far-block: 68;           /* the far cloud layer, % of the cloud band */
  --planet-size: 340px;
  --planet-tile-inline: 680px;
  --planet-tile-block: 340px;
  --planet-inset-block-start: 34px;
  --planet-inset-inline-end: 4%;
  --planet-phone-scale: 0.62;
  --planet-crimson-mask-size: 520px;
  --sidebar-inline-size: 220px;
  --shell-max: 1500px;
  --nav-bar: 3px;

  /* geometry: tower map (T05) */
  --map-inline-size: 1200px;
  --map-block-size: 660px;
  --map-scale-1: 0.86;
  --map-scale-2: 0.74;
  --map-scale-3: 0.66;
  --map-card-inline-size: 288px;
  --tower-inline-size: 172px;
  --tower-block-size: 444px;
  --blade-glow: 12px;
  --blade-glow-blur: 5px;
  --blade-edge: 3.2px;
  --blade-core: 1.2px;
  --blade-off: 1.6px;
  --blade-draw: 460;
  --dash-waiting: 3 7;
  --dash-gate: 12 6;
  --dash-down: 4 6;
  --dash-stale: 1 8;
  --dash-silent: 1 6;

  /* space (8-based, v1 names kept) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 80px;

  --radius-1: 6px;   /* chips */
  --radius-2: 8px;   /* inputs, buttons */
  --radius-3: 16px;  /* cards, sidebar, top bar */
  --radius-pill: 9999px;
  --blur-glass: 20px;

  --font-body: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
  --text-0: 0.6875rem; --text-1: 0.8125rem; --text-2: 0.9375rem; --text-3: 1.25rem;
  --text-4: 1.5rem;    --text-5: 2rem;      --text-6: 3.5rem;
  --leading: 1.5; --leading-tight: 1.15;
  --tracking-title: 0.02em;
  --tracking-eyebrow: 0.08em;

  --content-max: 1200px;

  /* motion: see §5. Durations and easings live only here. */
  --dur-instant: 90ms;    /* press, toggle, focus */
  --dur-quick: 160ms;     /* hover, chip state change, tooltip, reduced-motion tint */
  --dur-base: 240ms;      /* enter/exit of a component */
  --dur-slow: 420ms;      /* page-level choreography, shared element, bars */
  --dur-ambient: 2400ms;  /* live pulse, skeleton sheen, waiting pulse; loops only */
  --dur-scene: 1800ms;    /* the theme switch: scene and planet (amendment A) */
  --stagger: 40ms;        /* per item in a list entrance; total capped at 320ms */
  --dur-planet-spin: 120s;
  --dur-scene-drift: 60s;
  --dur-twinkle-1: 3.1s;  --delay-twinkle-1: -0.7s;
  --dur-twinkle-2: 4.2s;  --delay-twinkle-2: -2.3s;
  --dur-twinkle-3: 5.4s;  --delay-twinkle-3: -3.9s;
  --dur-twinkle-4: 6.8s;  --delay-twinkle-4: -5.6s;
  --dur-ignite: 720ms;
  --stagger-ignite: 70ms;
  --dur-particle-active: 1500ms;
  --dur-particle-steady: 2600ms;
  --dur-particle-revise: 3400ms;
  --dur-particle-waiting: 8000ms;
  --dur-tile-flash: 650ms;
  --dur-signal: 620ms;
  --dur-module-flash: 520ms;
  --delay-module-flash: 560ms;
  --stagger-signal: 120ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* entrances: fast start, soft landing */
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);       /* exits */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* moves, morphs, the theme switch */
  --ease-spring: linear(0, 0.36 9%, 0.84 22%, 1.04 33%, 1.01 45%, 1 100%); /* settles with a hint of overshoot */
  --rise: 8px;            /* entrance travel distance */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --scene-light: 0;
    --scene-dark: 1;
    --color-canvas: #050507;
    --color-paper: #050507;
    --color-surface: #0e0a0c;
    --color-raised: #181113;
    --color-badge: #21171a;
    --color-line: #2a1c1e;
    --color-line-strong: #75605f;
    --color-ink: #f4f1ee;
    --color-ink-muted: #aaa3a1;
    --color-ink-faint: #6f6766;
    --color-accent: #ff6b62;
    --color-accent-ink: #0e0a0c;
    --color-accent-wash: #452324;
    --color-action: #e6e6e6;
    --color-action-ink: #0e0a0c;
    --color-energy: #ff2b2b;
    --color-energy-core: #fff0ee;
    --color-energy-wash: rgb(255 43 43 / 0.16);
    --color-started: #63a1ff;  --color-started-bg: #0c1a33;
    --color-revise: #b69cff;   --color-revise-bg: #1d1631;
    --color-pass: #59d499;     --color-pass-bg: #0e2419;
    --color-skipped: #a1a1aa;  --color-skipped-bg: #18181b;
    --color-waiting: #f5c451;  --color-waiting-bg: #2a2108;
    --color-fail: #ff7a6e;     --color-fail-bg: #2a1211;
    --color-stale: #e0a458;    --color-stale-bg: #261a0b;
    --color-origin-verified: #f4f1ee;
    --color-origin-imported: #8a8380;
    --glass: rgb(16 11 13 / 0.58);
    --glass-strong: rgb(24 16 18 / 0.86);
    --edge: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 0 0 1px rgb(255 59 59 / 0.22);
    --edge-hover: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 0 1px rgb(255 59 59 / 0.4);
    --lift: 0 18px 44px rgb(0 0 0 / 0.6), 0 0 24px rgb(255 43 43 / 0.06);
    --track: rgb(255 255 255 / 0.1);
    --hatch: rgb(255 255 255 / 0.2);
    --tower-1: #2a1c1e;
    --tower-2: #050405;
    --module: rgb(255 255 255 / 0.04);
    --slot: #2c2022;
    --planet-turn-x: -340px;
    --planet-crimson-mask-position: -90px -90px;
    --planet-atmo-opacity: 0.25;
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --scene-light: 0;
  --scene-dark: 1;
  --color-canvas: #050507;
  --color-paper: #050507;
  --color-surface: #0e0a0c;
  --color-raised: #181113;
  --color-badge: #21171a;
  --color-line: #2a1c1e;
  --color-line-strong: #75605f;
  --color-ink: #f4f1ee;
  --color-ink-muted: #aaa3a1;
  --color-ink-faint: #6f6766;
  --color-accent: #ff6b62;
  --color-accent-ink: #0e0a0c;
  --color-accent-wash: #452324;
  --color-action: #e6e6e6;
  --color-action-ink: #0e0a0c;
  --color-energy: #ff2b2b;
  --color-energy-core: #fff0ee;
  --color-energy-wash: rgb(255 43 43 / 0.16);
  --color-started: #63a1ff;  --color-started-bg: #0c1a33;
  --color-revise: #b69cff;   --color-revise-bg: #1d1631;
  --color-pass: #59d499;     --color-pass-bg: #0e2419;
  --color-skipped: #a1a1aa;  --color-skipped-bg: #18181b;
  --color-waiting: #f5c451;  --color-waiting-bg: #2a2108;
  --color-fail: #ff7a6e;     --color-fail-bg: #2a1211;
  --color-stale: #e0a458;    --color-stale-bg: #261a0b;
  --color-origin-verified: #f4f1ee;
  --color-origin-imported: #8a8380;
  --glass: rgb(16 11 13 / 0.58);
  --glass-strong: rgb(24 16 18 / 0.86);
  --edge: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 0 0 1px rgb(255 59 59 / 0.22);
  --edge-hover: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 0 1px rgb(255 59 59 / 0.4);
  --lift: 0 18px 44px rgb(0 0 0 / 0.6), 0 0 24px rgb(255 43 43 / 0.06);
  --track: rgb(255 255 255 / 0.1);
  --hatch: rgb(255 255 255 / 0.2);
  --tower-1: #2a1c1e;
  --tower-2: #050405;
  --module: rgb(255 255 255 / 0.04);
  --slot: #2c2022;
  --planet-turn-x: -340px;
  --planet-crimson-mask-position: -90px -90px;
  --planet-atmo-opacity: 0.25;
}
```

`docs/DESIGN_SYSTEM.md` §1 is the source of these values; the task that lands them copies the block above byte
for byte. A later task that needs a new raw value appends it **after** this block in `tokens.css`, under a comment
naming the task, and never redefines a name above; its fence states the additions and the reviewer checks them.

**v3.1 (OD-09, the owner's art, README §3.4 and §14).** The block above is the v3.1 block. Against the v3 block
that T04 landed it removes the tokens of the procedural layers (the skylines, window lights, cloud layer and
ground: `--scene-day-*`, `--scene-night-far*`, `--scene-night-near*`, `--scene-night-window`,
`--scene-night-ground`, `--mask-sky-clouds`, `--scene-block-size`, `--scene-cloud-tile-*`, `--dur-sky-clouds`; the
night disc, lights and rim of the planet: `--planet-night`, `--planet-night-x`, `--planet-night-scale`, `--planet-rim`,
`--mask-planet-lights`, `--planet-lights-*`, `--dur-planet-lights`, `--dur-planet-rim`, `--delay-planet-rim`, and the
two strip speeds `--dur-planet-land`, `--dur-planet-clouds`). It adds the crimson globe's mask
(`--mask-planet-crimson`, `--planet-crimson-mask-size`, `--planet-crimson-mask-position` per theme: off the planet
in light, covering it in dark), one spin speed (`--dur-planet-spin`, one 680 px tile per 120 s) and the day plate's
slow scale (`--dur-scene-drift`, `--scene-drift-scale`). The dark atmosphere is 25 % (`--planet-atmo-opacity`). The
task that lands v3.1 (T11) replaces the leading block of `tokens.css` with this one; the T05 additions after it stay.

Contrast (WCAG relative luminance, computed at intake with the README §1 method: the glass composited over the
canvas and over the darkest scene colour behind a card — light `#c4d4e7` and `#a7c7ee`, dark `#3d070a`): light ink
12.98, muted 5.56, accent 5.28, line-strong 3.74; dark ink 16.73, muted 7.58, accent 6.75, line-strong 3.22.
Status text on its own background: light 5.53 (waiting) to 6.66 (stale); dark 6.66 (started) to 9.77 (waiting).
Accent-ink on accent: light 6.70, dark 7.06; action-ink on action: light 16.47, dark 15.76. The task that lands §1
recomputes every pair in a unit test and the reviewer reads the result. The reference backdrops stay as stated under
v3.1 (the unit test does not change); the owner's plates sit behind the glass, and their readability is judged on the
screenshots in both themes (§7, the accessibility row of the ledger).

## 2. Type

- **Inter** 400/500/600/700 for text (`--font-inter`), **Geist Mono** 400/500 for ids, shas, run keys, seq,
  counts, times and eyebrows (`--font-geist-mono`), both through `next/font/google` (self-hosted at build).
- Scale: display `--text-6` 500 (sign-in only) · page title `--text-5` 700 with `--tracking-title` · section
  `--text-3` 600 · body `--text-2` · table and chip `--text-1` · meta (age, origin, alias) `--text-0` · eyebrow
  `--text-0` mono uppercase, `--tracking-eyebrow`.
- Numbers: `tabular-nums`, right-aligned, `Intl.NumberFormat`; missing = `—`.
- Times: relative in text ("4 min ago"), absolute ISO in `title` and in mono table columns. Relative ages
  re-render every 30 s without moving the layout.

## 3. Components

All v1/v2 components keep their meaning; v3 changes their look to glass on the scene and adds the shell, the scene
and the map. Glass = `--glass` with `backdrop-filter: blur(var(--blur-glass)) saturate(1.6)` and `--edge`,
`--lift`; without `backdrop-filter` support it falls back to `--color-surface`.

| Component | Look | Motion (tokens from §1, rules from §5) |
|---|---|---|
| `Scene` | README §3, §14 and §15 (v3.2): the owner's plates `bg-day` and `bg-night` (landscape; the `-portrait` pair at ≤ 760 px), each filling the fixed layer with `background-size: cover` anchored at the bottom centre. Day clouds are a separate transparent layer over the day plate and under the night plate. Night keeps the owner's Milky Way plate still; a canvas starfield and a faint horizon mist sit above it. `aria-hidden`, `pointer-events: none`, behind every page | the two plates crossfade by opacity (`--scene-light`/`--scene-dark`) over `--dur-scene`; clouds and mist drift by `transform` only; stars twinkle and drift on the canvas. The day plate does not scale |
| `Planet` | README §3.4 (v3.1): the day globe (`planet-day`) and the crimson globe (`planet-crimson`, inside the `--mask-planet-crimson` disc), each drawn as a sphere by `PlanetGlobe` (OD-10): a canvas whose backing store is its rendered size × `devicePixelRatio`, sampling the 2048×1024 strip per device pixel (WebGL; without WebGL a still 2D drawing; until its first frame the strip shows flat), then shade and atmosphere; top end corner; × `--planet-phone-scale` at ≤ 760 px | the switch turns both globes half a turn while the mask disc sweeps across (`mask-position`, `--dur-scene`), so the crimson night side rolls over; one spin loop (`--dur-planet-spin`) per §5 B. The spin and turn stay CSS (`.spin`, `.turn`); the canvas reads their `translateX` every frame, so timing, reduced motion and the hidden pause are the CSS ones. Reduced motion or no WebGL: a still globe in its theme's position; glow = two layers crossfading by opacity, never an animated shadow |
| `ThemeSwitch` (new) | segmented **Auto · Light · Dark**, `aria-pressed`, in the top bar; on the sign-in pages (no top bar) centred at the page's block-end foot, outside the card (OD-11) | the pressed segment's wash moves `--dur-quick`; the theme itself changes at once (§5 A) |
| `AppSidebar` (new) | README §2: glass, product mark, "DEV_OS", links to routes that exist only; current link `--color-energy-wash` + `--nav-bar` energy bar at the start edge; a strip above the content at ≤ 980 px | none |
| `AppHeader` (top bar) | glass, "Control Tower", `LiveMark` (from T05), `ThemeSwitch`, avatar (alt = login), login in `<bdi>`, sign-out | none |
| `LiveMark` | 6 px energy dot + "live" word **while the latest poll of `/api/projects` answered 200**; "offline" and a faint dot otherwise (the browser never calls Supabase, `DATA_MODEL.md` §1; carry-forward (c) of `docs/reviews/T03-a1.md`) | ambient pulse (`--dur-ambient`) while live; none offline |
| `StatusChip` | tinted pill `--radius-1`, word first (`verdict · pass`) | crossfade + one-frame tint flash (`--dur-quick`); `started` breathing dot (`--dur-ambient`) |
| `OriginChip` | reported outlined · observed dotted · verified filled ink · imported filled grey; always the word | becoming verified = the outline fills from the start edge (`--dur-base`) |
| `AgeText`, `FreshnessLabel`, `HealthBanner`, `StateBlock`, `Counter`, `Bar`, `Toast`, `OwnerForm`, `EvidenceLink`, `Timeline`/`EventRow`, `UsageTable`/`CoverageLine`, `ImportResult` | as v2, on glass; `StateBlock` loading = hairline skeletons with a sheen | as v2 |
| Tower map (T05): tower, project card, blade, detail panel, filter, list, phone tower card, counts card, Tower panel, System overview, Recent activity, Ingestion health | README §4–§7 | README §4.3–§4.4 and §5 below |

## 4. Compositions and their choreography

Every page has a first-paint choreography (≤ `--dur-slow` + 320 ms of stagger), designed states, and transitions
between them, in **both themes**. Route changes use the View Transitions API with a crossfade + `--rise` default.

- **4.1 Shell (T04).** README §2. `/` shows the shell and the page head (eyebrow "Discover · Monitor · Trace ·
  Verify", `h1` "Overview", one sentence); T05 adds the counts card and the map under it.
- **4.2 Sign-in `/sign-in` (T04 look, T09 retrofit).** T04: the scene and planet behind T01's card, which becomes
  glass; nothing else changes. T09: v2's §4.1 states and choreography (first paint, redirecting "Opening
  GitHub…", "Checking your access…" on `/auth/callback`, the shared product mark, denied nudge, error hairline,
  signed-out crossfade), with the scene and planet as the atmosphere instead of v2's gradients.
  OD-11 (T13): every state carries the `ThemeSwitch` at the page foot, outside the card; the card's size, place and
  choreography do not change, and nothing is stored.
- **4.3 Overview `/` as the tower map (T05).** README §4 (map ≥ 761 px, tower, up to eight nodes, blades and link
  states, ignition, live changes, filters and list, phone ≤ 760 px), §5 (panels), §6 (values, all from existing
  tables) and §7 (states: loading, map, list, selected, empty, error, offline, reduced motion; each in both themes).
  The sidebar gains **Register project** (`/projects/new`) when T05 creates that route.
- **4.4 Register `/projects/new` (T05).** `OwnerForm` (key, repository, stale window) on glass. Submit → pending
  morph → success toast + navigation to `/`. Invalid → field nudge + error text.
- **4.5 Project `/projects/[key]` (T07), Usage `/projects/[key]/usage` (T06), Import `/projects/[key]/import`
  (T10).** v2 §4.4–§4.6 compositions on glass over the scene, in both themes.
- **4.6 Not found (T04).** A glass card on the scene: title, one sentence, a link back to `/`.

## 5. Motion rules

v2's rules, with the amendments OD-08 signs (README §8):

1. **Purpose test.** Every animation answers one of: *what just arrived*, *what changed*, *where did it go*, *what
   is waiting*, or *what is stale*. If it answers none, it is removed. The scene loops of B answer "the Tower is
   watching, now" and are bound by B.
2. **Animated properties:** `transform`, `opacity`, `clip-path`, and (amendment **C**) `stroke-dashoffset`,
   `offset-distance` and `mask-position`. `filter` and `box-shadow` are never animated. Static blur is allowed on
   its own elements only: the blades' glow path (v3.1 removes the cloud sea and its SVG blur; OD-10 removes the
   globes' sphere displacement).
3. **Durations from tokens only.** Nothing interactive above `--dur-slow`, except (amendment **A**) the theme
   switch: `--dur-scene` (1.8 s, `--ease-in-out`) for the scene and the planet; it answers *what changed* and blocks
   nothing. Total first-paint choreography ≤ 740 ms.
4. **Never block reading or input.** Content is interactive from its first frame.
5. **Animate once.** Entrances play on first view of a document; refreshes, polls and returns never replay them.
6. **Loops (amendment B).** Allowed loops: `LiveMark`, `started`, skeleton sheen (v2), and the scene's: planet
   spin, cloud drift, horizon-mist drift, star twinkle, blade hum and particles, module LEDs, the seam beam. The day plate does not scale (v3.2). All are slow and
   low-contrast, and **all stop** under `prefers-reduced-motion: reduce` and while `document.visibilityState` is
   `hidden`. (README §8 B also names an in-app "Reduce motion" control; §2 places none, so the system setting
   governs: OD-08 "Does not decide".)
7. **Reduced motion (amendment E).** The theme switches instantly; the planet stands still in its theme's position;
   blades are drawn, static, without particles or hum; signals become a `--dur-quick` tint on the card; entrances
   become an opacity crossfade of `--dur-quick` or nothing; meaning is unchanged.
8. **Gradients and the second accent (amendment D).** One **text** accent (`--color-accent`), one **energy** colour
   for light only (never text); gradients only in the scene, the tower and the planet.
9. **Performance:** README §9 — 60 fps, LCP < 2.5 s on production, no layout shift from animation (0 in the
   evidence), images after the first paint, every loop paused when hidden.
10. **Library:** CSS transitions/keyframes and the View Transitions API first; **Motion** (`motion`,
    `motion/react`) for FLIP, odometer and gesture-driven pieces. No other animation library and no Lottie.
    The canvases are the night starfield (`Starfield`) and the two globes (`PlanetGlobe`, OD-10): they draw
    with `requestAnimationFrame`, not React state, and they are still under reduced motion and stop while
    hidden. WebGL only in `PlanetGlobe` (WebGL 1, no library); nowhere else.

## 6. Quality floor

v2's floor, in **both themes**: text ≥ 4.5:1 and chip/input borders ≥ 3:1 on the glass over the canvas and over the
darkest scene colour behind it (§1 backdrops); focus ring 2 px `--color-accent` with 2 px offset; keyboard reachable
in reading order; no colour-only or motion-only meaning; at 390 no horizontal scroll (the scene is clipped to the
viewport); no layout shift; avatar alt = login; third-party hosts only as `guard:design` allows (fonts are
self-hosted by `next/font` at build).

## 7. How the reviewer checks it

Per page and state in the fence, at **1280 and 390**, in **light and dark**:

1. Screenshots of the settled state (`.devos/screens/`).
2. Motion filmstrip at 0, 80, 160, 320, 640 ms after the trigger (first paint and each named interaction).
3. **Theme-switch filmstrip** at 0, 450, 900, 1350, 1800 ms after pressing the switch, light → dark and back.
4. Reduced-motion screenshot of the same state, proving equal meaning.
5. Layout-shift value = 0.
6. The contrast of §1, recomputed.

Then the design ledger (seven rows): hierarchy · consistency with this document and `docs/design/v3/` ·
accessibility · responsiveness · craft · **motion** (purpose test, tokens, once-only, loops stop, reduced motion) ·
**truthfulness**. A correct page that fails the ledger does not pass. The owner's look at the deployed page is the
final check of motion feel at each UI gate.

## 8. Do / Don't

- Do let the scene carry the theme change. Don't animate the UI's colours.
- Do keep one text accent and let status colours carry state; energy is for blades, seams and glows. Don't put
  energy on text or add gradients outside the scene, tower and planet.
- Do stop every loop under reduced motion and while hidden. Don't add a loop that answers no §5 question.
- Do roll a number between two real values. Don't count up from zero or animate an estimate.
- Do show particles only while the poll answers. Don't let them stand for real traffic.
- Do say origin and age beside every fact. Don't let motion or light stand in for a word.

## 9. Images

The scene's images are bundled with the code, not served from `public/`: every path outside `/_next/`, `/api/`
and the sign-in and auth routes is behind the sign-in proxy (`src/proxy.ts`), so a `public/scene/` file could not
reach `/sign-in` without a proxy change. They live in `src/components/scene/assets/` under the baseline names and
are referenced from the scene's CSS modules, so they are served from `/_next/static/media/`.

**v3.2.** The bundled plates are the owner's JPEG files, copied byte for byte from `docs/design/v3/assets/v3.2/`
(README §15). Night is that file unchanged, Milky Way included. Day is the same file; its clouds in the open
sky are a separate transparent texture, `sky-clouds.webp`, also kept in `assets/v3.2/`. The old v3.1 WebP plates
leave `src/components/scene/assets/`. **OD-10:** the globe strips become the v3.2 strips at 2048×1024 (README §15,
byte for byte from `assets/v3.2/`), drawn per device pixel by `PlanetGlobe`; `planet-sphere-map.png` and the
`feDisplacementMap` filter leave the bundle. Every bundled scene file now comes from `assets/v3.2/`.

| File | Size | Alpha | Seamless in x | Bytes | Role |
|---|---|---|---|---|---|
| `bg-day.jpg` | 2560×1440 | no | no | 367 325 | day plate, > 760 px (cover, bottom centre) |
| `bg-night.jpg` | 2560×1440 | no | no | 882 525 | night plate, > 760 px; Milky Way stays still |
| `bg-day-portrait.jpg` | 1440×2560 | no | no | 421 534 | day plate, ≤ 760 px |
| `bg-night-portrait.jpg` | 1440×2560 | no | no | 762 660 | night plate, ≤ 760 px |
| `sky-clouds.webp` | 2048×1152 | yes | soft edge fade | 440 388 | day cloud layer, two speeds, under the night plate |
| `planet-day.webp` | 2048×1024 | no | yes | 567 430 | day globe strip, clouds baked in (one turn = the strip's width) |
| `planet-crimson.webp` | 2048×1024 | no | yes | 406 100 | crimson night globe strip, city lights screened on |

Budget: the seven files together at most 3 847 962 bytes, the size of this set (README §15: "the byte budget
becomes the size of this set"; 367 325 + 882 525 + 421 534 + 762 660 + 440 388 + 567 430 + 406 100). **Loading:**
before the first paint only the theme's plate for the viewport (the system theme, since nothing is stored) and that
theme's globe strip load, from CSS rules under `prefers-color-scheme` and the 760 px query; in light, the cloud
texture loads with the day plate. The other theme's plate and strip, and the cloud texture if the first theme is
dark, load after hydration (`:root[data-scene-ready]`); a viewport never loads the other orientation's pair. The
globe renderer takes each strip's URL from its CSS background (the same file, never a second URL), and until its
first frame the strip shows flat under the shade. The map and the page never wait for an image.

**Link preview (OD-11, T14).** One more bundled image, outside the scene set and its budget:
`src/assets/link-preview.jpg`, 1200×630 JPEG, at most 300 000 bytes, captured from `/sign-in` of the production
build in dark with reduced motion by `scripts/site/link-preview.mjs`. The root layout imports it for `og:image`, so it
is served from `/_next/static/media/` like the scene. It is a capture of the real page, never drawn or generated.

## 10. Realistic art (README §13)

The builder (Grok in Cursor) may replace the six non-map images with more realistic art from Cursor's image tool,
under README §13's rules: original prompts only (never a film, game, franchise, character, ship or brand, and no
reference image from one); a check script (exact size, format and alpha as §9; seam and pole checks; the byte
budget) before any image replaces the baseline; the baseline stays when the tool is not available or an image fails
a check, and that never blocks the task; the reviewer looks at every replaced image and at the scene screenshots in
both themes and can keep the baseline for any image that is worse, off-style or not original. The owner can generate
the same images by hand in Cursor's editor with the prompts the task commits, through a pull request; the checks
still apply.

**v3.2.** The owner's plates are bundled byte for byte (README §15). `scripts/scene/art.mjs verify` checks that
set: the seven names of §9 and no other, byte identity with `assets/v3.2/` for every file (OD-10: the globe strips
too; the sphere map is gone), size and format as §9, a seam line for each file seamless in x (the cloud texture and the two strips), and the byte
budget. The night plates are not
regenerated. The cloud texture is a transparent layer; it is not painted into the plates.

## 11. What this system does not decide

README §11: theme persistence (D1: the switch lasts for the open document only, nothing is stored); pages that do
not exist (D2); instances, lifecycle and ledger totals the event contract does not carry (D3); observed-only
repositories (D4). Also: an in-app "Reduce motion" control (§5.6); a guard for durations and easings.
