# TOWER — Design v3 ("Energy-blade control tower")

**Status:** approved by the owner on 2026-10-17 as the look of the Tower (option B of the mockup review),
precedence 8 with `docs/DESIGN_SYSTEM.md`. It becomes binding when intake turns it into `DESIGN_SYSTEM.md` v3
and a signed OD (change request "Design v3", see §12). Until then `DESIGN_SYSTEM.md` v2 binds every fence.

This folder holds:

| Path | What it is |
|---|---|
| `README.md` | this specification |
| `mockup/tower-map.dc.html` | the approved mockup's source (a Design-canvas component, **reference only**: it does not run outside the canvas; its CSS values and geometry are the reference) |
| `assets/planet-land.webp` · `planet-clouds.webp` · `planet-lights.webp` | the planet's surface, cloud and night-lights strips (1360×680, equirectangular, seamless in x; shown at 680×340) |
| `assets/planet-sphere-map.png` | the 340×340 displacement map that bends the moving strip into a sphere (§3.4); lossless on purpose |
| `assets/sky-day.jpg` · `sky-night.jpg` · `sky-clouds.webp` | the full-sky backdrops: day gradient with sun, night starfield with star band and crimson nebula, and the drifting cloud layer (3200×1100, alpha, seamless in x) |
| `tools/gen-planet.py` · `tools/gen-sky.py` | the generators of these images (Python 3, numpy, Pillow; `python3 <tool> <out-dir>`, then WebP at quality 82); deterministic seeds |
| `screens/scene-day.png` · `scene-switch-900ms.png` · `scene-night.png` | the whole scene at 1440×900 (empty glass boxes in place of the cards) before, during and after the switch |
| `screens/planet-day.png` · `planet-switch-900ms.png` · `planet-night.png` | the planet alone through the same switch |

These images are the **procedural baseline**. §13 replaces them with Grok-generated art when that is better.

Nothing here is copied from a film, game or brand: the scene, tower, planet and textures are original and
procedural. No character, ship, logo or title of any franchise appears, and none may be added.

## 0. Idea

A control tower that stands in a world which turns from day to night. **Light** is a bright sky with drifting
clouds, white spires and azure energy; **dark** is a crimson night with stars, a lit horizon and red energy.
Every project is a card around the tower, joined to it by a **light blade**, a glowing conduit whose look
tells the state of that link. v2's three rules (truthfulness, never colour alone, motion never lies) stay
above everything here.

## 1. Themes and tokens

