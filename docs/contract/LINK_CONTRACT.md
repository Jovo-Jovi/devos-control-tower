# Link contract v1

A DEV_OS project whose developer opted in asks the Tower to link it. This document is normative for
`POST /api/link` (OD-12 §2, OD-13). The repository and its owner id come only from the token's claims.
Event contract v1 does not change.

## 1. Transport

`POST {TOWER_URL}/api/link` — production host only (OD-04 §2, OD-12 §2). Anywhere else the answer is
`404`.

`Content-Type: application/json`.

`Authorization: Bearer <GitHub Actions OIDC token>`. The token's audience is `TOWER_URL`.

## 2. Body and schema

At most 1 024 bytes. A body of exactly 1 024 bytes is read. A larger declared `Content-Length`, or more
than 1 024 bytes read, is `400`.

The body is a JSON object with exactly these four keys. Any other key, a missing key, a different `v`,
or a value that fails its pattern is `400 {"error":"schema"}`.

| Field | Rule |
|---|---|
| `v` | the number `1` (the string `"1"` is rejected) |
| `key` | `^[A-Z][A-Z0-9_-]{1,31}$` |
| `engine` | `^[!-~]{1,32}$` — 1 to 32 printable ASCII characters, no space |
| `contract` | `^[!-~]{1,32}$` — the same pattern as `engine` |

Example:

```json
{ "v": 1, "key": "PILOT", "engine": "0.1.0", "contract": "1" }
```

## 3. Claims used

The token's `repository` and `repository_owner_id`, and no other claim.

`repository` must match `^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$`. `repository_owner_id` must match
`^[0-9]{1,20}$`. Anything else is `401 {"error":"bad_signature"}`.

The body never supplies the repository or the owner id. A body field named `repository` is an extra
field and fails the schema in §2, and only after the token has been accepted.

## 4. Order of checks

OD-12 §2, in this order. Authentication (checks 2 to 4) comes before the body (check 5). A request
with no token answers `401 {"error":"no_token"}` even when the body is missing or invalid.

1. **Host.** `VERCEL_ENV` is `production` and the `Host` header equals the host of `TOWER_URL`.
   Otherwise `404 {"error":"not_found"}`. An unset or invalid `TOWER_URL` is not the production host.
2. **Bearer.** `Authorization: Bearer <token>` is present. Otherwise `401 {"error":"no_token"}`.
3. **OIDC.** `verifyGithubOidc` with audience `TOWER_URL`, as `/api/ingest` uses it. A failure answers
   `401` with `expired`, `bad_issuer`, `bad_audience` or `bad_signature`. A key set that cannot be
   fetched answers `503 {"error":"unavailable"}`.
4. **Claims.** `repository` and `repository_owner_id` match §3. Otherwise `401 {"error":"bad_signature"}`.
5. **Body.** §2. Otherwise `400 {"error":"schema"}`.
6. **`request_link`.** The repository and the owner id are the claims from check 4. The key, engine and
   contract are the body. The answer is one of §5.

## 5. Answers

Every answer is JSON, with `Cache-Control: no-store`, and never `Set-Cookie`. Nothing is logged.

No answer changes a project's step, verdict, merge or deploy (OD-12 §1). The engine continues the same
way whether the link is approved, pending, declined or never asked.

Only a `401` writes a row. The row is the reason and the time it was received. A failed write does not
change the answer. No other answer writes a rejection row.

| Answer | Meaning | Sender's action |
|---|---|---|
| `200 {"status":"linked","key":"<key>"}` | The request is approved, or a project already has this repository and owner id. `<key>` is that project's key. | Keep the key. A later call for the same repository returns this again. Do not change the project's step, verdict, merge or deploy. |
| `202 {"status":"pending"}` | A pending request exists, or this call created one. A repeat updates `last_requested_at`, `engine_version` and `contract_version`. The proposed key stays as first asked. | Ask again on a later run. The owner has not decided. |
| `403 {"status":"declined"}` | The owner declined this repository. | A later call stays declined until the owner deletes the request. |
| `400 {"error":"schema"}` | The body violates §2, including a body over 1 024 bytes. | Fix the sender. Do not retry the same body. |
| `401 {"error":"<reason>"}` | Authentication failed. `<reason>` is `no_token`, `expired`, `bad_issuer`, `bad_audience` or `bad_signature`. One reason-only rejection row is written. | Retry on a later run. |
| `404 {"error":"not_found"}` | Not the production host. | Fix `TOWER_URL`. The call never reached the token check. |
| `429 {"error":"rate_limited"}` | Nothing was created. The cap is 50 pending in all, or 3 pending for one owner id (OD-13 §3). A repeat of an existing request is not counted against either cap. | Retry on a later run. |
| `500 {"error":"server_error"}` | The service client could not be created, or `request_link` returned an error or an unexpected result. | Retry on a later run. |
| `503 {"error":"unavailable"}` | The OIDC key set could not be fetched. No rejection row is written. | Retry on a later run. |

## 6. What the Tower keeps

The request row, with retention as in `PROTECTION_MODEL.md` §5. The job `tower-link-retention` runs
`purge_link_requests()` daily at 03:17 UTC, and each deletion re-checks its condition (OD-13 §1):

| Record | Kept | Then |
|---|---|---|
| a pending request, or a declined one without a project | until 180 days after its `last_requested_at` | deleted; audit `purged` |
| a disconnected project and its request | until 365 days after `decided_at` | the request and the project, with its runs, events, usage and observations, are deleted; audit `purged` |
| a linked project and its request | while it is linked | — |
| `link_audit` rows | kept (no personal data) | — |

Reason-only rejection rows, as §5 describes. The Tower stores the reason and the time, and no token, no
claim and no body.

Nothing is logged. No token, no claim, no body and no error text is written to a log.

## 7. Change log

v1 — 2026-10-26, first version (T17).
