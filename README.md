# StockPilot

Inventory intelligence for small manufacturers — a lightweight MRP system that
tells you what you can build, what you're short on, what to buy, and when
you'll run out. Fully deterministic: no LLM in the core engine.

## Problem

Small manufacturers plan production and purchasing from spreadsheets or gut
feel. They can't quickly answer "can we fulfill this order?", "what should we
buy right now?", or "which orders are at risk?" — and the moment two people
touch inventory at the same time, spreadsheets silently go wrong.

## Solution

StockPilot models the manufacturing domain directly — products, materials,
bills of materials, warehouses, suppliers, and an immutable stock-movement
ledger — and answers those questions with explainable, deterministic
calculations instead of a black box.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Next.js App Router                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Pages (UI)  │  │  Route Handlers │  │  Server Components │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                 │                    │              │
│         └─────────────────┼────────────────────┘              │
│                           │                                   │
│                    ┌──────┴──────┐                            │
│                    │   can()      │  (RBAC gate)              │
│                    │   withTenant │  (RLS session binding)    │
│                    └──────┬──────┘                            │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│              PostgreSQL (single schema, RLS)                   │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐   │
│  │ tenants  │ │  users   │ │ memberships│ │  audit_logs   │   │
│  └──────────┘ └──────────┘ └────────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐   │
│  │ materials│ │ products │ │   boms     │ │stock_movements│   │
│  └──────────┘ └──────────┘ └────────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐   │
│  │warehouses│ │   bom_items│ │sales_orders│ │notifications │   │
│  └──────────┘ └──────────┘ └────────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐                    │
│  │ suppliers│ │supplier_mat│ │purchase_orders│                 │
│  └──────────┘ └──────────┘ └────────────┘                    │
│  ┌──────────┐ ┌──────────┐                                   │
│  │ machines │ │prod_orders│                                   │
│  └──────────┘ └──────────┘                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │        Redis + BullMQ       │
              │  (job queue, separate worker)│
              └────────────────────────────┘