Two themes, one set of token names (v2's names kept, so components do not change). `src/styles/tokens.css`
stays the only file with raw values; it declares:

- `:root` = **light**, `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` = **dark**,
  `:root[data-theme="dark"]` = dark, `:root[data-theme="light"]` = light. `color-scheme` follows.
- Default is **Auto** (the system setting). The header switch sets `data-theme` on `<html>` for the session.
  **It is not persisted**: `BOUNDARY_MODEL.md` forbids browser storage beyond the Auth cookie (see §11, D1).

| Token (v2 name) | Light | Dark | Role |
|---|---|---|---|
| `--color-canvas` | `#eef4fb` | `#050507` | page ground under the scene |
| `--color-surface` | `#f7f9fc` | `#0e0a0c` | solid fallback for `--glass` (no `backdrop-filter`) |
| `--color-raised` | `#ffffff` | `#181113` | inputs, popovers, detail panel |
| `--glass` | `rgb(255 255 255 / .55)` | `rgb(16 11 13 / .58)` | cards, sidebar, top bar (+ `--blur-glass`) |
| `--glass-strong` | `rgb(255 255 255 / .82)` | `rgb(24 16 18 / .86)` | detail panel, tower plates, pressed segments |
| `--color-line` | `#d8e2ee` | `#2a1c1e` | hairlines |
| `--color-line-strong` | `#66748a` | `#75605f` | chip and input borders |
| `--color-ink` | `#13202f` | `#f4f1ee` | text |
| `--color-ink-muted` | `#4c5a6a` | `#aaa3a1` | secondary text |
| `--color-ink-faint` | `#8693a2` | `#6f6766` | non-text marks only |
| `--color-accent` | `#0d57bf` | `#ff6b62` | links, focus ring |
| `--color-energy` | `#2f8cff` | `#ff2b2b` | blade edge, seam, LEDs, glows — **never text** |
| `--color-energy-core` | `#ffffff` | `#fff0ee` | blade core, particles |
| `--color-energy-wash` | `rgb(47 140 255 / .16)` | `rgb(255 43 43 / .16)` | selected nav, pressed segment glow |
| `--edge` | `inset 0 1px 0 rgb(255 255 255 / .95), 0 0 0 1px rgb(30 123 255 / .16)` | `inset 0 1px 0 rgb(255 255 255 / .06), 0 0 0 1px rgb(255 59 59 / .22)` | card edge |
| `--lift` | `0 14px 36px rgb(19 32 47 / .12), 0 2px 6px rgb(19 32 47 / .06)` | `0 18px 44px rgb(0 0 0 / .6), 0 0 24px rgb(255 43 43 / .06)` | card shadow |

Step-status pairs (`--color-<s>` / `--color-<s>-bg`): **dark keeps v2's values unchanged**; light:

| Status | Light text / bg | Contrast |
|---|---|---|
| `started` | `#0b5cad` / `#e3eefb` | 5.68 |
| `revise` | `#6b3fbf` / `#eee7fb` | 5.65 |
| `pass` | `#136b41` / `#e3f3ea` | 5.70 |
| `skipped` | `#55524c` / `#ecebe7` | 6.53 |
| `waiting` | `#865600` / `#fbf0d2` | 5.53 |
| `fail` | `#b3261e` / `#fbe9e6` | 5.57 |
| `stale` | `#7a4806` / `#fbeedd` | 6.66 |

Contrast was computed (WCAG relative luminance) on the glass composited over the canvas and over the darkest
scene colour behind a card (light: `#c4d4e7` spires and `#a7c7ee` sky top; dark: `#3d070a` horizon). Worst
cases: light ink 12.98, muted 5.56, accent 5.28, line-strong 3.74, every status text ≥ 4.95; dark ink 16.73,
muted 7.58, accent 6.75, line-strong 3.22, every status text ≥ 7.23. The reviewer recomputes them.

Scene colours (sky stops, spires, ridge, stars, clouds, horizon glow) are tokens too (`--scene-*`), so
`guard:design` keeps holding: no raw colour outside `tokens.css`. The PNG textures carry their own pixels.

Type stays v2's (Inter, Geist Mono, same scale); the page title is `--text-5` 700 with 0.02em tracking.

## 2. Shell

- **Sidebar** (≥ 981 px): glass, `--radius-3`, product mark (the outlined play triangle with an energy
  glow) and the word "DEV_OS"; links only to routes that exist: **Overview** (`/`) and **Register project**
  (`/projects/new`). The current link has `--color-energy-wash` and a 3 px energy bar at the start edge.
  At ≤ 980 px it becomes a horizontal strip above the content. No link to a page that does not exist.
- **Top bar:** glass; "Control Tower"; `LiveMark` ("live" / "offline", from the poll, v2 §3); the theme
  switch (segmented **Auto · Light · Dark**, `aria-pressed`); avatar with alt = login. Sign-out stays.
- **Page head:** eyebrow "Discover · Monitor · Trace · Verify", `h1` "Overview", one sentence; counts card
  (§5).

## 3. The scene (behind everything, `aria-hidden`, `pointer-events: none`)

**The scene is fixed to the viewport** (amendment 2026-10-17, the owner's test on a phone): the sky,
skyline, stars, clouds and planet sit in a `position: fixed` layer that covers the whole screen
(`inset: 0`, `block-size: 100lvh` so mobile browser bars never uncover it) and never scrolls, swipes or
bounces with the page; only the content moves over it. Overscroll on the root shows the scene, never a
blank colour. The skyline sits low so the sky dominates.

### 3.1 Light
The `sky-day` backdrop (blue zenith, sun glow, pale horizon) under the `sky-clouds` layer, which covers the
whole sky and pans one tile (3200 px) every 420 s, masked out below 52–72 % of the height so the horizon stays
clear; a far skyline (`#c7d6e8`) and a near skyline of towers, spires and antennas (white gradient, 1.5 px
white rim), lower in the centre where the tower stands; a cloud sea along the horizon.

### 3.2 Dark
The `sky-night` backdrop: stars across the whole sky (denser along a diagonal star band, a few with halos,
three colour temperatures), dark dust lanes, faint crimson nebula, and a crimson glow at the horizon; 28
vector stars on top that twinkle (3–7 s, opacity .25 ↔ 1); the same skylines in near-black with red rims
(`--color-energy` at 18 % far, 42 % near) and about 100 warm window lights.

### 3.3 The switch
Both scenes are present; each layer's opacity follows the theme (`--scene-light` / `--scene-dark` = 0 or 1)
with a **1.8 s `--ease-in-out`** crossfade. Tokens of the UI change at once; the scene and planet carry the
transition. This is the one transition longer than `--dur-slow` (amendment A, §8).

### 3.4 The planet (top end corner, 340 px; on ≤ 760 px scaled to 0.62)

**Amended 2026-10-17 (v3.1): the owner's Grok maps replace the procedural textures.** The owner made one
Earth-like globe with Grok in Cursor as three flat equirectangular maps that line up exactly
(`assets/v3.1/source/planet-day-map.webp`, `planet-night-lights-map.webp`, `planet-clouds-map.webp`; 2:1,
seamless left-right, uniform poles: left/right edge difference 0, 92 % of the city lights on land). From them:

- `assets/v3.1/planet-day.webp` (1360×680): the day map with the clouds baked in, for the light theme;
- `assets/v3.1/planet-crimson.webp` (1360×680): the same surface as a crimson night side (oceans deep red,
  land in red tones, clouds red, the city lights screened on top), for the dark theme;
- `assets/v3.1/planet-sphere-map.png` (340×340): the displacement map regenerated at **scale 300** (the old map at
  200 clipped the polar rows into flat bands); the `feDisplacementMap` `scale` becomes 300.

Layers, back to front, clipped to the circle:
1. **Day globe:** `planet-day.webp` in a `spin` wrapper (one 680 px tile per 120 s, `translateX`) inside a
   `turn` wrapper, through `filter: url(#sphere)`.
2. **Crimson globe:** `planet-crimson.webp` in the same `spin`/`turn` structure and timing, through the same filter,
   inside a mask: a soft disc (`radial-gradient`, 520 px, edge 46 %→54 %) whose `mask-position` sits off the
   planet in light and covers it in dark. The disc's edge is the terminator.
3. **Shade** (specular highlight and limb darkening) and **atmosphere** (bright limb ring, 25 % in dark).

**The switch** (1.8 s, `--ease-in-out`): both `turn` wrappers move half a turn (`translateX(-340px)` in dark)
while the mask disc sweeps across, so the planet turns and its crimson night side rolls over it; back to light
plays it in reverse. The spin continues underneath. Reduced motion: no spin, the theme's side at once.
`screens/v3.1-scene-switch.mp4` shows it (slowed: one frame per screenshot), `screens/v3.1-desktop-*.jpg`
the three states. The procedural strips of v3 (`planet-land`, `planet-clouds`, `planet-lights`) leave the
bundle.

## 4. The tower map (`/`, ≥ 761 px)

A fixed 1200×660 stage (geometry as tokens `--map-*`), centred, scaled down in steps (0.86 ≤ 1460 px, 0.74
≤ 1240 px, 0.66 ≤ 1060 px); below 761 px the map is replaced by §4.6.

### 4.1 Tower (centre)
A stepped crown, a body 172×444 with a cylindrical shade, two side fins, a **vertical energy seam** down the
middle with a beam rising from the crown, the identity plate (play mark, "DEV_OS", "Control Tower"), the
**Tower panel** (§5), eight modules (two columns × four rows) with energy LEDs, and a base with three energy
rings. Module *n* sits at the height of node *n*'s link.

### 4.2 Nodes
Up to **eight** project cards (288 px glass), four each side, in the portfolio's sort order (contact first,
`lastContactAt` descending, then by key). With more than eight projects the eighth slot becomes a "+N more ·
List" card that opens the list. Each card shows, all from data (§6):
- monogram tile, project key in mono, repository in `<bdi>`, a `StatusChip` (word first);
- **execution** of its latest run (§6) — never a machine name;
- **Tasks** bar: verdict-passed of tasks **seen** (`a / b`, label "of seen"); a hatched empty bar with `—`
  when no task was seen;
- **Phase** bar for the latest phase (same rule, the phase id as its label);
- the latest task · step · status in words, `OriginChip`, `AgeText`.

Selecting a card (click, Enter, Space) opens the **detail panel** (glass-strong, end edge): repository link,
execution, tasks, phase, latest step, last fact with origin and age, the project's last six step events by
`seq`, and links to the project page (`/projects/[key]`) and the repository. Other cards drop to 55 %;
filtered-out cards to 30 %. Escape or "Close" closes it.

### 4.3 Blades (one per node, SVG paths fixed per slot)
Layers: a blurred glow path (stroke 12, `feGaussianBlur` 5, static), the edge path (3.2 px,
`--color-energy`), the core path (1.2 px, `--color-energy-core`), a port dot at the tower, and up to three
core-coloured particles (`offset-path`). Each link's look comes from §6's **link state**:

| Link state | Blade | Particles | Hum |
|---|---|---|---|
| `active` (latest status `started`) | full energy, glow 100 % | 3, 1.5 s per trip | yes |
| `steady` (`pass`, `skipped`) | energy, glow 80 % | 2, 2.6 s | yes |
| `revise` | energy, glow 60 % | 1, 3.4 s | yes |
| `waiting` (`waiting`, step ≠ `gate`) | `--color-waiting`, dashed 3 7, slow pulse 2.4 s | 1, 8 s | no |
| `gate` (`waiting` at step `gate`) | `--color-waiting`, dashed 12 6, glow 45 %, static | 0 | no |
| `down` (`fail`) | **blade off**: no glow, no core, 1.6 px `--color-fail` dashed 4 6 | 0 | no |
| `stale` (freshness `stale`) | 1.6 px `--color-ink-faint`, dotted 1 8 | 0 | no |
| `silent` (no step event yet) | 1.6 px `--color-ink-faint`, dotted 1 6 | 0 | no |

**Offline** (the last poll failed): every blade keeps its last look, but particles and hum stop and blades
drop to 50 %, with the words "offline · last known state" under the tower. Particles never stand for real
traffic: they appear only while the Tower is live and say "this link is in this state", which the legend
under the map spells out.

**Ignition:** on first view the solid blades draw from the card to the tower (stroke-dashoffset 460 → 0,
720 ms `--ease-out`, 70 ms stagger) — once per document. A link that changes from a dashed or dotted state
to a solid one ignites again (that is the "discovered / reconnected" moment); solid → `down` switches the
blade off.

### 4.4 Live changes (from a poll that brings a new latest step event for a project)
1. The card's chip changes (v2 `StatusChip`) and its tile flashes once in energy (650 ms).
2. A core-coloured signal travels the blade to the tower (620 ms, `--ease-in`).
3. The matching module flashes (520 ms, 560 ms delay).
4. The activity list (§5) gets the new row at the top (rise, `--dur-base`).
5. Bars move to the new values (`--dur-slow`, `--ease-in-out`), never from 0.
Several changes in one poll: at most **three** signals play, in `received_at` order, 120 ms apart; the rest
update without a signal.

### 4.5 Filters and list
A segmented filter (All · Active · Waiting · At a gate · Failed · Stale or silent, each with its count) dims
cards and blades outside the filter. A **Tower map · List** switch shows the same cards as a responsive grid
(the accessible equivalent of the map, every fact and action included). The list is also what assistive
technology reads: the map's SVG is `aria-hidden`; each card is a real `<button>` with an `aria-label` that
says name, state, tasks, latest step, origin and age.

### 4.6 Phone (≤ 760 px)
No map. A **tower card** (small tower with its seam, Tower state, Projects, Last step event) above the list
of cards; the planet scaled to 0.62 in the top end corner; scene and glass as on desktop.

## 5. Panels (from data that exists)

- **Counts card** (page head) and **Tower panel** (inside the tower): Projects · Fresh · Stale or silent;
  "Last step event received" (age). No "instances": the Tower has no instance identity yet (§11, D3).
- **System overview:** ring = tasks verdict-passed of tasks seen, across projects (`Portfolio.totals`), the
  words "of tasks seen", and counts per link state.
- **Recent activity:** the last six step events across projects by `received_at`: project, task · step ·
  status, `OriginChip`, `AgeText`.
- **Ingestion health** (the Tower itself, not the projects): last step event received; step events in the
  last hour; webhook deliveries in the last 24 h; rejected step events in the last 24 h. No CPU, memory or
  network metric anywhere (none is collected).

## 6. Where every value comes from (no migration, no new table)

All reads through the owner's session (RLS `is_owner()`), as T04's `loadPortfolio()` does, paged.

| Value | Source |
|---|---|
| key, repo, freshness, last activity, last contact, latest step event | T04's `PortfolioProject` |
| latest task, latest phase | the latest step event's `task` and `phase` |
| execution | `runs.source` of the latest step event's run: `ci` → "GitHub Actions", `local` → "Local engine", `import` → "Imported" |
| tasks passed / seen | per project: distinct `task` with a `verdict · pass` / distinct non-null `task` |
| phase passed / seen | the same, restricted to the latest `phase` |
| link state | §4.3 table, from the latest step event and freshness |
| recent activity | `events` ordered by `received_at` desc, 6 rows, with `projects.key` |
| ingestion health | `max(events.received_at)`; count of `events` with `received_at` in the last hour; count of `webhook_deliveries` and of `event_rejections` with `received_at` in the last 24 h |

The aggregation stays pure (`src/lib/portfolio/aggregate.ts` grows the fields above, with unit tests);
`GET /api/projects` answers the larger `Portfolio`. Nothing is estimated: a value the tables cannot give is
`—` with its legend.

## 7. States of `/`

loading (tower drawn, blades dark, cards as hairline skeletons with sheen) · map · list · selected · empty (no
project: the tower alone, blades absent, "No project yet. Register the first one." and the button, rising in)
· error (`HealthBanner`, no number anywhere, blades absent) · offline (§4.3) · reduced motion (§8). Every state
in both themes.

## 8. Motion — amendments to `DESIGN_SYSTEM.md` v2 §5

Kept: purpose test, durations from tokens, once-only entrances, never block reading or input, reduced
motion, no layout shift, `motion` for FLIP and odometer. Amended (the OD of §12 signs these):

- **A. The theme switch** is a 1.8 s transition (`--dur-scene: 1800ms`). It answers *what changed* (the
  owner changed the theme) and blocks nothing.
- **B. Scene ambient loops** join the allowed loops: planet spin, cloud drift, star twinkle, blade hum and
  particles, module LEDs, the seam beam. All are slow and low-contrast, and **all stop** when
  `prefers-reduced-motion: reduce`, when the in-app "Reduce motion" is on, and while
  `document.visibilityState` is `hidden`.
- **C. Animated properties** may include `stroke-dashoffset`, `offset-distance` and `mask-position` (planet
  lights) in addition to `transform`, `opacity` and `clip-path`. `filter` is never animated; the static blur
  and the sphere displacement are allowed on their own elements only (blades, 340 px globe).
- **D. Gradients and the second accent:** the scene and the energy colour are the theme, so v2 §8's "one
  accent, gradients only on sign-in and empty" becomes: one **text** accent (`--color-accent`), one
  **energy** colour for light only, gradients only in the scene, the tower and the planet.
- **E. Reduced motion:** the theme switches instantly; the planet stands still in its theme's position; blades
  are drawn, static, without particles or hum; signals become a 160 ms tint on the card; meaning is unchanged.

## 9. Performance budget

60 fps on a mid-range laptop and phone in both themes; first view under 2.5 s LCP on the production URL;
the scene images total about 1 MB (v3.1: four backgrounds about 0.71 MB, two planet textures about 0.28 MB, the sphere map 15 KB); only the theme's background and planet texture load before the first paint, the rest after it (`loading="lazy"`/`fetchpriority="low"`
or CSS after hydration), the map never waits for them; blurred glows are static; the page pauses every loop
when hidden; on devices without `backdrop-filter` the glass falls back to `--color-surface`. If the evidence
shows the sphere filter dropping frames on the runner, the fallback is the flat strip without displacement
(the reviewer decides with the filmstrip).

