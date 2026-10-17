# TOWER — Design system v1 ("Control-room ledger")

**Status:** approved **direction** (OD-06). Precedence 5. Each UI fence (T01, T04, T05, T06, T07) carries a
Design specification that refines this direction for its pages and states; the reviewer verifies the
screenshots against both. `guard:design` applies as copied from the pilot: logical properties only,
tokens only, no raw colour or px outside `src/styles/tokens.css`.

## 0. Idea

The Tower is read the way a controller reads a strip board or a ship's officer reads the log: **calm
surfaces, dense but ordered information, every fact with its origin and its time, nothing decorative,
nothing that claims more than the data holds.** One light theme. Status is said in words and shape,
never by colour alone. Numbers are tabular and right-aligned. Evidence is one click away from every
claim. Empty, loading, error and stale are designed states with their own words, never blank space or
a spinner alone.

Rationale: the product's value is truthfulness about other systems; the UI must make *reported*,
*observed*, *verified* and *imported* instantly distinguishable, make *age* visible without effort, and
make "unavailable" look like an honest gap rather than a zero.

## 1. Tokens (`src/styles/tokens.css` — the only file with raw values)

```css
:root {
  /* surfaces and ink */
  --color-ink: #1b1f27;
  --color-ink-muted: #5d6473;
  --color-paper: #f6f7f9;
  --color-surface: #ffffff;
  --color-line: #e1e4ea;
  --color-line-strong: #c3c8d2;
  --color-accent: #1f4fd1;        /* links, focus ring, primary action */
  --color-accent-ink: #ffffff;

  /* step status (text on bg; every pair ≥ 4.5:1) */
  --color-pass: #1a7f4b;     --color-pass-bg: #e6f4ec;
  --color-fail: #b42318;     --color-fail-bg: #fbeae7;
  --color-waiting: #9a6700;  --color-waiting-bg: #fff4d6;
  --color-revise: #6f42c1;   --color-revise-bg: #efe8fb;
  --color-skipped: #6b7280;  --color-skipped-bg: #eef0f3;
  --color-started: #0b63b6;  --color-started-bg: #e3f0fb;
  --color-stale: #7c4a03;    --color-stale-bg: #fdf0e1;

  /* origin (shape carries the meaning; colour only supports it) */
  --color-origin-verified: #1b1f27;
  --color-origin-imported: #9aa1ad;

  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px;

  --radius-1: 4px; --radius-2: 8px;

  --font-body: var(--font-sans), system-ui, sans-serif;
  --font-mono: var(--font-mono), ui-monospace, monospace;
  --text-0: 0.75rem; --text-1: 0.875rem; --text-2: 1rem; --text-3: 1.25rem; --text-4: 1.5rem; --text-5: 2rem;
  --leading: 1.5;

  --content-max: 1200px;
}
```

## 2. Type