```

- **Next.js (App Router)** — UI + REST API via Route Handlers; server
  components read the session cookie directly
- **PostgreSQL** — source of truth; every tenant-owned table is RLS-protected
  with a single `tenant_id = current_setting('app.current_tenant_id')` policy.
  The app connects as a plain role (no superuser, no BYPASSRLS).
- **Redis + BullMQ** — background jobs (purchase recommendations, reorder-point
  refresh, forecast refresh, notifications). The worker is a separate process
  (`pnpm run worker`). In v1 the recommendations screen recomputes on demand;
  the worker stubs are wired for when a queue runner is added.
- **Docker Compose** — local dev parity with production (Postgres + Redis).

### Key design decisions

- **Row-level security, not application-only tenancy.** RLS is the backstop.
  Even if application code has a bug, the DB won't return another tenant's
  rows. See `prisma/policies.sql` and the Day 1 vs Day 2 leak-query comparison
  in `docs/writeups/day1-leak-before-rls.md`.
- **Single `can()` permission gate.** Every API handler checks `can()` before
  touching data. The permission matrix lives in `server/rabc/permissions.ts`.
- **`withTenant()` everywhere.** Every DB query runs inside `withTenant()`,
  which sets `app.current_tenant_id` via `SET LOCAL` in a transaction. There
  is no code path that queries the DB without a tenant context (except the
  `get_user_role_bindings` SECURITY DEFINER function used during login).
- **Immutable movement ledger.** `recordMovement()` is the only function that
  mutates `current_stock`. Every inventory change is an append-only row.
- **Pessimistic row locking for reservations.** `SELECT ... FOR NO KEY UPDATE`
  inside a transaction closes the check-then-act race. See
  `docs/writeups/concurrency-case-study.md`.

## Features

- Multi-tenant, role-based access (Owner / Production Manager / Purchasing /
  Warehouse Staff / Viewer)
- Dashboard overview: materials, orders at risk, production capacity, expected
  stockouts, late deliveries — all real numbers from the DB
- Bill-of-materials–driven "max buildable units" calculation (420 chairs
  limited by backrests in the seed data)
- Sales-order → material-requirements explosion with shortage detection
  (`StatusBadge variant="danger"` on shortage rows)
- Automated purchase recommendations and supplier ranking
  (`1 / (unitPrice * leadTimeDays)` scoring)
- Reorder-point engine with `ReorderStatusBadge` on the materials DataTable
- 7-day moving-average demand forecasting (bar chart per material)
- Heuristic production scheduling (earliest-due-date-first, material-gated)
  with inline status transitions (SCHEDULED → STARTED → COMPLETED/CANCELLED)
- Immutable stock-movement ledger with `MovementTypeBadge` color coding
  (green PURCHASE/RETURN, red SALE/DAMAGE, neutral TRANSFER/ADJUSTMENT)
- Concurrency-safe reservations (`FOR NO KEY UPDATE` lock) with a race test
- Manual stock adjustments with idempotency-key replay protection
- Deadlock-safe warehouse transfers (lock warehouses in ascending id order)
- Full audit log, structured logging (`lib/logger.ts`), health/readiness
  probes (`/api/health`, `/api/ready`)
- In-app notifications with `NotificationBell` (Popover + unread Badge)

## Tech Stack

TypeScript, Next.js 16, PostgreSQL 16, Prisma 8 (contract + raw SQL), Redis 7,
BullMQ, Docker, Tailwind CSS 4, Radix UI primitives, Lucide icons.

## First run (demo walkthrough)

StockPilot ships with seeded demo data (Acme Manufacturing + Beta Plastics,
including the CHAIR-001 executive-chair example). After the setup below, the
fastest way to experience the product is:

1. **Dashboard** — `/dashboard`. Read the stat tiles (materials, orders at risk,
   production capacity, expected stockouts) and the at-risk list. This is the
   before-state for the whole demo.
2. **Max buildable** — open a product page (e.g. CHAIR-001) then
   `/products/<id>/max-buildable`. Confirm the seed says 420 chairs, limited
   by backrests. This is the core "can we manufacture N units?" answer.
3. **Requirements / shortage** — create a sales order for CHAIR-001, then open
   `/sales-orders/<id>`. The requirements table flags shortage rows with
   `StatusBadge status="danger"`.
4. **Purchase recommendations + supplier ranking** — `/purchasing/recommendations`
   then drill into `/purchasing/recommendations/<id>/suppliers`. Recommended vs
   alternative suppliers are shown with plain-text reasoning.
5. **Production schedule** — `/production/schedule`. Machines × days grid with
   color-coded order chips. Start/complete a production order from
   `/production/orders` to watch the grid update.
6. **Movement ledger** — `/inventory/materials/<id>/history`. Every stock
   change is an append-only row with `MovementTypeBadge` color coding.
7. **Concurrency demo** — open two tabs on
   `/inventory/materials/<id>/reserve` and reserve from the same material
   simultaneously. One succeeds; the other fails with an insufficient-stock
   alert. This is the Day 12 centerpiece.

```bash
docker compose up -d            # Postgres + Redis
cp .env.example .env            # fill in DATABASE_URL, REDIS_URL, etc.
npx prisma contract emit       # regenerate types from schema
dotenv -e .env -- npx prisma db migrate   # apply migrations
pnpm run db:seed                # seed demo data (Acme + Beta)
pnpm dev                        # web, http://localhost:3000
pnpm run worker                 # background jobs, separate terminal
```

### Running with the DB already migrated

```bash
pnpm run build:app              # contract emit + Next.js build
pnpm start                      # production server
```

### Applying migration scripts manually

When `db migrate` is blocked by RLS verification, use the manual SQL scripts:

```bash
pnpm run db:apply-week3          # Week 3 tables (suppliers, machines, etc.)
```

## Testing

```bash
# Unit + integration smoke tests (no DB needed for unit tests)
pnpm exec tsx tests/unit/reorder-point.test.ts
pnpm exec tsx tests/unit/max-buildable.test.ts

# Integration smoke (needs DB + running dev server + session cookie)
TEST_SESSION_COOKIE=... pnpm exec tsx tests/integration/smoke-overview.test.ts

# Concurrency race test — the centerpiece test (needs DB)
pnpm exec tsx tests/concurrency/stock-race.test.ts
```

The race test seeds a material with 10 units and fires two concurrent
reservations (8 and 7). Exactly one wins. It runs 10 iterations in a loop.

## Load testing + benchmarks

```bash
# Load test: hammer materials/schedule/overview endpoints
LOAD_CONCURRENCY=10 LOAD_DURATION_MS=30000 TEST_SESSION_COOKIE=... \
  node scripts/load-test.js

# Query benchmark: time the inventory availability query at different scales
BENCH_ITERATIONS=100 BENCH_MATERIAL_COUNT=50 \
  pnpm exec tsx scripts/benchmark-inventory-query.ts
```

## Deployment

1. Push to the deploy target (VPS, Render, Fly.io, etc.).
2. Start Postgres + Redis (Docker Compose or managed).
3. Apply migrations: `dotenv -e .env -- npx prisma db migrate`.
4. If RLS verification blocks the migrate step, run the manual SQL scripts
   in `scripts/` instead.
5. Seed: `pnpm run db:seed` (only on first deploy or when reseding).
6. Start the web process: `pnpm start` (or `pnpm dev` in dev).
7. Start the worker process separately: `pnpm run worker`.
8. Point a reverse proxy (Caddy, nginx, etc.) at the web process.

## Security Considerations

- Tenant isolation enforced at the database layer via PostgreSQL RLS, not
  only in application code. Every tenant-owned table has a policy that
  compares `tenant_id` to `current_setting('app.current_tenant_id')`.
- The app DB role is a plain role (no `SUPERUSER`, no `BYPASSRLS`). Confirm:
  `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app'` —
  both must be `f`.