## 10. Evidence (v2 §7, extended)

At 1280 and 390, **light and dark**: screenshots of loading, map, list, selected, empty, error, offline; the
first-paint filmstrip (0, 80, 160, 320, 640 ms); the **theme-switch filmstrip** at 0, 450, 900, 1350, 1800
ms; reduced-motion screenshots in both themes; layout shift 0; contrast of §1 recomputed.

## 11. Decisions for the owner, and what waits for data

- **D1 — Theme persistence.** As written, the switch lasts for the session only (no browser storage,
  `BOUNDARY_MODEL.md`). Remembering it needs either a Boundary amendment for one first-party preference
  cookie or a `theme` column on an owner-only table (schema change, human gate). Not part of this design.
- **D2 — Pages that do not exist** (Repositories, Instances, Events, Settings in the early mockups) are not
  in the sidebar. Each would be its own change request.
- **D3 — Instances, lifecycle and ledger totals** are not in the event contract: the Tower cannot tell an
  engine instance or machine, a project's lifecycle stage, or how many tasks a ledger holds. The map shows
  "seen" counts and execution only. Showing them needs an event-contract change (v2) reported by the DEV_OS
  Engine — a later change request in `devos-plan`.
- **D4 — Observed-only repositories** (the GitHub App installed, project not registered) are not stored
  (`DATA_MODEL.md` §2.8: unknown repositories store nothing), so they cannot appear as nodes.

