# Refka backend (Supabase)

Everything the app needs lives in Postgres: 14 tables (RLS on, no policies, no table grants) and 36 RPC functions
(`security definer`, `search_path = public, extensions, pg_temp`). The front ends only call `rpc()`. See
`app/CONTRACT.md` for the API and its Deviations list.

```
supabase/migrations/0001_schema.sql            tables, indexes, lock down
supabase/migrations/0002_functions.sql         helpers, visibility rule, public + owner RPCs
supabase/migrations/0003_member_functions.sql  member RPCs
supabase/migrations/0004_grants.sql            who may execute what
supabase/deploy.sql                            all four in one file (generated, do not edit)
supabase/build-deploy.sh                       regenerates deploy.sql
supabase/tests/local_prelude.sql               LOCAL ONLY: fakes auth.* and the roles on plain Postgres
supabase/tests/run.js                          the test suite
```

## Apply to a new Supabase project

1. Create the project (region close to Egypt, for example Frankfurt `eu-central-1`).
2. Dashboard, SQL Editor, New query: paste all of `supabase/deploy.sql` and run it. It runs in one transaction.
   It is safe to run again later: tables use `if not exists`, functions `create or replace`, and grants are re-applied.
   Never run `tests/local_prelude.sql` on Supabase.
3. Check: Table Editor shows the 14 tables with RLS enabled; Database, Functions lists the RPCs.
4. Project Settings, API: copy the Project URL and the `anon` public key into `app/config.js`.
   Never put the `service_role` key in the front end.

Changing the backend later: edit or add a file in `migrations/`, run `supabase/build-deploy.sh`, run the tests,
then paste only the changed migration (or the whole `deploy.sql`) into the SQL editor. A change to an existing
table needs a new migration with `alter table`; `create table if not exists` will not change a table that exists.
If a function's return type or arguments change, `drop function` it first in that migration.

## Dashboard settings

Authentication, Sign In / Providers:
- Email provider: **on**. All other providers off (phone is not used: members log in with a synthetic email).
- Confirm email: **off** for the pilot. Member emails (`p<digits>@m.refka.tech`) cannot receive mail, and owners
  should be able to start right away.
- Minimum password length: **6** (the member PIN is 6 digits). The owner minimum of 8 is checked by the owner console.
- Allow new users to sign up: on.
- Secure email change: leave **on**. Users should not change their email (see Risks).

Authentication, URL Configuration: Site URL = the address where `/app/` is served; add it to Redirect URLs.

API settings: the exposed schema stays `public`. Nothing in it is readable as a table, so this is safe.

Rate limits (Authentication, Rate Limits): keep the defaults. Sign-ups from one gym's Wi-Fi share one IP, so raise
the sign-up limit if a gym onboards many members at once.

## Local development and tests

```
dev/db.sh start                 # local Postgres 16 on 127.0.0.1:55432
node supabase/tests/run.js      # resets the database refka_test, runs about 950 checks, exit 1 on any failure
node dev/seed.js                # resets the shared dev database refka with the demo gym (asks nobody, so warn people)
node dev/server.js              # Supabase-compatible mock on :54321
```

The tests drive every RPC as PostgREST would (one transaction per call, role anon or authenticated, JWT claims set,
STABLE functions read-only). They cover the owner and member journeys, the visibility matrix through every member
read function, QR rotation and replay, limits, size caps, cross-gym isolation, denied table access for anon and
authenticated on every table, function grants, phone and secret leaks, and that `deploy.sql` matches the migrations
and re-applies cleanly.

## Known risks for the pilot

- No proof of phone ownership: whoever signs up first with a phone's synthetic email owns that phone. The gym's list
  (or the owner's approval of a guest) is the only check. Members with a wrong account must be fixed by an admin.
- PIN reset needs an admin (service role or dashboard: Authentication, Users, set a new password).
- If a user changes his auth email before he has a profile, he could take an unclaimed phone. Keep "Secure email
  change" on, and do not offer an email change in the app.
- The owner console shows members' phones by design. The member app never does.

## Leaving Supabase later

The app depends on Supabase in only four places, so moving to plain Postgres (any host) plus a small auth service is
straightforward:

1. **Database**: `pg_dump --schema=public --no-owner --no-privileges` for schema and data, then re-run
   `0004_grants.sql` on the new server. Supabase gives you the connection string under Project Settings, Database.
2. **auth.users**: export `id, email, encrypted_password, raw_user_meta_data, created_at` from `auth.users`. Passwords
   are bcrypt hashes and can be verified by any bcrypt library, so users keep their PINs and passwords. Keep the
   same user ids, because every public table references them.
3. **auth.uid() and auth.jwt()**: create them on the new server exactly as `supabase/tests/local_prelude.sql` does
   (they read `request.jwt.claims`, which PostgREST sets from a verified JWT). The JWT must carry `sub` and `email`.
4. **HTTP API**: run PostgREST against the database (the same `/rest/v1/rpc/<fn>` calls), or any server that does
   what `dev/server.js` + `dev/common.js` do: verify the JWT, open a transaction, `set local role`, set the claims,
   call the function. The login endpoints (`signUp`, `signInWithPassword`, refresh) are the only part to replace;
   `dev/server.js` is a working small example.

Since the front end never touches tables, only `app/lib/api.js` (the supabase-js client) would need to change.
