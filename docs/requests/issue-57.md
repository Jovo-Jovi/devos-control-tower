# Request issue #57 — delete a registered project, neon glow, and a collapsed "Linked by request" group

Intake: 2026-10-31 · Decision: **accept** · OD-14 (DRAFT) · Tasks T20, T21, T22 (gate G-Neon-Map) · Phase P04.

## What was asked (the owner's words, abridged)

1. **Delete a registered project.** The page of a project registered by hand (Register project) gets Delete project,
   for the owner only. It asks for confirmation by typing the project's key, then deletes the project with its runs,
   step events, usage and observations. A project that came from a link request keeps today's path (the panel's
   Delete, which also deletes the request). Like `delete_link_request`, the delete runs through an owner-only database
   function with an audit row; still no DELETE policy and no write grant to an API role. Today the project TOWER (added
   by hand on 2026-10-19, no runs, events or link request) cannot be removed.
2. **Neon glow in both themes.** The energy lines (the blades, their glow, the ports and LEDs) and the project cards
   glow neon in each theme's energy colour (red in dark, blue in light). A card glows brighter on hover and when
   selected. Text stays as readable (the contrast checks still pass), and reduced motion turns the moving glow into a
   steady one. The new values are design tokens in `docs/DESIGN_SYSTEM.md`, never raw colours in components.
3. **"Linked by request" starts collapsed.** Only its title and count until tapped; opened, one line per request
   (repository, project key, decided date); tapping a line shows its details (owner id, proposed key, engine,
   contract, first and last request, decided) and its actions (Export, Delete). Pending stays open; Declined collapses
   too. A button with `aria-expanded`, and focus stays on the line that was opened.

Why: a quick overview once several projects are linked; a project registered by mistake cannot be removed; the glow
is the owner's visual direction. Size: feature (several tasks). Priority: next up.

## What was decided (OD-14)

- **Registered by hand** means a project that no `link_requests` row points to, in any state. Only such a project
  shows Delete project; the database function refuses the others (`linked`, nothing changes), so a linked or
  disconnected project keeps the panel's Delete. A project that `request_link` merely matches by repository and owner
  (no request row) counts as registered by hand.
- **Data:** one migration adds `project_audit` (id, time, action `deleted`, project id; RLS, one owner SELECT policy,
  no API-role write) and `delete_registered_project(p_key)` (`security invoker`, `service_role` only: `not_found` ·
  `linked` · `deleted`, locking the project row before the link check). The owner's server action calls
  `requireOwner()` first and compares the typed value with the key exactly. After a deletion the owner lands on `/`
  with "Project {key} deleted.". `DATA_MODEL.md`, `PROTECTION_MODEL.md` §6 and `GLOSSARY.md` (`ProjectAudit`,
  "Registered by hand") are updated in this PR.
- **Neon glow:** the T22 token block is written now in `DESIGN_SYSTEM.md` §1 (energy colour at alphas, both themes),
  with §3's rules and a §5.2 amendment. `box-shadow` and `filter` stay static (OD-08 §2 C); a card brightens through
  the opacity of its glow layer (rest 0.45, hover and focus 0.75, selected 1). Glows are outer only, so the contrast
  pairs and `tokens.test.ts` do not change. Reduced motion stops the hum and LED loops, leaving a steady glow.
- **Collapsed groups:** "Linked by request" and "Declined" are disclosure buttons with the count, collapsed at first;
  each request is a one-line disclosure button; the open state is never stored.
- **Placement:** T20 (risk 3, four stages, stops at the schema gate), T21 (risk 2), T22 (risk 2, gate **G-Neon-Map**,
  where the owner checks all three items). The fence `docs/fences/T20.md` is written; the reviewer who passes T20
  writes T21's, and the one who passes T21 writes T22's.
- **Carry-forwards:** T20 lands CF-035's missing pgTAP test (it adds a pgTAP file) and the T18 review's carry-forward
  (a) as a new row.

## Interpretations, and what was left out

- **Decline stays on a linked line.** The request lists the line's actions as "Export, Delete". OD-12 §7 makes Decline
  the only way to disconnect a linked project, and the request does not ask for that to go, so a linked request's line
  keeps Decline · Export · Delete. A declined line has Export · Delete.
- **Unlit blades stay unlit.** `down`, `stale`, `silent` and `disconnected` blades and ports gain no glow, so light never
  claims a live link (DESIGN_SYSTEM §0 rule 3). Every card glows whatever its state, because the card's glow is its
  frame, and the state stays told in words.
- **"Brighter on hover" by opacity, not by an animated shadow,** to keep OD-08 §2 C's rule that `box-shadow` and `filter`
  never animate.
- **The deletion is on the project page only.** It is not on the overview, list or detail panel. There is no undo or soft
  delete. These are listed under OD-14 "Does not decide".
- **The TOWER project itself** is deleted by the owner on production after T20's merge, not by any task: no agent
  touches the hosted database.
- No new route, header, dependency, secret or variable; the boundary line does not change.
