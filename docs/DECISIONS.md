# TOWER — Decisions

Precedence 2, with `SCOPE.md`. A signed OD is never edited; a later OD amends it.
**Basis of signature for OD-01 to OD-06:** the owner's push of the bootstrap commit to `main` is the
confirming act. Every OD below restates a decision already taken in `devos-plan` (`seed/05-decisions.md`,
the Step-1/2/3/4 answers, the seven ADRs); none adds a new one.

---

### OD-01 — Tower purpose, profile and boundary
**Status:** SIGNED — bootstrap push
**Amends:** none
**Requested by:** the owner (`seed/00-SEED.md`, decision 3b)
**1.** TOWER is the private Control Tower of the Dev OS ecosystem: Discover · Monitor · Trace · Verify.
It is a separate product with its own repository and deployment and is **never a dependency** for any
project's local or automated work.
**2.** Profile **A** with one zone, `owner`, that covers the whole application (`BOUNDARY_MODEL.md`):
there is no public page. Forms, the session cookie and route handlers exist only for the owner and for
the two machine routes.
**3.** The **Boundary gate** holds for the public in full: nothing accepts or keeps a visitor's data;
analytics, trackers and third-party scripts are forbidden everywhere, zone included.
**4.** Personal data: none from the public. The Tower stores the owner's GitHub numeric id (allow-list)
and, in observations, an actor login only when it is the owner or a bot (`ADR-003`). No domain gate.
**Does not decide:** a second user, viewer access (`PROPOSALS.md` P-04), discovery beyond M1.

### OD-02 — One owner, who signs every gate
**Status:** SIGNED — bootstrap push
**1.** The owner (GitHub `Jovo-Jovi`) is the only person who can sign in, identified by the GitHub numeric
id read server-side from `auth.identities` (`provider = 'github'`, `provider_id`) through
`public.is_owner()`; `user_metadata`, `raw_user_meta_data` and `app_metadata` are never read (ADR-002).
**2.** The allow-list is one row in `public.owner_allowlist`, inserted once by the owner in the Supabase
SQL editor; the value is in no file, variable or secret of this repository.
**3.** The owner signs every human gate by merging (`G-Tower-Auth`, `G-Tower-Ingest`, `G-Method-*`,
`G-Tower-Observe`, `G-Tower-v1`) and reviews every UI task's screenshots at 1280 and 390.
**Does not decide:** recovery beyond re-inserting the row or relinking the identity out of band.

### OD-03 — Built by the same automation as the pilot, unchanged
**Status:** SIGNED — bootstrap push
**1.** The repository is created from the pilot's `docs/method/AUTOMATION.md` §11 copy list: runner
scripts, guards, workflows, prompts, schemas, skills, `devos.config.json`, handbook, `FULLSTACK_MODULE.md`,
`AUTOMATION.md`, `PRECEDENTS.md`. Nothing in them is rewritten for the Tower; the two configuration
deviations are listed in `plan/tower-bootstrap/B0-BOOTSTRAP.md` §4 and are configuration, not method.
**2.** Every Tower task passes through `devos-cycle` on GitHub (`plan/00-PLAN.md` "Where M1 runs").
Local interactive work may draft; a local result never counts as a task's PASS until the local runner has
parity (M2).
**3.** Task ids are `Tnn` as `guard:phases` requires; method fixes are `Tnn` rows with Phase `PM`
(PR-28). Plan labels (`TM01`, `TM02`, `T08`…) map to repository ids in `plan/ID-MAP.md`.
**4.** `DEVOS_PAT` for this repository, if a method fix must change a workflow file, is a **separate**
fine-grained token scoped to this repository only, under pilot ADR-006's conditions; it is never the
pilot's token.
**Does not decide:** the engine (`devos-engine`, M4) — until then the method is copied, not installed.

