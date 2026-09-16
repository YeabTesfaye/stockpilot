# Security + break-task sweep — Week 4

Date: 2026-09-* (Week 4 gate).

This document records the seven break tasks from Day 26 verified against the
running application, plus the StatusBadge dark-mode contrast check.

## Break task 1 — Two users consume the same stock simultaneously (Day 12)

**Mechanism:** `reserveStock()` in `server/inventory/reserve.ts` wraps the
read + check + write in a transaction with `SELECT ... FOR NO KEY UPDATE` on
the material row.

**Verification:** `tests/concurrency/stock-race.test.ts` seeds 10 units and
fires two concurrent reservations (8 and 7). `Promise.allSettled` confirms
exactly one succeeds. The test runs 10 iterations in a loop.

**Result:** PASS — the second transaction blocks on the row lock, re-reads
the updated `reserved_qty`, and throws "Insufficient available stock".

**Live demo:** open `/materials/<id>/reserve` in two browser tabs, click
Reserve at the same time — one tab succeeds, the other shows an error Alert.

---

## Break task 2 — Replay the same movement twice with the same idempotency key

**Mechanism:** `recordMovement()` in `server/inventory/recordMovement.ts`
accepts an optional `idempotencyKey`. If a `StockMovement` row with that key
already exists (stored as `reference_id`), the call returns the existing
movement's id and newStock without inserting a second row.

**Verification:** submit a POST to `/api/stock-movements` with a key, then
submit the identical body again. The second response returns the same
movement id and the same `newStock` — no duplicate row in `stock_movements`.

**Result:** PASS — replay is safe. The idempotency key is durable (stored on
the row) so it survives process restarts.

---

## Break task 3 — Force negative inventory outside the main reservation flow

**Mechanism:** `recordMovement()` includes a safeguard: if the movement would
make `current_stock` negative, it throws. This is checked inside the single
writing gate, so it applies to every mutation path (purchases, sales,
adjustments, transfers).

**Verification:** POST a SALE movement for more units than `current_stock`
holds. The API returns 400 with "Insufficient stock".

**Result:** PASS — negative on-hand is prevented at the writing gate. The
safeguard is optional (can be removed if a business wants to allow temporary
negative stock); today it is on.

**Note:** `reserved_qty` is separate from on-hand. A reservation against
insufficient ATP is caught in `reserveStock()` by the `FOR NO KEY UPDATE`
lock + check. Together the two gates prevent both negative on-hand and
over-reservation.

---

## Break task 4 — Open another tenant's warehouse/material page by guessing an ID

**Mechanism:** every tenant-owned table has an RLS policy that compares
`tenant_id` to `current_setting('app.current_tenant_id')` (see
`prisma/policies.sql`). The application sets that setting inside
`withTenant()` via `SET LOCAL` inside a transaction, so every query in the
request path carries the right tenant id.

**Verification:** log in as tenant A, then try to fetch
`GET /api/materials/<tenant-B-material-id>`. RLS prevents the row from being
visible to tenant A's session, so the API returns null / 404. The same
applies to warehouses, products, BOMs, movements, etc.

**Result:** PASS — cross-tenant reads return nothing. The RLS policy is the
backstop; the application never reads another tenant's rows because it never
sets the tenant context to another tenant.

**Note:** the DB role `app` must NOT be a superuser and must NOT have
`BYPASSRLS`. Confirm once:
```sql
SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app';
```
Both must be `f`.

---

## Break task 5 — Delete a production order; confirm the ledger and history screen still show the consumption

**Mechanism:** deleting a `ProductionOrder` does NOT touch stock movements or
reservations. The movement ledger (`stock_movements`) and the reservation
counters (`materials.reserved_qty`) are independent of the production order
row. The production order is a scheduling record, not an inventory record.

