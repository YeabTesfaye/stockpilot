-- Row-level security policies for tenant-owned tables.
-- Run once after the initial schema migration and again after any future
-- tenant-owned table is added. Safe to re-run: IF EXISTS / IF NOT EXISTS guards
-- make it idempotent.

-- ---------------------------------------------------------------------------
-- 1. Ensure the DB role the application connects with is a plain role.
-- ---------------------------------------------------------------------------
-- The application connects as the `app` role (see .env). Confirm it is
-- neither a superuser nor carries BYPASSRLS — otherwise RLS is silently
-- ineffective. Also confirm `app` is not a member of any superuser role
-- (role membership inherits BYPASSRLS). Run this once as a superuser:
--
--   SELECT r.rolname, r.rolsuper, r.rolbypassrls,
--          BOOL_OR(pg_has_role('app', p.oid, 'MEMBER')) AS member_of_superuser
--   FROM pg_roles r
--   LEFT JOIN pg_roles p ON p.rolsuper = true
--   WHERE r.rolname = 'app'
--   GROUP BY r.rolname, r.rolsuper, r.rolbypassrls;
--
-- Expected: rolsuper = f, rolbypassrls = f, member_of_superuser = f
--
-- If any column is `t`, fix it:
--   ALTER ROLE app NOSUPERUSER;
--   ALTER ROLE app NOBYPASSRLS;
--   REVOKE <superuser-role> FROM app;   -- if app is a member of one

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on every tenant-owned table.
-- ---------------------------------------------------------------------------
-- Tenant-owned table = any table that carries a tenant_id column and whose
-- rows belong to exactly one tenant. Today that is just `memberships`.
-- When a new tenant-owned table is added, add an ENABLE ROW LEVEL SECURITY
-- line here and a corresponding policy in section 3.

-- Enable RLS on every tenant-owned table. Add a line here whenever a new
-- tenant-owned table is added to the schema.

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Per-table policies: rows visible only when tenant_id matches the session
--    setting `app.current_tenant_id`.
-- ---------------------------------------------------------------------------
-- The application sets this setting inside `withTenant()` (see
-- `server/tenancy/withTenant.ts`) via `SET LOCAL` inside a transaction, so
-- every query executed through the normal request path carries the right
-- tenant id. Raw SQL or psql sessions that skip the setting see nothing
-- (default-denect).

-- memberships: a row is visible only to members of its tenant.
-- The `USING` clause covers SELECT/UPDATE/DELETE; `WITH CHECK` covers INSERT.
-- Because the policy references `tenant_id` itself, INSERTs that try to inject
-- a foreign tenant_id are also rejected (the row fails the USING check
-- immediately after insertion). A single `FOR ALL` policy is sufficient.
--
-- Session-resolution exception: not done via GUC flag (which would leak across
-- pooled connections). Instead, a SECURITY DEFINER function
-- `get_user_role_bindings(p_user_id)` queries memberships with the privileges
-- of its owner (the stockpilot superuser), bypassing RLS. The app role is
-- granted EXECUTE on this function. This is used by createSession and
-- getSessionUser to read memberships without a tenant context.
CREATE POLICY memberships_tenant_isolation ON memberships
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- materials: a row is visible only to members of its tenant.
CREATE POLICY materials_tenant_isolation ON materials
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- products: a row is visible only to members of its tenant.
CREATE POLICY products_tenant_isolation ON products
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- warehouses: a row is visible only to members of its tenant.
CREATE POLICY warehouses_tenant_isolation ON warehouses
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- boms: a row is visible only to members of its product's tenant.
CREATE POLICY boms_tenant_isolation ON boms
  FOR ALL
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE tenant_id = current_setting('app.current_tenant_id', true)::text
    )
  );

-- bom_items: a row is visible only to members of its BOM's product's tenant.
-- Since bom_items.bom_id references boms.id, and boms.product_id references
-- products.id, we follow the chain through boms.
CREATE POLICY bom_items_tenant_isolation ON bom_items
  FOR ALL
  USING (
    bom_id IN (
      SELECT id FROM boms
      WHERE product_id IN (
        SELECT id FROM products
        WHERE tenant_id = current_setting('app.current_tenant_id', true)::text
      )
    )
  );

-- audit_logs: a row is visible only to members of its tenant.
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- stock_movements: a row is visible only to members of its tenant.
CREATE POLICY stock_movements_tenant_isolation ON stock_movements
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- sales_orders: a row is visible only to members of its tenant.
CREATE POLICY sales_orders_tenant_isolation ON sales_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- sales_order_items: a row is visible only to members of its sales order's tenant.
CREATE POLICY sales_order_items_tenant_isolation ON sales_order_items
  FOR ALL
  USING (
    sales_order_id IN (
      SELECT id FROM sales_orders
      WHERE tenant_id = current_setting('app.current_tenant_id', true)::text
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Footnotes
-- ---------------------------------------------------------------------------
-- - `USING` covers SELECT/UPDATE/DELETE; `WITH CHECK` covers INSERT. Because
--   the policy references `tenant_id` itself, INSERTs that try to inject a
--   foreign tenant_id are also rejected (the row would fail the USING check
--   immediately after insertion). For extra explicitness on INSERT you can add
--   a second policy:
--
--     CREATE POLICY memberships_tenant_isolation_insert ON memberships
--       FOR INSERT
--       WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::text);
--
--   Today the single ALL policy is sufficient and preferred (one place to
--   reason about).
--
-- - `current_setting` throws if the setting has never been set in the current
--   session. The application always sets it inside `withTenant`, so this is
--   fine in the request path. For ad-hoc queries (migrations, seeds, psql)
--   set it explicitly:
--
--     SET app.current_tenant_id = '<uuid>';
--
--   or use `current_setting(..., true)` to return NULL instead of throwing
--   when exploring the DB by hand.