### OD-04 — Stack and hosting
**Status:** SIGNED — bootstrap push
**1.** Next.js App Router on Vercel (private project, Standard Deployment Protection); Postgres and Auth
on Supabase, the GitHub provider only; Firestore rejected for this product (Tower ADR-001).
**2.** Machine routes (`/api/ingest`, `/api/github/webhook`, later `/api/github/reconcile`) answer on the
production host only (`VERCEL_ENV === 'production'` and `Host` = the host of `TOWER_URL`), otherwise
`404`; no automation bypass header or secret name exists in this repository (Tower ADR-004).
**3.** `TOWER_URL` is the production URL and the OIDC audience (pilot ADR-005). A custom domain later is
a coordinated change announced in the contract's change log.
**4.** Settings are checked by **name only** (`devos/setup.json`, PR-27); values live in GitHub secrets,
GitHub variables and the Vercel Production environment, never in this repository.
**Does not decide:** a paid Supabase plan or a second organisation (M0 capacity check, owner's choice).

### OD-05 — Facts, origin and age; reporting never blocks
**Status:** SIGNED — bootstrap push
**1.** The Tower stores events exactly as `seed/06-event-contract.md` v1 defines them, orders them by
`seq` within a run and runs by server `created_at`, never by the sender's clock; `received_at`, `origin`
and `source` are server-set.
**2.** Every fact shows its origin — reported · observed · verified · imported — and its age; last
activity and last contact are two values; stale after `stale_after_minutes` per project (default 24 h);
a Tower-health banner replaces numbers when the Tower's own query fails.
**3.** Idempotency key `(project, run, seq)`: identical body again → `200 duplicate`; a different body →
`409 duplicate_conflict`, the first event wins, a reason-only rejection row.
**4.** Agent usage (`usage` on `build`/`review` terminal events) is stored as given, never estimated; a
tool that exposes nothing is `unavailable`; the Usage view states coverage and lists failed attempts
separately; no cost figure in v1.
**5.** Nothing the Tower does can delay, fail or change a project's step, verdict, merge or deploy.
**Does not decide:** snapshots or trend lines (`PROPOSALS.md` P-06, P-08).

### OD-06 — Design direction is approved as the frame; every UI task refines it under review
**Status:** SIGNED — bootstrap push
**1.** `DESIGN_SYSTEM.md` as committed in the bootstrap is the approved **direction** (idea, tokens, type,
components, compositions, quality floor). It is not a mock-up: each UI task's fence carries a Design
specification that refines the direction for its pages and states.
**2.** Enforced UI/UX: Design specification → Implementation → Visual verification (screenshots at 1280
and 390 for every page and state) → Acceptance. In M1 the owner and the reviewer judge by hand; M3 makes
the gate mechanical (`DESIGN REVISE`). A correct page with poor UI/UX does not pass.
**3.** No design tool is a dependency: the direction is text and tokens in this repository.
**Does not decide:** a second locale (`I18N_MODEL.md` records the one-locale assumption for the owner to
confirm).

**Amendment A1 (2026-10-17) — Design system v2, "Night-shift control room"**
**Status:** SIGNED by the owner's merge of the pull request that lands it.
**1.** `DESIGN_SYSTEM.md` v2 replaces v1 as the approved direction: one dark theme derived from the
Raycast style (Refero Styles) the owner chose, Inter + Geist Mono, and a motion system (tokens §1,
choreography §4, rules §5) inspired by the prompt-motion.com gallery. Truthfulness, origin/age and
"meaning never by colour alone" are unchanged and outrank motion.
**2.** Motion is part of the enforced UI/UX gate: every UI task's evidence adds motion filmstrips,
reduced-motion screenshots and a zero layout-shift value (§7); the design ledger gains a *motion* row.
**3.** New dependency allowed: `motion` (Motion for React). No other animation library.
**4.** The sign-in shipped by T01 is retrofitted to v2 by a task planned before T04; the fences of T04–T07
are written against v2 (the v1 Design specifications in `devos-plan` are not copied as they are).
**Does not decide:** a light theme (later scope amendment).

### OD-07 — Design system v2 lands inside T04; the sign-in retrofit is T09
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** OD-06 Amendment A1 §4 (the timing of the v2 foundation and of the sign-in retrofit only)
**Requested by:** issue #5 (the owner's option (c) in the issue thread)
**Numbering note:** the "OD-07" and "OD-08" cited by the method files copied from the pilot (`CLAUDE.md`
"Automation v3", workflow and runner comments) are `devos-pilot`'s decisions, carried unchanged under
OD-03. This OD-07 is the Tower's. Likewise "T09" below is this repository's task id; the "plan label T08"
in `SCOPE.md` A-1 is a `devos-plan` label mapped in `plan/ID-MAP.md`.
**1.** No task is inserted before T04 and nothing is renumbered. **T04 lands the v2 foundation as part of
its own scope**, row unchanged: the tokens of `DESIGN_SYSTEM.md` §1 byte for byte in `src/styles/tokens.css`
(new values under the existing names, so the sign-in shipped by T01 turns dark with it); Inter + Geist Mono
through `next/font/google` in place of IBM Plex (§2); the `motion` dependency (OD-06 A1 §3); and the
primitives T04 itself uses — `LiveMark`, the `StatusChip` transition, `Counter`, the FLIP list, the
`StateBlock` sheen, `Toast`, and View Transitions between routes (§3–§5). T04's fence also carries
sign-in screenshots at 1280 and 390, proving the T01 states still read correctly in the dark tokens.
**2.** T05, T06 and T07 each add the further primitives they use (§3). The fences of T04–T07 are written
against v2 (`DESIGN_SYSTEM.md` §1–§8); the v1 Design specifications in `devos-plan` are not copied.
**3.** The sign-in retrofit (`DESIGN_SYSTEM.md` §4.1: first paint, redirecting, "Checking your access…",
the success transition with the shared product mark, denied, error, signed out) is **T09**, after T07,
**risk 3**, gate **G-Design-v2**. Until T09 the sign-in keeps T01's structure in the v2 tokens.
**4.** To make the "Checking your access…" interstitial truthful (it shows only while the code exchange is
pending), T09 turns `/auth/callback` into the page that shows it and moves the code exchange, unchanged,
into a new route handler `GET /auth/confirm`. The claim path, `public.is_owner()`, the 303/403 answers,
the header baseline and the CSP do not change. Supabase's redirect URL stays `/auth/callback`, so no
dashboard setting changes. `SECURITY_MODEL.md` §3 lists both routes.
**5.** Motion evidence (`DESIGN_SYSTEM.md` §7) in the runner (`scripts/devos/screens.mjs`) is a method
fix the owner files as a separate "Dev OS method fix" issue (Phase `PM`, its own intake, PR-28); it is
not planned here. Until it lands, every UI task's builder produces the filmstrips, the reduced-motion
screenshots and the layout-shift value from its own Playwright spec into `.devos/screens/`, under file
names its fence states.
**6.** Gate **G-Design-v2** (the owner merges T09): on production at 1280 and 390 the sign-in plays every
§4.1 state; with "reduce motion" on, the same states are clear without movement; the review shows the
filmstrips and a layout-shift value of 0 for every state.
**7.** The boundary is unchanged: no new form field, cookie, storage, third party or stored data; the new
route lies inside the `owner` zone (`src/app/**`), so the `devos:boundary` line does not change. No new
setting outside the repository (`docs/setup-items.json` not needed).
**Does not decide:** a light theme; the design of the §7 method fix (its own intake); a guard for
durations and easings (still a review finding, `DESIGN_SYSTEM.md` preamble); "use another account"
forcing GitHub's account chooser (the button restarts the same sign-in).

### OD-08 — Design system v3: two themes, the scene and the tower map
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** OD-06 Amendment A1 §1 (the approved direction becomes v3; its "Does not decide: a light theme" is now
decided) and OD-07 §1–§3 and §6 (what T04 lands, the design the T05–T07 fences follow, the sign-in retrofit's
design and its gate test)
**Requested by:** issue #13 (the owner's answers in the issue thread: layout (a), import last)
**Numbering note:** as OD-07 says, the "OD-07" and "OD-08" cited by the method files copied from the pilot
(`CLAUDE.md` "Automation v3", workflow and runner comments) are `devos-pilot`'s decisions. This OD-08 is the
Tower's.
**1.** `docs/DESIGN_SYSTEM.md` v3 ("Energy-blade control tower") replaces v2 as the approved direction: a light and
a dark theme with **Auto** (the system setting) as the default and a header switch **Auto · Light · Dark**, the
tokens of its §1, the scene and planet behind every page, and the overview `/` as the tower map. The approved
design folder `docs/design/v3/` (README, mockup, assets, screens) ranks with it at precedence 8; where they differ,
`DESIGN_SYSTEM.md` holds. v2's three rules (truthfulness, never colour alone, motion never lies) are unchanged and
outrank motion.
**2.** The motion amendments A–E of `docs/design/v3/README.md` §8 are signed as `DESIGN_SYSTEM.md` §5 states them:
(A) the theme switch is a 1.8 s transition of the scene and planet (`--dur-scene`); (B) the scene's ambient loops
are allowed and all stop under reduced motion and while the page is hidden; (C) `stroke-dashoffset`,
`offset-distance` and `mask-position` join the animated properties, `filter` and `box-shadow` stay static;
(D) one text accent, one energy colour (never text), gradients only in the scene, tower and planet; (E) reduced
motion switches the theme instantly and keeps every meaning.
**3.** The theme lasts for the open document only: the switch sets `data-theme` on `<html>`, and nothing is
stored (no cookie, browser storage, URL parameter or database value). A reload returns to Auto.
**4.** The ledger is as the owner renumbered it on `main` (commit `1792346`): **T04** = design v3 foundation
(tokens for both themes, theme switch, Inter + Geist Mono, the `motion` dependency, scene and planet, the app shell,
the styled not-found page, the sign-in on the v3 tokens and scene); **T05** = the overview as the tower map with
`/api/projects`, the §6 values, cards, blades, panels, list, phone layout, the register page and the Tower-health
banner, gate **G-Design-v3**; **T06** usage view; **T07** project page; **T09** sign-in retrofit; **T10** history
import with **G-Tower-v1**, last. `docs/fences/T04.md` v2 replaces the v1 fence of the old scope (attempt 1 changed
no file). The fences of T05, T06, T07, T09 and T10 are written against v3.
**5.** **T09 is built against v3** (the owner's answer 2): OD-07 §3–§4 stand (the states of v2 §4.1, "Checking your
access…" on the `/auth/callback` page, the code exchange moved unchanged to `GET /auth/confirm`, risk 3), with the
scene and planet as the atmosphere instead of v2's gradients. Its row keeps its id, its wording and the gate id
**G-Design-v2**; OD-07 §6's test applies to the v3 states in both themes. The reviewer who passes T07 reissues
`docs/fences/T09.md` against v3 (its v1 checks v2 tokens such as `--glow-accent`, which v3 removes).
**6.** Data: no migration, table, view or function. Every value of the map comes from the existing tables through
the owner's session (RLS `is_owner()`), as `docs/design/v3/README.md` §6 lists; `aggregatePortfolio` grows the
latest task and phase, the execution (`runs.source`), tasks and phase passed of seen; nothing is estimated, and a
value the tables cannot give is `—` with its legend.
**7.** The scene's images are bundled from `src/components/scene/assets/` (served under `/_next/static/media/`)
instead of `public/scene/`: the sign-in proxy redirects every other path without a session (`src/proxy.ts`), and
serving `public/` to `/sign-in` would need a proxy change. `src/proxy.ts`, `next.config.ts`, the CSP and every
header stay unchanged (`img-src 'self'` already covers the bundled images).
**8.** Realistic art (`docs/design/v3/README.md` §13, `DESIGN_SYSTEM.md` §10) is part of **T04**, after the
foundation, time-boxed and never blocking: original prompts committed with the task, a check script, the baseline
kept when the image tool is not available or an image fails a check; the reviewer looks at every replaced image.
**9.** Gate **G-Design-v3** (the owner merges T05): on production at 1280 and 390, in light and dark, the map shows
every registered project with the correct link state and "of seen" counts; the theme switch turns the planet into
night and back in about 1.8 s; with reduce motion on, the switch is instant and every loop stops with the same
meaning; the review carries the README §10 evidence (theme-switch filmstrip, reduced-motion screenshots in both
themes, layout shift 0, the contrast recomputed).
**10.** The boundary is unchanged: no new form field, cookie, storage, third party or stored data; the theme is
not persisted (§3); every new file lies inside the `owner` zone or holds no form control or storage, so the
`devos:boundary` line does not change. No new host (fonts are self-hosted by `next/font` at build). No new
setting outside the repository (`docs/setup-items.json` not needed), no key, no method change.
**11.** Two carry-forwards of `docs/reviews/T03-a1.md` are settled by v3: (c) `LiveMark` follows the poll of
`/api/projects`, never Supabase Realtime (`DESIGN_SYSTEM.md` §3); (d) the font variables are `--font-inter` and
`--font-geist-mono`, so `--font-mono` no longer refers to itself (§1). T04 lands both rows as closed.
**Does not decide:** theme persistence (README §11 D1: a preference cookie is a Boundary amendment, a `theme`
column a schema change); pages that do not exist (D2); instances, lifecycle and ledger totals (D3, an event-contract
change); observed-only repositories (D4); an in-app "Reduce motion" control (README §8 B names one, §2 places
none); self-hosted fonts through `next/font/local` (PR-24's permanent fix, its own small change); a guard for
durations and easings.

### OD-09 — Design v3.1: the owner's backgrounds and planet in the product
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** OD-08 §7 (the bundled image set) and §8 (realistic art becomes the owner's v3.1 set; the builder's
image step ends). OD-08 §1–§6 and §9–§11 stand.
**Requested by:** issue #18
**1.** The owner's v3.1 art (`docs/design/v3/README.md` §3.4 and §14, merged in PR #16) replaces the procedural
scene: the plates `bg-day.webp`, `bg-night.webp` and the portrait pair (≤ 760 px) replace the sky backdrops, the
vector skylines, the window lights, the cloud layer and the ground; the 28 twinkling stars stay in dark, cut to the
27 of the upper half; the globe strips `planet-day.webp` and `planet-crimson.webp` replace `planet-land`,
`planet-clouds` and `planet-lights`, with the night disc and rim removed; the crimson globe is revealed by the
moving mask disc on the switch; `planet-sphere-map.png` is replaced by the v3.1 map and the `feDisplacementMap`
`scale` becomes 300. The files are copied byte for byte from `docs/design/v3/assets/v3.1/` into
`src/components/scene/assets/` (OD-08 §7 unchanged in substance: bundled, served from `/_next/static/media/`).
**2.** `docs/DESIGN_SYSTEM.md` is amended as the intake PR writes it: §1 (the v3.1 token block: the procedural
layers' tokens removed, the crimson mask, `--dur-planet-spin`, `--dur-scene-drift`, `--scene-drift-scale`, the dark
atmosphere at 25 %), §3 (`Scene` and `Planet`), §5.2 and §5.6 (the cloud sea and cloud pan go; the day plate's slow
scale, 1 → 1.04 over 60 s alternate, joins the loops of amendment B and stops under reduced motion and while hidden),
§9 (the seven files, their sizes and bytes, the sphere map "replaced once" instead of "never replaced", the budget of
1 048 576 bytes against 1 009 318, and the loading rule: only the theme's plate and globe strip before the first
paint) and §10 (no task generates scene images; `scripts/scene/art.mjs` checks the bundled set against v3.1).
**3.** Placement: the request asked for T05's scope, but T05 passed (`docs/reviews/T05-a5.md`) and the owner merged
it (PR #17) before this intake, signing G-Design-v3. A ticked row is never reopened, so the work is a new row,
**T11** (risk 2), with its own gate **G-Design-v3.1**: on the preview at 1280 and 390, in light and dark, the plates
are the owner's, the planet spins and its crimson night side rolls over it on the switch, the poles are round (no
flat bands), and the scene does not move when the page scrolls. The ledger runs rows in id order and ids must
ascend (`scripts/devos/next-task.mjs`, `guard:phases`), so T11 runs after T10 unless the owner renumbers the open
rows on `main`, as for issue #13 (`1792346`); intake may not renumber. If the open rows change before T11 starts,
the reviewer who passes the row before it reissues `docs/fences/T11.md` against that tree.
**4.** No data, route, header or dependency change: `img-src 'self'` covers the bundled images; `src/proxy.ts`,
`next.config.ts` and the CSP stay. The boundary is unchanged (no form, cookie, storage, tracker or third party), so
the `devos:boundary` line does not change. No setting outside the repository (`docs/setup-items.json` not needed).
**5.** The §1 contrast pairs keep their stated reference backdrops and the token test does not change; the plates'
readability behind the glass is judged on the screenshots in both themes at G-Design-v3.1.
**Does not decide:** a contrast test measured on the plates themselves; removing the v3 baseline images from
`docs/design/v3/assets/` (they stay as the design record); the method manuals' description of `art.mjs`
(`docs/method/AUTOMATION.md` §6, "prints the scene-art prompts"), which a method task corrects; the order of T11
against T06–T10 (the owner's renumbering, §3).

### OD-10 — A sharp globe: a per-pixel sphere replaces the displacement filter
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** OD-09 §1 (the globe strips and the sphere map: the strips become the v3.2 files at 2048×1024, the sphere
map and `feDisplacementMap` leave) and `DESIGN_SYSTEM.md` §5.10's "No WebGL" (OD-06 A1 §3 allowed only `motion` as a
library; this OD adds no library). OD-09 §2–§5 stand otherwise; the v3.2 plates the owner landed in PR #36 are kept
as they are.
**Requested by:** issue #35
**1.** The planet is drawn sharp at every size and screen density. Each of the two globes (day; crimson inside the
moving mask disc) becomes a canvas drawn by a new client component `PlanetGlobe`: its backing store is its rendered
size × `devicePixelRatio`, and it samples its strip per device pixel on an orthographic sphere with WebGL 1 (no new
dependency, no library), mipmapped. Size, position, shade, atmosphere, glow and the mask disc stay CSS and unchanged;
no token changes.
**2.** Timing is the CSS one by construction: the `.spin` (120 s, `--dur-planet-spin`) and `.turn` (half a turn over
`--dur-scene` on the switch) wrappers stay, and the canvas reads their `translateX` every frame, so reduced motion,
the hidden pause and the evidence filmstrips' seeking act on it as they act on the CSS today.
**3.** A still globe in its theme's position when `prefers-reduced-motion: reduce` holds (WebGL draws on change only)
or when WebGL is not available (a 2D canvas drawing, once per change). Until a canvas has drawn its first frame, and
when neither path works, the strip shows flat under the shade, as the poster.
**4.** Assets: `planet-day.webp` and `planet-crimson.webp` become the 2048×1024 files of `docs/design/v3/assets/v3.2/`,
byte for byte; `planet-sphere-map.png` leaves `src/components/scene/assets/`. `DESIGN_SYSTEM.md` §3, §5.2, §5.10, §9
and §10 are amended as the intake PR writes them; the byte budget becomes the size of the set, 3 847 962 bytes
(README §15). Loading stays §9: before the first paint only the theme's plate and the theme's strip; the renderer
reuses the strip's CSS URL, so no file is fetched under a second URL; the page never waits for an image.
`scripts/scene/art.mjs verify` checks the seven files against `assets/v3.2/`.
**5.** Placement: one new row, **T12** (risk 2, three stages), gate **G-Planet-Sharp**: on captures at 1280 (DPR 2) and
390 (DPR 3), in light and dark, no squares on the globe; each canvas's backing size equals its rendered size ×
`devicePixelRatio`; the spin and the crimson roll keep today's timing; the still globe appears with reduced motion and
without WebGL; layout shift 0; before the first paint one strip loads. The owner signs by merging.
**6.** No data, route, header, CSP or dependency change: the strips are same-origin images (`img-src 'self'`), and
WebGL needs no new directive. The boundary is unchanged (no form, cookie, storage, tracker or third party), so the
`devos:boundary` line does not change. No setting outside the repository (`docs/setup-items.json` not needed).
**Does not decide:** a WebGL renderer for anything else (the starfield stays 2D); new art or a change to the strips'
look; a contrast test on the plates; `docs/design/v3/README.md` §15's last paragraph ("not in this change"), which
stays as the owner's design record; the method manual's description of `art.mjs` (`docs/method/AUTOMATION.md` §6,
already left to a method task by OD-09).

### OD-11 — The theme switch on the sign-in pages, and a link preview
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** OD-08 §1 (the switch was placed "in the header"; the sign-in pages have none, so it also stands at their
foot) and OD-01 §2 only in what it implies for crawlers (a link preview's tags and image are not a page and hold no
data). OD-08 §3 (nothing stored), §7 (bundled images) and every other OD stand.
**Requested by:** issue #40
**1.** The sign-in pages are not dark-only: they follow **Auto** (the system setting, OD-08 §1), so a device in dark
mode always sees dark there, because the switch exists only in the signed-in top bar. The existing `ThemeSwitch`
(Auto · Light · Dark, the catalogue's `theme.*` labels, no new key) is added to every state of `SignInCard`
(signed-out, denied, error, checking: `/sign-in`, its 403, `/sign-in?reason=auth_error`, `/auth/callback`), centred at
the page's block-end foot, outside the card, so the card's size, place and choreography do not change.
**2.** Behaviour is OD-08 §3's, unchanged: the switch sets `data-theme` on `<html>` for the open document only;
nothing is stored (no cookie, browser storage, URL parameter or database value); a reload, or the round trip
through GitHub, returns to Auto.
**3.** Every page's HTML carries a link preview: Open Graph `og:type` `website`, `og:site_name` and `og:title` =
`site.productName`, `og:description` = `site.tagline`, `og:image` with its width, height, type and alt, and
`twitter:card` `summary_large_image`. The image is **made from the actual site**: a 1200×630 JPEG of no more than
300 000 bytes, captured from the production build's `/sign-in` in the dark theme with reduced motion (the still
planet), by a committed script so it can be captured again; the reviewer and the owner look at it. Its alt text is
one new catalogue key, `site.previewAlt`.
**4.** The image is bundled with the code (imported by the root layout, served from `/_next/static/media/`, as
OD-08 §7 does for the scene), a path the sign-in proxy already leaves open, so `src/proxy.ts`, `next.config.ts`, the
CSP, every header and every route stay unchanged. Absolute URLs come from `metadataBase` = `TOWER_URL` (already a
Production variable, `devos/setup.json`) when it parses as an `http(s)` URL, otherwise Next's default. A crawler
asking for `/` gets today's `302` to `/sign-in`, whose `<head>` carries the tags for WhatsApp's agent.
**5.** Placement: two new rows. **T13** (risk 2): the switch on the sign-in pages, with its evidence in both themes.
**T14** (risk 2) with gate **G-Link-Preview**: the tags, the image, its capture script and tests. The owner signs by
merging T14 after pasting the production URL into WhatsApp and seeing the preview (WhatsApp caches a preview per
URL; a link already shared before the deploy may keep its old, empty one).
**6.** The boundary is unchanged: no form, input, cookie, storage, tracker, analytics or third party; the image is a
static file and a crawler's request is not kept. The `devos:boundary` line does not change. No dependency (the
capture uses the Playwright already in `devDependencies`), no data, no setting outside the repository
(`docs/setup-items.json` not needed).
**Does not decide:** theme persistence (still OD-08's: a cookie is a Boundary amendment); the switch on the
not-found page; a public landing page, indexing or `robots`; a preview image per page; recapturing the image
automatically when the design changes; the light-theme image (the owner can ask for it as a small change).

### OD-12 — Link requests: a DEV_OS project asks, the owner approves, the Tower adds it
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** OD-01 §2 (a third machine route, `POST /api/link`) and §4 (personal data: the Tower now keeps other
developers' repository names and GitHub owner ids, so the `owner` zone holds personal data and the Personal-Data
Protection gate applies, PR-19); OD-04 §2 (the list of production-only machine routes); `SCOPE.md` §2's "other owners'
projects, consent" for the link path only; `DATA_MODEL.md` §1 and §7 (which code may use the service-role client).
OD-01 §1 and §3, OD-02, OD-05 and event contract v1 stand unchanged.
**Requested by:** issue #46
**1. What a link is.** A developer who opts in when they set up the DEV_OS Engine has their project's workflow ask
the Tower to link it. A request registers nothing. The owner approves or declines each request once, on the overview.
Approval creates the `projects` row, and from then on the project's events (contract v1) are stored as today. The
engine works the same whether a link is approved, pending, declined or never asked: the Tower's answers never
change a project's step, verdict, merge or deploy (OD-01 §1, OD-05 §5). Engine users never get access to the Tower;
the owner stays its only user (OD-02). For other developers' projects this replaces the GitHub App registration
planned in `devos-plan` (plan label TR1). T03's webhook receiver is unchanged.
**2. `POST /api/link`.** Production host only (OD-04 §2; `404` elsewhere). Like `/api/ingest`, it has no session,
no cookie and no CSP: the proxy lets it through untouched. Checks, in this order:
(1) host. (2) `Authorization: Bearer <token>` present, otherwise `401 {"error":"no_token"}`.
(3) `verifyGithubOidc` with audience `TOWER_URL`, as `/api/ingest` uses it. Failures answer `401 {"error":"expired" |
"bad_issuer" | "bad_audience" | "bad_signature"}`; a key set that cannot be fetched answers `503`. Each `401` writes one
reason-only `event_rejections` row, as `/api/ingest` does.
(4) The claims. `repository` must be `owner/name` (`^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$`) and
`repository_owner_id` must be digits (`^[0-9]{1,20}$`), otherwise `401 bad_signature` with its row. The repository
and its owner come only from these claims, never from the body.
(5) The body: at most 1 024 bytes of JSON, an object with exactly `v` (the integer `1`), `key`
(`^[A-Z][A-Z0-9_-]{1,31}$`), `engine` and `contract`. `engine` and `contract` are each 1–32 printable ASCII characters
without spaces (`^[!-~]{1,32}$`). That is the Tower's reading of "a string of at most 32 characters": no control or
direction character can reach the owner's panel. Anything else, an oversized body included, answers
`400 {"error":"schema"}`.
(6) The answer. A declined request → `403 {"status":"declined"}`. An approved request, or a `projects` row with this
`repo` and `owner_github_id` → `200 {"status":"linked","key":"<that project's key>"}`. A pending request →
`202 {"status":"pending"}`. A new repository → a pending request is created, `202 {"status":"pending"}`; with 50
requests already pending → `429 {"error":"rate_limited"}`, and nothing is created. A database error → `500`.
Wherever a request row exists, the call updates `last_requested_at`, `engine_version` and `contract_version`. The
request asked this for pending rows; the Tower does it for every state, so that retention (§6) counts from the last
request. The proposed key stays as first asked.
Authentication comes before the body. So a `POST` without a token answers `401 no_token`, which is the owner's
production check. (`/api/ingest` reads its body first, and it does not change.) Every answer is JSON with
`Cache-Control: no-store` and never `Set-Cookie`, and nothing is logged.
**3. Data.** Two new tables, `link_requests` and `link_audit` (`DATA_MODEL.md` §2.10–§2.11). Every write goes through
`security invoker` functions that only `service_role` may execute (§4 there). The owner reads both tables under RLS
(`is_owner()`). The owner's Approve, Decline, Export and Delete reach those functions only through server actions
that call `requireOwner()` first and then use the service-role client. That is the import action's pattern, and it
keeps the invariants proven today: no `DELETE` policy anywhere, and no write grant to an API role on these tables.
Unique `(repository, owner_github_id)`: a transferred repository is a new request.
**4. Approve and decline.** Approve creates the project with `repo` and `owner_github_id` from the request and the
default stale window, then marks the request `approved` with its decision time and project. The key is the proposed
key, or, when a project already has it, the proposed key with `-2`, `-3` and so on: the first free one, cut at the
end so it stays within 32 characters (`left(key, 32 − length(suffix)) || suffix`). A repository already registered
under another owner id cannot be approved: the panel says so and the request stays pending. Decline marks a pending
or an approved request `declined`. A declined approved request is a **disconnected** project: its `projects` row
and history stay for the record, and it shows as `disconnected` (§7). A decline is not undone in place. The owner can
Delete the declined request, and the developer's next request then starts pending again.
**5. `/api/ingest`.** Its answers and contract v1 do not change. An approved repository's events are stored as today.
A pending, declined or unknown repository has no matching project row and keeps `401 repo_not_registered`. One
refusal is added inside the route: a project whose link request is `declined` (disconnected) is refused with the
same `401 repo_not_registered` and its rejection row. That is the Tower's reading of "any other repository keeps
repo_not_registered" together with "declined later … shows as disconnected".
**6. Personal data and its protection.** A repository's full name (which carries the developer's GitHub login when a
person owns it), the owner's numeric GitHub id, the request times and a linked project's workflow events are
personal data of members of the public (Egypt, Law 151 of 2020). So the `owner` zone becomes
`"personal_data": true` in the `devos:boundary` line, and the Personal-Data Protection gate (handbook §10.3, PR-19)
applies from T15 on. `docs/PROTECTION_MODEL.md` states each field's purpose, who reads it, and the rest of the
protection:
- **Retention** is scheduled daily in the database by `pg_cron`. Pending and declined requests without a project
  are deleted 180 days after their last request. A disconnected project and its request are deleted 365 days after
  the decline. A linked project is kept while it is linked.
- **Deletion and export** are the owner's Delete and Export in the panel.
- **The audit** is a reason-only `link_audit` row per change, with no personal data in it.
- **Backups** are encrypted (PR-18). The seeds and tests are synthetic.
- **Law 151:** the obligations are listed for the owner to confirm.
The method requires **a private repository before the zone ships** (PR-19). The repository is public today
(B0). The first deploy that accepts a link request is T17's merge, so the owner makes the repository private before
merging T17. The T17 review states the visibility it observed. A private repository's Actions runs count against the
account's minutes, and `resume.relay = "public"` then relays no long waits (PR-31): that is the owner's choice of
plan, not a repository change.
**7. The panel.** A "Link requests" panel on `/`, for the signed-in owner only. There is no new page, and no new
public route except `/api/link`. It lists the requests in three groups:
- **Pending**, with every field (repository in `<bdi>`, owner id, proposed key, engine, contract, first and last
  request with their ages) and **Approve** · **Decline**.
- **Linked by request**, with **Decline**, which disconnects the project.
- **Declined**.
Every row has **Export**, a JSON download made in the browser with nothing stored, and **Delete**, which asks for
confirmation. A disconnected project shows the link state `disconnected` on its card, list row, detail panel and
project page. Its blade is drawn like `silent`'s, never live. It appears under "All" only. The System overview counts
it under its own word. The Ingestion health rejection count then covers both machine routes, and its label says
"Rejected requests, last 24 h".
**8. Contract document.** `docs/contract/LINK_CONTRACT.md` documents `/api/link` next to event contract v1:
transport, the body and its schema, the order of checks, the answers and what a sender does with each, the claims
used, and a change log. It is written by T17. `EVENT_CONTRACT.md` does not change.
**9. Placement.** Four new rows, Phase P03 (link requests):
- **T15**, risk 3, two stages: the data layer, `DATA_MODEL.md` §2.10–§2.11 and §4 (both migrations, pgTAP, seed,
  types, `pg_cron`), the glossary rows, and nothing visible.
- **T16**, risk 3: the panel and its four server actions.
- **T17**, risk 3: the route, the proxy pass-through, the `/api/ingest` refusal of §5, the contract document and
  the route tests. The repository is private before its merge.
- **T18**, risk 3, gate **G-Link-Requests**: the `disconnected` state, the label of §7, and an end-to-end test of
  the whole flow against the CI database.

At G-Link-Requests the owner checks on production:
- `curl -s -X POST https://devos-control-tower.vercel.app/api/link` answers `401 {"error":"no_token"}` with no
  `set-cookie`.
- A real opted-in project's request shows as pending. Approve answers it `linked` with the key, and its next event is
  stored. Decline turns its next request into `403` and its next event into `401 repo_not_registered`.
- The panel is visible only signed in.
- Supabase → Advisors → Security shows no error and no warning.
- The repository is private.

The owner signs by merging T18.
**10. Nothing else moves.** There is no new dependency. There is no new secret or variable: `TOWER_URL` and
`SUPABASE_SECRET_KEY` already exist (`devos/setup.json`), and `pg_cron` is enabled by T15's migration, so
`docs/setup-items.json` is not needed. Headers and the CSP are unchanged. There is no tracker, form for the public or
public page, so the Boundary gate holds for visitors as before.
**Does not decide:** re-approving a declined request in place (Delete, then a new request, is the path); notifying
the owner of a new request (no email, push or third party); the engine side (`devos-engine`'s opt-in, its sender
and what it tells the developer, which Law 151's transparency requires of it); a per-repository request rate; the
GitHub App on linked repositories; an ADR for link registration; a change to event contract v1; the `devos-plan`
rows for TR1 (the owner updates `plan/ID-MAP.md`); the exact Law 151 periods, registration and cross-border-transfer
steps, which the owner confirms with counsel before G-Link-Requests (`PROTECTION_MODEL.md` §10).

### OD-13 — Link-request safeguards before `/api/link` goes live
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** OD-12 §2 (6) (`rate_limited` also answers a fourth pending request of one owner), §4 (a project is linked
by one request only), §6 (the export covers a linked project's usage and observations; the retention job re-checks
each row) and §9 (T17's and T18's scope). The `/api/link` body, its order of checks, its answers and their status
codes, event contract v1, the boundary and every other OD stand.
**Requested by:** issue #49 (the owner's answers in the issue thread: placement (b); the `007` fixture owner `999`)
**1. Retention without races.** `purge_link_requests()` deletes a row only if it still meets its condition when it is
deleted: each `delete … where` repeats the condition it was selected by (no project, `pending` or `declined`, and
`last_requested_at` older than 180 days; or `declined`, a project, and `decided_at` older than 365 days). A row that no
longer meets it (approved, or asked again, while the 03:17 run is in progress) is skipped: it is not deleted, gets no
audit row and is not counted, and its project is not touched. The function still returns the number of requests it
removed.
**2. One request per project.** `link_requests.project_id` is unique where it is not null (a partial unique index). In
`approve_link_request`, when the project with this `repo` and owner already has a link request (any state),
the answer is `{"result":"project_linked"}` and nothing changes: no update, no audit row, the request stays pending.
The check sits after `repo_taken` and before any write. Deleting or purging one request can then never break another
request's `approved` check (`23514`) and roll back a whole purge.
**3. A pending cap per owner.** Besides the 50 pending requests in all, `request_link` creates no new request for an
`owner_github_id` that already has 3 pending requests. It answers `{"result":"rate_limited"}` and nothing is created,
so `/api/link` answers `429 {"error":"rate_limited"}` as OD-12 §2 (6) already says. Before counting, the function takes
one transaction-scoped lock (a fixed advisory lock key), so two concurrent new requests cannot both pass either cap. A
repeat call for an existing row (pending, approved, declined or a matching project) is answered as today and is never
counted against a cap.
**4. A full export.** `export_link_request` also returns the linked project's usage rows (`event_usage`, each with its
event's run and `seq`) and its `observations`, under the keys `event_usage` and `observations`. Both are `[]` when
the request has no project. Every existing key and its content stay as they are.
**5. Placement (the owner's answer 1, option (b)).** No new row, nothing renumbered, `docs/fences/T16.md` unchanged.
- **T17** (row unchanged, risk 3) lands §1–§4 **first**, in one new forward migration with its down file, before its
  route work, so the data layer is safe before `/api/link` is live. Its pgTAP proves: a purge leaves an approved
  request and its project in place; a second request cannot be linked to an already linked project
  (`project_linked`, nothing changed); the fourth pending request of one owner answers `rate_limited` and creates
  nothing, while another owner's new request still goes pending; the export includes usage and observations. The
  only change to an existing test is the owner's answer 2: in `supabase/tests/007_link_protection.sql`, the owner id
  argument of the `request_link` calls in the purge set-up block (lines 226–247 on `main` at the intake) changes from
  `'0'` to `'999'`. Every assertion, description and plan count there stays as it is, and
  `006_link_requests.sql` is unchanged. Every existing pgTAP, unit and e2e test still passes.
  `docs/contract/LINK_CONTRACT.md` (written by T17) states both caps under `429`. The reviewer writing T17's fence
  judges its size (PR-38) and may split it into stages, the migration being the first.
- **T18** (row unchanged, risk 3, gate G-Link-Requests): the panel's Approve maps `project_linked` to its own field
  message from the catalogue (one new key) in the row, which stays pending. Its whole-flow e2e covers it. Until T18,
  T16's mapping shows the generic failure message for it, and nothing changes in the database.
**6. Carry-forwards.** §1–§4 answer carry-forwards (a), (b), (d) and (e) of `docs/reviews/T15-a1.md`. T17 closes the
rows T16 lands for them (`docs/method/CARRY_FORWARDS.md`) when its migration passes review.
**7. Nothing else moves.** There is no new table, column, route, header, dependency, secret or variable
(`docs/setup-items.json` not needed). The `devos:boundary` line and the zones do not change, and the Boundary gate holds
for visitors as before. Each function keeps `security invoker`, `set search_path = ''` and `execute` for
`service_role` only. Production holds no link request before T17 deploys `/api/link`, so the unique index cannot meet
duplicates there. At the T17 schema gate, Supabase → Advisors → Security shows no error and no warning.
**Does not decide:** a per-repository request rate (still OD-12's "Does not decide"); a way for the owner to change
either cap without a migration; notifying a developer that they are rate limited beyond the `429`; exporting
`event_rejections` (not personal, `PROTECTION_MODEL.md` §2); re-linking a disconnected project to a new request.

### OD-14 — Delete a registered project, neon glow, and collapsed link-request groups
**Status:** DRAFT — signed when the human merges the intake PR
**Amends:** `DATA_MODEL.md` §3's "No `delete` policy … on `events`, `event_usage`, `runs`, `observations`" only in that
a new service-role function may now delete a project registered by hand with its cascade (the policy invariant itself
stands); OD-12 §7 (how the "Linked by request" and "Declined" groups are laid out: collapsed, one line per request);
`DESIGN_SYSTEM.md` §5.2 (static glows on named elements) and §1 (the T22 token block). OD-12 §3–§4 and §6, OD-13, OD-08
§2 (C) "`filter` and `box-shadow` stay static", and every other OD stand.
**Requested by:** issue #57
**1. Which project can be deleted here.** A project **registered by hand** is a `projects` row that no `link_requests`
row points to (`project_id`), in any state. Its project page (`/projects/[key]`) gets **Delete project**, for the owner
only. A project that came from a link request (linked or disconnected) keeps today's path: the panel's **Delete**
(`delete_link_request`), which also deletes the request; its project page shows no Delete project. A project registered
by hand that `request_link` answers `linked` for (same `repo` and owner id, OD-12 §2 (6)) has no request row, so it is
deletable here; afterwards the engine's next request goes pending.
**2. Confirmation.** Delete project opens an inline confirmation on the page: one sentence saying what goes (the
project with its runs, step events, usage and observations) and that it cannot be undone, a labelled text field, Cancel,
and the confirm button, which is enabled only while the field holds exactly the project's key (case-sensitive). The
server action compares the typed value with the key again and deletes nothing when they differ. After a deletion the
owner lands on `/` with the toast "Project {key} deleted.", and the project is gone from the map, the list, the counts
and `/api/projects`.
**3. Data.** One forward migration with its down file adds:
- table `public.project_audit` (`DATA_MODEL.md` §2.12): `id`, `at`, `action` (`'deleted'` only), `project_id` (no
  foreign key, so the row outlives the project). No key, repository, owner id or body. RLS on, one policy
  `project_audit_owner_select` (`for select to authenticated using (public.is_owner())`); `revoke all … from anon,
  authenticated`, then `grant select … to authenticated`.
- function `public.delete_registered_project(p_key text) returns jsonb` (`DATA_MODEL.md` §4): `security invoker`,
  `set search_path = ''`, `execute` to `service_role` only. It locks the project row (`for update`), then answers
  `{"result":"not_found"}` (no such key), `{"result":"linked"}` (a link request points to it; nothing changes) or
  deletes the project (cascading to `runs`, `events`, `event_usage`, `observations`), writes one `project_audit`
  `deleted` row and answers `{"result":"deleted"}`.
- The owner reaches it only through a server action that calls `requireOwner()` first and then the service-role client
  in a new server-only module, as the link-request actions do (OD-12 §3). There is still no `DELETE` policy anywhere,
  no write grant to `anon` or `authenticated` on any new table, and `is_owner()` stays the only `security definer`
  function.
**4. Neon glow.** In both themes, in each theme's energy colour (`--color-energy`: blue in light, red in dark), the
blades (their glow, a wider halo, the ports) and the tower's LEDs glow neon, and every project card carries a neon
glow layer that is brighter on hover and brighter still when selected. The values are the T22 block of
`DESIGN_SYSTEM.md` §1, written by this intake; no raw colour enters a component. Glows are outer only (no tint on the
glass, no inset), so every §1 contrast pair and `tokens.test.ts` stay as they are. `filter` and `box-shadow` stay
static (OD-08 §2 C): a glow brightens by the **opacity** of its own layer (`--dur-quick`), and the moving glow is the
existing hum and LED loops. Reduced motion stops those loops, so the glow stands steady at its rest strength. Blade
states that are unlit today (`down`, `stale`, `silent`, `disconnected`) gain no glow: light never claims a link that is
not live (§0 rule 3).
**5. Collapsed groups.** In the Link requests panel, **Pending** stays open and unchanged. **Linked by request** and
**Declined** each start collapsed: a button with the group's title and count (`aria-expanded`, `aria-controls`). Opened,
each request is one line: repository (`<bdi>`), project key (`<bdi>`), decided date. A line is itself a button
(`aria-expanded`); opened, it shows the request's details (owner id, proposed key, engine, contract, first and last
request, decided) and its actions, which stay those of OD-12 §7: **Decline** · **Export** · **Delete** for a linked
request (Decline is how a project is disconnected, so it stays), **Export** · **Delete** for a declined one. Focus stays
on the line that was opened. The open state lives in the page only: nothing is stored (no cookie, browser storage, URL
parameter or database value).
**6. Placement.** Three new rows, Phase P04 (owner controls and the neon map):
- **T20**, risk 3, four stages: the migration, pgTAP and types; the server module, loader and action; the project
  page's Delete project with the overview toast; then the e2e with captures and the ledgers. It stops at the human gate (a schema change,
  PR-17).
- **T21**, risk 2: the collapsed groups of §5, with their e2e and captures.
- **T22**, risk 2, gate **G-Neon-Map**: the neon glow of §4 in both themes, with captures and the contrast unchanged.

At G-Neon-Map the owner checks on the preview (or production after T20 and T21 have deployed):
- a project registered by hand is deleted after typing its key, and disappears from the overview and the list; a
  linked project's page shows no Delete project, only the panel's Delete;
- in both themes, at 1280 and 390, the blades and cards glow neon and match the T22 tokens; reduced motion shows a
  steady glow;
- with two or more linked requests, the panel opens with "Linked by request (N)" collapsed; tapping it lists one line
  per request, and tapping a line shows its details and actions.

The owner signs by merging T22.
**7. Nothing else moves.** No route (the deletion is a server action on the existing page), header, CSP, dependency,
secret or variable (`docs/setup-items.json` not needed). The `devos:boundary` line does not change: the new field and
action lie inside the `owner` zone, and nothing about a visitor is accepted or kept. The deleted data of a hand-registered
project is the owner's own (its owner id is the owner's, `/projects/new`); the audit row holds no personal data. Backups
keep a deleted project for up to 30 days (PR-18, `PROTECTION_MODEL.md` §9).
**8. Carry-forwards.** T20 adds pgTAP files, so it lands CF-035's missing test (the purge's second loop re-checks its
condition, `docs/method/CARRY_FORWARDS.md`), and it lands `docs/reviews/T18-a1.md` (a) as a new row.
**Does not decide:** deleting a project from the overview, the list or the detail panel (the project page only); undo
or a soft delete; deleting a linked or disconnected project other than through the panel; renaming a project's key;
remembering which groups are open; a glow on the counts card, panels or the sidebar; an in-app glow or motion control;
glow on the sign-in pages.
