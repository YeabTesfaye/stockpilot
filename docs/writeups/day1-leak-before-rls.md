# Day 1 — Break task: cross-tenant data is visible (before RLS)

**Goal:** prove that with tenancy modeled but **no row-level security** yet, acting as
one tenant's user you can read another tenant's rows. This is the "before" half of
the Day 2 comparison — the identical queries get re-run after RLS and must return
nothing.

**Setup:** seed state (2 tenants, 5 users, 6 memberships). The app DB role is the
plain `stockpilot` role (no `BYPASSRLS`, not a superuser) — the same role the
application will use on Day 2.

## Query 1 — Naive membership listing, no tenant filter

```sql
SELECT m.id, u.email, t.name AS tenant, m.role
FROM memberships m
JOIN users u ON u.id = m.user_id
JOIN tenants t ON t.id = m.tenant_id
ORDER BY t.name, u.email;
```

Result — **all 6 memberships across both tenants**:

```
                  id                  |        email        |       tenant       |      role
--------------------------------------+---------------------+--------------------+-----------------
 1606d03b-4975-4b9b-8c97-caf8c3cd2fc0 | ada@acme.test       | Acme Manufacturing | OWNER
 f24ae66c-f0ef-41d4-9f09-0dd78a415487 | grace@acme.test     | Acme Manufacturing | WAREHOUSE_STAFF
 3560b5e9-b130-4b00-8ff2-770309a6355a | sam@example.test    | Acme Manufacturing | OWNER
 9349cf07-4dfd-43a2-8a35-78bc8fa4d8f8 | alan@beta.test      | Beta Plastics      | OWNER
 83995676-14aa-42be-980c-1288567b571d | katherine@beta.test | Beta Plastics      | VIEWER
 2f085730-c683-44d6-bd94-ac6ac0ebb014 | sam@example.test    | Beta Plastics      | VIEWER
(6 rows)
```

## Query 2 — "Tenant A" user lists every tenant's users

Acting as Ada (Acme) with no filter, the full user table is readable:

```sql
SELECT email FROM users ORDER BY email;
```

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

## What this proves

Nothing in the schema, the DB role, or the query path constrains reads to the
actor's tenant. Beta Plastics' users (alan@, katherine@) are fully visible to an
Acme user. Every query today is "the whole table"; on Day 2, with
`current_setting('app.current_tenant_id')`-based policies, both queries above must
return **0 rows** unless run inside a session that has set the tenant.

## How to re-run on Day 2

```bash
docker exec stockpilot-postgres psql -U stockpilot -d stockpilot \
  -c "SELECT m.id, u.email, t.name AS tenant, m.role FROM memberships m JOIN users u ON u.id = m.user_id JOIN tenants t ON t.id = m.tenant_id ORDER BY t.name, u.email;"
```
