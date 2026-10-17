# ADR-002 — Owner authentication: Supabase Auth GitHub provider, one-id allow-list read from `auth.identities`, RLS owner-only

**Status:** Accepted, 2026-10-17 (decision 3; Step-1 answer Q4; Step-3 correction 1). Lands in
`devos-control-tower/docs/adr/` by T01.
**Source:** `devos-plan` @ `1a3c2a9` — `seed/05-decisions.md` #3, `plan/00-UNDERSTANDING.md` Q4,
`plan/M1.md` T01, `plan/TRACEABILITY.md` C-6.

## Context

The Tower has one user: its owner. Decision 3 fixes GitHub OAuth with a one-user allow-list. Two identities
were rejected as the allow-list key: the GitHub **username** (it can change and be re-registered) and
Supabase's **`user_metadata`** (a signed-in user can edit their own `user_metadata` through the user API, so
a `provider_id` copied there proves nothing). The GitHub **numeric user id** is stable, and Supabase Auth
writes it into `auth.identities.provider_id` for `provider = 'github'` on the server — a user cannot change
it through the API.

## Decision

- Sign-in: Supabase Auth, GitHub provider only. No password, no magic link, no other provider.
- Allow-list: table `public.owner_allowlist (github_id text primary key)`, created **empty** by the
  migration. The single row is inserted by the owner once, in the Supabase SQL editor — the value is in no
  migration, file, environment variable or secret. **RLS is enabled on the table and it has no policy for
  `anon` or `authenticated`** (no policy at all); `select`, `insert`, `update`, `delete` are revoked from
  both roles. Only the owner in the SQL editor and `security definer` code can touch it.
- **Claim path:** `auth.identities` where `user_id = auth.uid()` and `provider = 'github'` →
  `provider_id` (text, the GitHub numeric id).
- Function `public.is_owner()`, exactly:

  ```sql
  create or replace function public.is_owner()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select exists (
      select 1
      from auth.identities i
      join public.owner_allowlist a on a.github_id = i.provider_id
      where i.user_id = auth.uid()
        and i.provider = 'github'
    );
  $$;
  revoke all on function public.is_owner() from public, anon;
  grant execute on function public.is_owner() to authenticated;
  ```

  Every object inside the body is **fully qualified** (`auth.identities`, `public.owner_allowlist`,
  `auth.uid()`) because `search_path` is empty; this is what makes `security definer` safe here. It is the
  **only** `security definer` function in the Tower; any further one is its own ADR.
- Every RLS policy on every table in `public` (except `owner_allowlist`) is `using (public.is_owner())`,
  and `with check (public.is_owner())` where writes are allowed under a user session.
- Application gate: after sign-in, the server layer calls `select public.is_owner()`; `false` → the session
  is signed out and a 403 page is rendered. Dashboard pages and `/api/*` read routes require this gate.
  `user_metadata`, `raw_user_meta_data` and `app_metadata` are **never read** anywhere in the application.
- Machine routes (`/api/ingest`, `/api/github/webhook`, `/api/github/reconcile`) never use a user session;
  they authenticate by OIDC, ingest key or HMAC (pilot ADR-005, Tower ADR-003) and write with the secret key
  server-side. The secret key never reaches the client.

## Consequences

- A forged `user_metadata.provider_id` has no effect: T01's acceptance signs in a second GitHub account
  whose metadata was edited to the owner's id and expects `403` and `is_owner() = false`.
- A second owner or a project viewer later (`PROPOSALS.md` P-04) is a schema change: a second row or a new
  policy, each its own ADR.
- Recovery: if the owner's GitHub identity is unlinked, nobody can sign in; the owner re-inserts the row or
  relinks through the Supabase dashboard (out of band). No in-app recovery path exists by design.
- `supabase/migrations/**` and `src/**/auth/**` stay in `deep_paths`; the function and the policies get pgTAP
  tests: RLS enabled on every table, every policy references `public.is_owner()`, anon reads return 0 rows,
  `owner_allowlist` has no policy and no grant to `anon` or `authenticated`.
- **Advisors acceptance (T01):** Supabase Dashboard → Advisors → Security reports **no errors and no
  warnings** for the project after the T01 migration (no `function_search_path_mutable`, no
  `rls_disabled_in_public`, no `policy_exists_rls_disabled`, no exposed `security definer` view). The
  reviewer records the Advisors screenshot in the review.
- **`guard:data` unchanged (verified 2026-10-17):** the pilot's `scripts/guards/data.mjs` rule 4 fails a
  `security definer` function only when it does not `set search_path`; `is_owner()` complies as written, so
  the Tower copies the guard as-is. The stricter rule — `public.is_owner` is the **only** `security
  definer` function in the database — is a pgTAP assertion (`select count(*) from pg_proc where prosecdef`
  within the `public` schema → `1`), not a guard change.
- The forged-metadata test needs a second GitHub account (the pilot's `accounts.sh` pattern); if none is
  available at T01, a unit test of `is_owner()` with a fixture identity stands in and the manual test is
  recorded in the review.