## 12. How it reaches the product

One change request ("Design v3: tower map, light and dark themes, scene"), planned by intake:
- `DESIGN_SYSTEM.md` v3 from this folder (§1 tokens for both themes, §2–§7, the §8 amendments) and a new
  OD signed by the owner;
- **T04 rewritten as the v3 foundation** (T04 attempt 1 produced nothing): tokens for both themes, theme switch, fonts, `motion`, the scene and planet (images copied from `docs/design/v3/assets/` to `public/scene/`), the app shell, the not-found page and the sign-in on the new tokens; then **a new T05** for the overview as the tower map with the §6 aggregation, its panels, the list, the phone layout, the register page and the Tower-health banner (a UI gate for the owner's look). Each fits the builder's 72-minute budget;
- the open UI rows after it (usage view, project page, import, sign-in retrofit) are written against v3; the
  sign-in retrofit uses the scene and planet as its atmosphere.

## 13. Realistic art with Grok (in Cursor)

The builder is Grok in Cursor, and Cursor's agent has a built-in image tool. The new task uses it to replace
the procedural baseline with more realistic art, under these rules:

- **What:** `sky-night` (2400×1350), `sky-day` (2400×1350, without clouds), `sky-clouds` (3200×1100 with
  transparency, seamless left-right), `planet-land`, `planet-clouds` and `planet-lights` (1360×680,
  equirectangular 2:1, seamless left-right; lights only on land). Same names, sizes and roles as the baseline,
  so nothing else in the page changes. Skylines, tower and blades stay vector.
- **Prompts** describe an original sci-fi planet, sky and stars. They never name or imitate a film, game,
  franchise, character, ship or brand, and the task does not use a reference image from one.
- **Checks** before an image replaces the baseline (a small script in the task): exact size and ratio; the
  left and right edges match (mean difference under a threshold) for every seamless image; the planet
  strip's poles are uniform enough not to pinch; WebP or JPEG under the §9 budget.
- **Fallback:** if the image tool is not available in the automated run, or an image fails a check, the
  baseline stays and the report says so. It never blocks the task.
- **Review:** the reviewer looks at every generated image and at the scene screenshots in both themes, and
  can keep the baseline for any image that is worse, off-style or not original.

If the automated run has no image tool, the owner can generate the same six images in Cursor's editor with the
prompts from the task's script and commit them through a pull request; the checks above still apply.

## 14. Owner's realistic backgrounds (v3.1, landed 2026-10-17)

The owner made the backgrounds with Grok in Cursor: one composition (a terrace above a city of spires on the
horizon) in two lightings, landscape and portrait — `assets/v3.1/bg-night.webp`, `bg-day.webp` (2560×1440) and
`bg-night-portrait.webp`, `bg-day-portrait.webp` (1440×2560), WebP at quality 80 (80–302 KB each). They replace
`sky-day.jpg`, `sky-night.jpg` and `sky-clouds.webp`:
- the images contain the city, so the vector skylines, window lights and drifting cloud layer of §3.1–§3.2 are
  removed; the 28 twinkling vector stars stay in dark, in the upper half only;
- each theme's image fills the fixed layer of §3 with `background-size: cover`, anchored at the bottom
  centre; the portrait pair is used at ≤ 760 px; the two themes crossfade over `--dur-scene`;
- the day image scales very slowly (1 → 1.04 over 60 s, alternate) for life; it stops under reduced motion and
  while the page is hidden;
- `screens/v3.1-phone-day-scrolled.jpg` shows the page scrolled on a phone with the scene standing still.
The scene's images total about 1 MB; only the theme's background and planet texture load before first paint.

## 15. Original quality (v3.2, requested 2026-10-19)

**Why.** v3.1 squeezed the owner's art into a 1 MB budget (§9 of `DESIGN_SYSTEM.md`). A phone shows its own
portrait plate near 1:1 on a small screen, so the loss is hidden; a desktop shows the landscape plate large,
stretched past 2560 px on a high-density screen and enlarged a further 4 % by the day drift, so the compression
shows (`screens/v3.2-why-desktop-vs-phone-background.png`: live site, desktop at DPR 2 on the left, phone at
DPR 3 on the right). The globe is warped by an 8-bit `feDisplacementMap` from a 340×340 map: near its centre
neighbouring pixels share one displacement value and copy the same texel, so the clouds turn into small squares,
which show on the 340 px desktop globe and hide on the 211 px phone globe (`screens/v3.2-why-planet-blocks.png`).

**The set** (`assets/v3.2/`):

| File | Size | Bytes | What it is |
|---|---|---|---|
| `bg-day.jpg` · `bg-night.jpg` | 2560×1440 | 367 325 · 882 525 | the owner's landscape plates, **byte for byte** (no re-encoding) |
| `bg-day-portrait.jpg` · `bg-night-portrait.jpg` | 1440×2560 | 421 534 · 762 660 | the owner's portrait plates, byte for byte |
| `planet-day.webp` · `planet-crimson.webp` | 2048×1024 | 567 430 · 406 100 | the globe strips rebuilt at the full size of the owner's maps (`assets/v3.1/source/`), WebP quality 95 |

SHA-256: `bg-day.jpg` `0ca52211…f7ad66`, `bg-night.jpg` `67626c97…dfa4`, `bg-day-portrait.jpg` `26984190…ad66`,
`bg-night-portrait.jpg` `ea3e6a38…d8db`, `planet-day.webp` `0e2007c1…701f`, `planet-crimson.webp` `d395e92e…7924`
(`sha256sum docs/design/v3/assets/v3.2/*` prints the full values).

The strips follow v3.1's recipe at 2048×1024: day = the day map with the clouds laid over it
(`a = clamp(1.4 × (clouds − 0.05))`, `day × (1 − a) + 0.96 × a`); crimson = the v3.1 crimson colouring applied to
the day map and clouds, with the city lights screened on (× 1.3). At 1360×680 both match the v3.1 strips within
their compression noise (mean absolute difference 3.4 of 255); both are seamless in x.

**How it should land** (a change request, then a task with a design gate):
- the plates are bundled byte for byte, no re-encoding; the day drift (scale 1 → 1.04) goes, because it enlarges
  the plate past its pixels;
- the globe is drawn at the device's pixel density (for example a small WebGL sphere sampling the strips per
  pixel), with the same size, spin (120 s), crimson roll on the switch, shade, atmosphere and glow; without
  WebGL, or with reduced motion, a still globe; the sphere map and `feDisplacementMap` leave;
- loading stays as §9: before the first paint only the theme's plate for the viewport and that theme's strip;
  a phone never loads the landscape plates; the byte budget becomes the size of this set.

**Landed with the living sky.** The four plates above are the ones on the page, byte for byte. Night is not
repainted: the Milky Way, the crimson horizon and the skyline stay in `bg-night.jpg` and
`bg-night-portrait.jpg`, and the plate itself does not move. A canvas of about 64 stars on a desktop and 32
on a phone (half of that on a small CPU) twinkles and drifts above the plate, only while the theme is dark,
and is still under reduced motion. Day keeps its plate and adds `sky-clouds.webp` (2048×1152, transparent,
edge-faded so the loop has no hard cut) in two layers under the night plate, masked so the drift stays in
the sky. A faint crimson mist drifts on the night horizon only. The day plate no longer scales. The globe
is still the v3.1 strip and displacement map; the sharper WebGL sphere in the paragraph above is not in
this change.