- Passwords hashed with argon2; sessions are server-side (DB-backed token
  hash) and revocable.
- Every mutation is permission-checked through a single `can()` function and
  recorded in an append-only audit log.
- Stock reservations use `FOR NO KEY UPDATE` row locking inside a transaction
  to close the check-then-act race.
- Idempotency keys on stock movements prevent double-counting on retry.
- Transfers lock warehouses in ascending id order to prevent deadlocks.
- The Day 26 security sweep (see
  `docs/writeups/security-sweep-week4.md`) verified all 7 break tasks:
  concurrent stock consumption, idempotency replay, negative inventory guard,
  cross-tenant ID guessing, production order delete vs ledger integrity,
  worker crash duplicates, and sales-order double-submit.

## Performance Considerations

- Inventory reservation is O(1) per material: a single row lock + check +
  update, no table scans.
- Max-buildable and schedule both load the BOM + material stock in bounded
  queries (one per BOM line / one per material). The benchmark script
  (`scripts/benchmark-inventory-query.ts`) documents the baseline.
- Load-test script (`scripts/load-test.js`) can be pointed at any running
  instance to get p50/p95/p99 latency for the heavy endpoints.
- The overview dashboard computes all tiles in a single server-side request
  (one round trip to Postgres per tile group, all inside `withTenant`).
- RLS adds a small per-query overhead (the policy evaluation). At this scale
  it is negligible; if a tenant grows past ~100k rows in a table, consider
  adding composite indexes that include `tenant_id` as the leading column.

## Screenshots

All screenshots below are from the seeded demo (Acme Manufacturing + Beta
Plastics) with the chair example (CHAIR-001) and 2-3 additional products.

### Dashboard overview (dark mode)

![Dashboard overview — dark mode](/screenshots/dashboard-dark.png)

### Dashboard overview (light mode)

![Dashboard overview — light mode](/screenshots/dashboard-light.png)

### Max buildable — 420 chairs, limited by Backrests

![Max buildable — dark mode](/screenshots/max-buildable-dark.png)

![Max buildable — light mode](/screenshots/max-buildable-light.png)

### Sales order requirements with shortage rows

![Sales order requirements — dark mode](/screenshots/sales-orders-dark.png)

![Sales order requirements — light mode](/screenshots/sales-orders-light.png)

### Supplier ranking

![Supplier ranking — dark mode](/screenshots/supplier-ranking-dark.png)

![Supplier ranking — light mode](/screenshots/supplier-ranking-light.png)

### Production schedule grid

![Production schedule grid — dark mode](/screenshots/schedule-dark.png)

![Production schedule grid — light mode](/screenshots/schedule-light.png)

### Material movement ledger

![Material movement ledger — dark mode](/screenshots/movement-ledger-dark.png)

![Material movement ledger — light mode](/screenshots/movement-ledger-light.png)

### Reserve stock — two-tab concurrency demo

[Insert screenshot: two browser tabs on /inventory/materials/<id>/reserve,
one showing a success Alert, the other showing an insufficient-stock error.]

## Tradeoffs

- Shared-schema + RLS multi-tenancy chosen over schema-per-tenant for
  operational simplicity at this scale; documented migration path if a
  future tenant needs dedicated isolation.
- Production scheduling is a greedy earliest-due-date-first heuristic,
  not an optimizer — documented as a known limitation, not hidden.
- BOMs are single-level in v1; multi-level (sub-assembly) explosion is
  future work.
- Purchase recommendations are computed on demand, not persisted by a worker
  in v1 — the Day 16 job stubs are wired but not yet connected to a queue
  runner. Add idempotency keys before the worker writes to a recommendation
  table.
- Sales-order creation is not idempotent (no idempotency key yet) — a retry
  creates a second distinct order. Add an idempotency key field if duplicate
  suppression is needed.

## Future Improvements

- Multi-level BOM explosion with cycle detection
- Exponential smoothing / seasonality in forecasting
- Optimization-based (not greedy) production scheduling
- Persisted purchase recommendations with a connected BullMQ worker and
  idempotency keys
- Sales-order idempotency key
- StockPilot 2.0: an optional AI layer on top of this deterministic core —
  a natural-language interface that calls the existing planning endpoints,
  framed explicitly as an assistant layer, not a replacement for the engine.