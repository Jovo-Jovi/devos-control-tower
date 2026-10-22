# Request — issue #40: sign page edit and link preview

## What was asked (the owner's words, from `.devos/request.md`)

> The sign-in page main page https://devos-control-tower.vercel.app/ has no light mode only dark mode. I need switch
> to light and dark modes. Also another issue: when I copy link in WhatsApp there is no preview image. Create one
> from actual site.
>
> Why: because it's basics of any web app and also link should have preview.
> How you will judge it done: check your tools for suitable check.
> How big: small change (one or two tasks). Priority: next up.

No answers were added in the issue thread.

## What the repository shows

- The sign-in pages (`/sign-in`, its 403 denied state, `?reason=auth_error`, `/auth/callback`) render `SignInCard`
  without the `ThemeSwitch`, which lives only in the signed-in top bar (`src/app/AppHeader.tsx:34`). They follow
  **Auto** (`prefers-color-scheme`, OD-08 §1), so a device set to dark always shows dark there: that is the "only
  dark mode" the owner sees. Light exists and works (T04, `e2e/shell.spec.ts` test `Theme switch, nothing stored`).
- No page sets Open Graph or Twitter-card metadata (`src/app/layout.tsx` sets only `title` and `description`), and
  there is no `og:image`, so WhatsApp has nothing to show. A signed-out `/` answers `302` to `/sign-in`, so the
  preview a crawler sees is the sign-in page's `<head>`.
- Every path outside `/_next/`, `/api/` and the sign-in and auth routes is behind the sign-in proxy
  (`src/proxy.ts`); bundled images under `/_next/static/media/` already reach signed-out visitors (OD-08 §7).

## What was decided (OD-11, DRAFT)

1. **T13 (risk 2):** the existing switch (Auto · Light · Dark) at the foot of every sign-in state, outside the card.
   Same behaviour as in the top bar: nothing stored, a reload returns to Auto (OD-08 §3 stands). Fence:
   `docs/fences/T13.md`.
2. **T14 (risk 2, gate G-Link-Preview):** Open Graph and Twitter-card tags on every page, and a 1200×630 JPEG
   (≤ 300 000 bytes, WhatsApp's practical limit) **captured from the real `/sign-in`** of the production build, in
   dark with the still planet, by a committed script so it can be captured again. The image is bundled and served
   from `/_next/static/media/`, so the proxy, headers, CSP and routes do not change. `metadataBase` comes from the
   existing `TOWER_URL`. The owner signs by pasting the production URL into WhatsApp after the deploy.
3. "Check your tools": T13 is proven by an e2e test (switch present on every state, Light and Dark change the
   theme tokens, nothing stored, reload → Auto) and the runner's captures in both themes; T14 by an e2e test that
   reads the tags inside `<head>` with WhatsApp's user agent and fetches the image without a session, plus the
   owner's WhatsApp check at the gate.

## What was left out, and why

- **Remembering the choice** across reloads or the GitHub round trip: OD-08 §3 forbids storing it; a preference
  cookie would be a Boundary amendment (OD-08 "Does not decide"). The owner can ask for it as its own decision.
- **A proxy or header change** for a public image route: not needed, since the bundled image path is already open.
- **The switch on the not-found page, a public landing page, indexing/`robots`, per-page preview images, a light
  preview image:** not asked; each can be a small change later.
- **Renumbering:** none. T13 and T14 follow T12 in id order.