- **IBM Plex Sans** 400/600 for text (`--font-sans`), **IBM Plex Mono** 400 for ids, shas, run keys,
  counts and times (`--font-mono`), loaded with `next/font/google` in the root layout (PR-24 retry
  applies; self-hosting follows the pilot's M2 fonts task when it lands).
- Scale: page title `--text-4` 600; section title `--text-3` 600; body `--text-2`; table and chip text
  `--text-1`; meta (age, origin, alias) `--text-0`. Line height `--leading` everywhere.
- Numbers: `font-variant-numeric: tabular-nums`, right-aligned, thousands separators from
  `Intl.NumberFormat`; a missing number is an em dash `—`, never `0`.
- Times: relative in text ("4 min ago"), absolute ISO in `title` and in the mono column of tables.

## 3. Components

| Component | What it shows | Rules |
|---|---|---|
| `AppHeader` | product name, the owner's avatar and login (from the GitHub identity), sign-out | one row; at 390 the login hides, the avatar stays |
| `StatusChip` | `step · status` as text in a chip (`verdict · pass`) | bg/text from the status pair; `started` carries a small pulsing dot (`prefers-reduced-motion` → static) |
| `OriginChip` | reported / observed / verified / imported | **shape**: reported = outlined; observed = dotted outline; verified = filled ink; imported = filled `--color-origin-imported`; always with the word |
| `AgeText` | "4 min ago" + `title` ISO | one element, mono for the ISO in tables |
| `FreshnessLabel` | fresh / stale with last-seen | stale uses the stale pair and reads "stale · last contact 2 d ago" |
| `HealthBanner` | "The Tower could not read its database at hh:mm — figures below are not shown." | full width under the header; every numeric region under it renders `StateBlock error` |
| `StateBlock` | loading / empty / error in words | fixed min-height so the layout does not jump; loading shows three hairline rows, no spinner alone |
| `ProjectRow` | name, repo, last activity, last contact, freshness, latest `StatusChip`, pass/total, origin chips | 1280: one line; 390: two lines (name + chips / times) |
| `Timeline` / `EventRow` | one event: `seq`, `StatusChip`, task, `OriginChip`, `AgeText`, `EvidenceLink` | ordered by `seq`; never by `at` |
| `EvidenceLink` | `path@commit` → `https://github.com/<repo>/blob/<commit>/<path>` | mono, truncates the path from the start with `title` |
| `UsageTable` | phase → task → attempt rows with agent, model, alias, four counts, `source` | tabular-nums; `unavailable` cells `—` with a legend; failed attempts in a separate table below |
| `CoverageLine` | "reviewer: 12 of 12 attempts measured · builder: 0 of 12 attempts measured" | first element of the Usage page, `--text-2` 600 |
| `OwnerForm` | labelled fields, inline errors, one primary button | labels above fields; errors in words next to the field; the button says what it does ("Register project") |
| `ImportResult` | counts (tasks, attempts, phases, duplicates) | plain table; no progress bar, no percentage |

## 4. Compositions

- **Sign-in `/sign-in`** (T01): centred card on `--color-paper`: product name, one sentence, the GitHub
  button; states signed-out · denied ("This GitHub account is not the owner. Signed out.") · error (the
  reason in words, a retry link).
- **Portfolio `/`** (T04): `AppHeader`; `HealthBanner` when needed; a totals line (projects, tasks passed
  / total, measured attempts); one `ProjectRow` per project; "Register project" link; states loading ·
  empty ("No project yet. Register the first one.") · error · stale rows.
- **Register `/projects/new`** (T04): `OwnerForm` with key, repository, stale window (default 1 440 min).
- **Usage `/projects/[key]/usage`** (T05): `CoverageLine` first; totals by agent and by model; `UsageTable`
  by phase/task/attempt; failed attempts table; legend; states loading · empty ("No measured usage yet.")
  · error · stale.
- **Project `/projects/[key]`** (T06): header with key, repo, freshness; phases with tasks and their
  latest `StatusChip`; `Timeline` per run (newest run first, events by `seq`); `OriginChip` and `AgeText`
  on every row; "usage" chip on build/review events linking to T05.
- **Import `/projects/[key]/import`** (T07): `OwnerForm` with one file field; states idle · uploading ·
  result (`ImportResult`) · error.

## 5. Quality floor

Contrast ≥ 4.5:1 for text, ≥ 3:1 for chip borders; visible focus ring (`--color-accent`, 2px offset);
everything reachable by keyboard in reading order; no colour-only meaning; tables become stacked
label/value rows at 390 (`<dl>` inside the row) with no horizontal scroll; no layout shift between
loading and loaded; every image has alt text (avatars: the login); `prefers-reduced-motion` honoured;
no third-party host in CSS or TSX except the GitHub avatar origin in the CSP and the GitHub blob URL in
`EvidenceLink` (`guard:design` allow-list, `B0-BOOTSTRAP.md` §4).

## 6. How the reviewer checks it

Screenshots at **1280 and 390** for every page and every state listed in the fence (`.devos/screens/`),
then a six-row ledger in the review — hierarchy · consistency with this document · accessibility ·
responsiveness · craft · **truthfulness** (no number without its origin and age; `unavailable` never
looks like zero; no progress claim the data lacks). In M1 the ledger is written by hand and the owner
reads it before merging; M3 makes `DESIGN REVISE` mechanical. A correct page that fails the ledger does
not pass.

## 7. Do / Don't

- Do say the origin and the age beside every fact. Don't merge last activity and last contact.
- Do render `unavailable` as `—` with a legend. Don't show `0`, a cost, or an estimate.
- Do order by `seq`. Don't sort events by `at`.
- Do keep one theme and one font family pair. Don't add icons libraries, charts or dashboards widgets.
- Do write empty and error states in words. Don't leave blank regions or a lone spinner.
- Do keep totals next to their coverage line. Don't total across agents with different coverage without
  it.
