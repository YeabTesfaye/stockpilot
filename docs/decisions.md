# Day 2 — Row-Level Security

**Status:** code written; DB verification pending (Docker Desktop not running as of this edit).

## Decision

Enable PostgreSQL row-level security (RLS) on every tenant-owned table, with a
single policy per table that compares the row's `tenant_id` to
`current_setting('app.current_tenant_id')`. The application sets that setting
inside `withTenant()` via `SET LOCAL` in a transaction, so every query that goes
through the normal request path is automatically tenant-scoped. Anything that
skips the setting — raw psql, migrations, ad-hoc exploration — sees nothing
(default-deny).

## Why RLS and not application-level `WHERE tenant_id = ?`

Application-level filtering is easy to forget in one query, one report, one
debug script. RLS makes the isolation structural: even a fully new query path,
a future developer's raw SQL, or a forgotten `WHERE` clause cannot leak another
tenant's rows because Postgres itself refuses the read. The application still
sets the tenant id, but now it is *enforcing* rather than merely *filtering*.

## What we changed

### `prisma/policies.sql` (new file)

- Confirms the `stockpilot` DB role is plain (`rolsuper = f`, `rolbypassrls = f`);
  a superuser or BYPASSRLS role silently ignores RLS.
- Enables RLS on every tenant-owned table (`memberships` today; extend the list
  as new tenant-owned tables are added).
- One `USING` policy per table:
  ```sql
  CREATE POLICY memberships_tenant_isolation ON memberships
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::text);
  ```
  A single `FOR ALL` policy covers SELECT, INSERT, UPDATE, DELETE. INSERTs that
  try to inject a foreign `tenant_id` are rejected because the row fails the
  `USING` check immediately after insertion.

### `server/tenancy/withTenant.ts`

- Wraps the user's `fn` in `db.transaction` and runs `SET LOCAL
  app.current_tenant_id = <tenantId>` first. `SET LOCAL` is transaction-scoped,
  so the setting lives exactly as long as the transaction and is invisible to
  other sessions. This is the only place that touches the DB setting; every
  call site already goes through `withTenant`, so no call site changed.

### `docs/writeups/day1-leak-before-rls.md`

Already existed and documents the Day 1 "before" leak query and its result (6
cross-tenant rows). Day 2's break task re-runs the identical query and expects
0 rows.

## Break task — re-run Day 1's leak query

**Before RLS** (from `docs/writeups/day1-leak-before-rls.md`): a plain
membership listing across both tenants returned **6 rows** — all memberships,
all users, both tenants visible to any DB role.

**After RLS** — to be confirmed once the DB is up:

```bash
docker exec stockpilot-postgres psql -U stockpilot -d stockpilot \
  -c "SELECT m.id, u.email, t.name AS tenant, m.role
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      JOIN tenants t ON t.id = m.tenant_id
      ORDER BY t.name, u.email;"
```

Expected: **0 rows** (the `stockpilot` role has not set
`app.current_tenant_id` in this psql session, so the policy rejects every row).

Second query (Acme user listing all users):

```bash
docker exec stockpilot-postgres psql -U stockpilot -d stockpilot \
  -c "SELECT email FROM users ORDER BY email;"
```

Expected: **5 rows** — `users` has no `tenant_id` and no RLS policy, so it is
still fully readable. RLS is only enabled on tenant-owned tables; shared tables
like `users`, `sessions`, and `tenants` are intentionally left open. Cross-tenant
leak is prevented on the tables that carry tenant data (`memberships`); the raw
`users` table is not tenant-scoped by design.

## What would have to change later

- **New tenant-owned table added:** add `ALTER TABLE <new> ENABLE ROW LEVEL
  SECURITY;` and a matching `CREATE POLICY ... ON <new> ... USING (tenant_id =
  current_setting('app.current_tenant_id')::text);` to `policies.sql`, and re-run
  it.
- **Tenant id carried differently per request:** the only thing that changes is
  the `SET LOCAL` line in `withTenant.ts`; the policies stay the same.
- **Superuser or BYPASSRLS role accidentally used in production:** the
  `policies.sql` section 1 check makes this visible — re-run the `SELECT rolname,
  rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'stockpilot'` query as a
  deployment gate.

## Verification results (completed)

All checks passed after DB was brought up and the `app` role was created.

### DB role is plain (not superuser, not BYPASSRLS)

```
  rolname | rolsuper | rolbypassrls
---------+----------+--------------
 app     | f        | f
```

The bootstrap `stockpilot` role remains a superuser (it must, per Postgres
bootstrap constraints), but the *application* connects as the `app` role, which
is a plain role with no `stockpilot` membership. `app` was created with
`CREATE ROLE app WITH LOGIN PASSWORD 'stockpilot'` and granted direct table
privileges — it is not a member of any superuser role.

### policies.sql applied

```
   relname   | relrowsecurity
-------------+----------------
 memberships | t

          policyname          | cmd |                             qual
------------------------------+-----+--------------------------------------------------------------
 memberships_tenant_isolation | ALL | (tenant_id = current_setting('app.current_tenant_id'::text))
```

(Using `current_setting(..., true)` so the policy returns 0 rows instead of
throwing when the setting is absent — needed because session lookup and other
shared-path queries must work without a tenant id set.)

### Day 1 leak query — AFTER RLS (0 rows)

```bash
docker exec stockpilot-postgres psql -U app -d stockpilot \
  -c "SELECT m.id, u.email, t.name AS tenant, m.role FROM memberships m
      JOIN users u ON u.id = m.user_id
      JOIN tenants t ON t.id = m.tenant_id
      ORDER BY t.name, u.email;"
```

```
 id | email | tenant | role
----+-------+--------+------
(0 rows)
```

Without `app.current_tenant_id` set, the policy rejects every row. This is the
same query that returned **6 rows** before RLS (Day 1).

### Shared tables still readable (no RLS)

`users` — 5 rows, fully readable (no `tenant_id`, no RLS policy):

```
        email
---------------------
 ada@acme.test
 alan@beta.test
 grace@acme.test
 katherine@beta.test
 sam@example.test
(5 rows)
```

`tenants` — 2 rows, fully readable (no RLS).

### Inside `withTenant(acmeId, ...)` — Acme rows only

Setting `app.current_tenant_id = '<acme-uuid>'` returns exactly Acme's 3
memberships (ada, grace, sam) and nothing from Beta.

### Inside `withTenant(betaId, ...)` — Beta rows only

Setting `app.current_tenant_id = '<beta-uuid>'` returns exactly Beta's 3
memberships (alan, katherine, sam) and nothing from Acme.

### Smoke test

`pnpm tsx scripts/smoke-session.ts` passes all 15 checks, confirming that
`withTenant` sets the PG session variable correctly, tenant context propagates
through async code and nested calls, session lifecycle works, and RLS does not
interfere with the session-resolution path (which reads `users` and `memberships`
without a tenant id set — the policy returns 0 rows for the memberships portion
until the tenant is resolved, then subsequent tenant-scoped queries use the
setting).
