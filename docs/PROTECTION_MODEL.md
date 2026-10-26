# TOWER — Personal-Data Protection model (OD-12 §6)

Precedence 4, with `BOUNDARY_MODEL.md`. The Boundary gate still holds in full for **visitors**. Nothing public
accepts, stores or sends a visitor's data. This model covers what the Tower keeps about **developers** whose DEV_OS
projects ask to be linked (OD-12). It is the Personal-Data Protection gate (handbook §10.3, PR-19) for the `owner`
zone, which the `devos:boundary` line marks `"personal_data": true`. The reviewer of every task from T15 on checks the
diff against it (`devos/prompts/reviewer.md`, "Personal data").

## 1. Whose data, and why

A developer who opts in when they set up the DEV_OS Engine has their project's GitHub Actions workflow call
`POST /api/link` with the workflow's OIDC token. The Tower reads the repository and its owner from the token's
claims. The developer is a member of the public, and a repository's full name carries their GitHub login when a
person owns it. So these values are personal data under Egypt's Law 151 of 2020, even though GitHub shows them
publicly for public repositories.

## 2. Personal fields, their purpose and who reads them

| Field | Where | Purpose | Who reads |
|---|---|---|---|
| `repository` (`owner/name`) | `link_requests` (T15) | show the owner which repository asks; match the developer's later requests | the owner, under RLS |
| `owner_github_id` (numeric) | `link_requests` (T15) | bind the request to the token's owner, so a transferred repository is a new request | the owner, under RLS |
| `first_requested_at`, `last_requested_at`, `decided_at` | `link_requests` (T15) | show how fresh a request is; drive retention (§5) | the owner, under RLS |
| `repo`, `owner_github_id` of a project an approval created | `projects` (T02) | the project's identity; `/api/ingest` checks the token's claims against it | the owner, under RLS; `/api/ingest` (service role) |
| that project's `runs`, `events`, `event_usage`, `observations` | T02, T03 | the Tower's purpose (OD-01 §1): show the linked project's steps, origin and age | the owner, under RLS |

These are not personal on their own, and they live and go with the row: `proposed_key`, `engine_version`,
`contract_version`, `state` and `project_id`. Not personal at all: `event_rejections` (reason and time) and
`link_audit` (action, time, a random request id).

**Never collected:** a name, an email, a login as its own field, an IP address, the token, or the body of a refused
request (`BOUNDARY_MODEL.md` §2, `SECURITY_MODEL.md` §4). The token is verified and dropped. Nothing is logged.

## 3. Lawful basis and transparency

The basis is the developer's **consent**. They opt in at setup, and every request comes from their own workflow. They
withdraw it by turning the link off in the engine, after which nothing more arrives, and by asking the owner to
delete what is kept (§6). The engine's documentation must tell the developer, before they opt in, what the Tower
keeps, why, for how long, and how to reach the owner. That text belongs to `devos-engine` (OD-12 "Does not decide").
The Tower owner makes sure it exists before G-Link-Requests.

## 4. Access, enforced by the database

- `anon` and every authenticated account other than the owner read **nothing**: RLS is `is_owner()` on every
  policy (`DATA_MODEL.md` §1, §3).
- The owner reads both link tables through one SELECT policy each. Neither `anon` nor `authenticated` can insert,
  update or delete `link_requests` or `link_audit`; `anon` cannot even select them.
- Every write is a `security invoker` link function that only `service_role` may execute (`DATA_MODEL.md` §4). It is
  called by `/api/link` after OIDC verification, or by the owner's server actions after `requireOwner()`.
- The data is not "sensitive" in Law 151's sense (no health, financial, biometric, religious, political, criminal or
  child data). Reads are therefore not audited row by row; every change and every export is (§8).

## 5. Retention (scheduled, tested)

The `pg_cron` job `tower-link-retention` runs `public.purge_link_requests()` daily at 03:17 UTC:

| Record | Kept | Then |
|---|---|---|
| a pending request, or a declined one without a project | until 180 days after its `last_requested_at` (a developer still asking keeps it alive, and a declined request keeps answering `403` while they ask) | deleted; audit `purged` |
| a disconnected project (declined after approval) and its request | until 365 days after `decided_at` ("stays for the record", OD-12 §4) | the request and the project with its runs, events, usage and observations are deleted; audit `purged` |
| a linked project and its request | while it is linked | — |
| `link_audit` rows | kept (no personal data) | — |

pgTAP (`supabase/tests/007_link_protection.sql`) proves both limits on each side and the job's schedule. From T17
(OD-13 §1) each deletion re-checks its condition, so a request approved or asked again while the job runs is kept with
its project (`008_link_safeguards.sql`).

## 6. Deletion

The owner's **Delete** in the "Link requests" panel (T16) calls `delete_link_request`. It removes the request and,
if one exists, its project with every run, event, usage row and observation (`on delete cascade`), and it writes an
audit `deleted` row. pgTAP (T15) and the T18 end-to-end test prove it. A developer's request to see, correct or
erase their data is answered with Export (§7) and Delete, within the period Law 151 and its executive regulations
set (§10).

## 7. Export

The owner's **Export** (T16) calls `export_link_request`. It returns the request, the project and its step events
(and, from T17, OD-13 §4, the project's usage rows and observations, which §2 lists as personal data) as one
JSON document, and writes an audit `exported` row. The browser downloads it, and nothing is stored on the
server or in the browser. Its shape is in `DATA_MODEL.md` §4.

## 8. Audit

`link_audit` gets one row per `requested`, `approved`, `declined`, `deleted`, `exported` and `purged`, with the time
and the request's id, and nothing else. The owner reads it under RLS.

## 9. Security of the data

- In transit, TLS is used for every hop: browser → Vercel → Supabase.
- At rest, the data sits in Supabase's encrypted storage.
- The production backups `devos-deploy` takes before each migration are AES-256 encrypted and kept 30 days (PR-18).
  A deleted request can therefore survive in a backup for up to 30 days, and is never restored except by the owner's
  decision.
- Keys live only in Vercel and GitHub secrets (`SECURITY_MODEL.md` §1).
- **No personal record exists outside production.** Seeds, pgTAP fixtures and tests use only synthetic values:
  `fixture-*` repositories, owner id `0`, test ids `424242` and `999`. No export file is committed. No agent queries
  the hosted database (`FULLSTACK_MODULE.md` §2).
- **The repository is private before the zone ships** (PR-19). It is public today (B0). T17's merge is the first
  deploy that accepts a link request, so the owner makes the repository private before merging T17, and T17's review
  records what it observed.

## 10. The owner's obligations under Law 151 of 2020 (for the handover)

The owner is the data controller. Before G-Link-Requests, the owner confirms each of these with counsel. This
document states them but does not settle their periods or procedures.

- Lawful basis: consent (§3), and its withdrawal.
- Purpose limitation and minimisation: only the fields of §2, for the purposes stated there.
- Accuracy: the values come from GitHub's signed token, never from the body.
- Limited retention: §5.
- Security: §9.
- The data subject's rights: to know, access, correct, erase and withdraw (§6–§7).
- Breach notification to the Personal Data Protection Center and to the affected developers, within the period the
  law sets.
- Any licence or registration a controller needs.
- The rules on **transfer outside Egypt**: Supabase and Vercel host the data abroad.