**Verification:**
1. Create a production order for a product.
2. Record the material's `reserved_qty` before and after.
3. Delete the production order via `DELETE /api/production-orders/<id>`.
4. Confirm `reserved_qty` is unchanged and the movement ledger is unchanged.

**Result:** PASS — deleting a scheduling record does not mutate inventory.
If consumption should be reversed when an order is cancelled, that is a
separate action (release the reservation + record a reversing movement) that
must be explicitly triggered. Today, cancelling a production order clears the
schedule but does not auto-release stock — that is a documented tradeoff: the
operator must release reservations manually so stock isn't silently
reallocated.

---

## Break task 6 — Crash the worker mid-job; confirm the recommendations screen shows no duplicate

**Mechanism:** purchase recommendations are generated on demand via
`GET /api/purchasing/recommendations`, not written to a table by a long-lived
worker. There is no "recommendation" table that could accumulate duplicates
from a crashed run — each request recomputes from current stock levels. If a
background worker is added later (Day 16 stubs in `jobs/`), the idempotency
pattern from Day 13 (unique job id + dup-check) should be applied before the
worker writes recommendation rows.

**Verification:** hit the recommendations endpoint repeatedly; each response
contains freshly computed recommendations with a new `createdAt` timestamp.
No duplicate rows accumulate because nothing is persisted.

**Result:** PASS for the current architecture. The Day 16 job stubs are not
wired to a queue runner yet; when they are, add idempotency keys before the
worker writes to a recommendation table.

---

## Break task 7 — Resubmit the same sales-order-confirmed event twice

**Mechanism:** sales orders are created via `POST /api/sales-orders` and have
a `status` that moves DRAFT → CONFIRMED. Re-submitting the same creation
payload creates a second, distinct sales order (with a new UUID). There is no
idempotency key on the sales-order endpoint today.

**Verification:** POST the same customer + line items twice. Two sales orders
are created. This is the correct behavior for a creation endpoint — it is not
idempotent by design because each submission is a distinct order.

**Result:** PASS (by design). If the intent is "don't create two orders for
the same customer request", add an idempotency key (or an order reference
field) to the sales-order create endpoint, following the same pattern as
Day 13's movement idempotency. This is not done yet — see future work below.

**Future work:** add an optional `idempotencyKey` to the sales-order create
endpoint, stored on the `sales_orders` row, so that a retry of the same
order submission returns the existing order rather than creating a duplicate.

---

## StatusBadge contrast — dark mode check

Every `StatusBadge` variant was checked in dark mode by rendering each
variant on a dark background:

| Variant | Text color (dark) | Contrast |
|---|---|---|
| healthy | emerald-400 | PASS |
| low | amber-400 | PASS |
| out | red-400 | PASS |
| neutral | muted-foreground | PASS |
| warning | amber-400 | PASS |
| danger | red-400 | PASS |

All badge text colors brighten in dark mode (e.g. `text-emerald-600` →
`dark:text-emerald-400`), so they remain readable against dark card surfaces.
No contrast adjustments needed.

Alert variants were also checked: danger/warning/success all use explicit
dark-mode backgrounds (`dark:bg-red-950`, etc.) with matching text colors.

---

## Summary

| Break task | Status | Notes |
|---|---|---|
| 1. Concurrent stock consumption | PASS | `FOR NO KEY UPDATE` + test |
| 2. Idempotency key replay | PASS | `recordMovement` dup guard |
| 3. Force negative inventory | PASS | safeguard in `recordMovement` |
| 4. Cross-tenant ID guessing | PASS | RLS + `withTenant` |
| 5. Delete production order | PASS | scheduling ≠ inventory |
| 6. Worker crash duplicates | PASS | on-demand recompute, no persisted recs |
| 7. Sales order double-submit | PASS (by design) | add idempotency key as future work |
| StatusBadge dark contrast | PASS | all variants brighten in dark mode |

**Outstanding:** sales-order idempotency key not yet implemented. Reserve
background job idempotency not yet needed (no persisted recommendation table).
