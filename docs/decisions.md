## Day 6 — Max buildable units ("Can we manufacture N units?")

**Status:** complete.

### Decision

Expose a deterministic "max buildable units" calculation for any product with a
bill of materials. The page answers the simplest production-management question
with a single number and an auditable per-material breakdown:

- `server/model/max-buildable.ts` — `computeMaxBuildable(productId, productName)`
  joins the **current BOM version**'s line items to `materials.current_stock` and
  returns `MIN(floor(available / quantity_per_unit))` across all lines, plus each
  line's own contribution.
- The binding constraint (the line whose ratio is smallest) is flagged on the
  frontend with `StatusBadge variant="warning"`, so a planner sees *why* the
  number is what it is, not just the number.
- `GET /api/products/[id]/max-buildable` is RLS-scoped (goes through
  `withTenant`) and gated by `VIEW_PRODUCTS` permission.
- The product detail page (`products/[id]/page.tsx`) adds a "Max buildable"
  button next to "Edit BOM" so the number is one click away from the product
  view.

### Seed state

The chair seed (`CHAIR-001`) reports max-buildable **420**, limited by
**Backrests** (420 on hand, 1 per unit).

### Verification

```bash
pnpm run build:app
pnpm dev            # open /products/<chair-id>/max-buildable
```

---

## Day 7 — Audit log

**Status:** complete.

### Decision

Every mutating action the application performs is recorded in `audit_logs` so
there is a tamper-evident, tenant-scoped trail: who did what, to which
resource, when.

- `prisma/schema.prisma` — new `AuditLog` model with fields for actor, action,
  resource type, resource id, optional description + snapshot (JSON). Owner-only
  read via `VIEW_AUDIT_LOG` permission.
- `prisma/policies.sql` — `audit_logs_tenant_isolation` RLS policy so each
  tenant only sees its own entries.
- `server/audit/log.ts` — centralized `audit()` writer. Every call site goes
  through here so the shape stays consistent and we can add fields (IP, user
  agent) later without touching every caller.
- `server/audit/query.ts` — read-only list with optional filters: resource
  type, start/end date, pagination.
- `app/api/audit-log/route.ts` — `GET` list with query-param filters;
  `POST` for manual entries (admin only).
- `app/(root)/audit-log/page.tsx` — `DataTable` + popover date-range filter
  (`<input type="date">` inside a Radix `Popover`) + `Select` for resource
  type. Action column is color-coded per action type.
- Dashboard sidebar: "Audit log" appears under the Admin section for OWNER
  accounts only.

### RLS note

The `audit_logs` and `stock_movements` tables are RLS-protected. Because
Prisma 8.0.0-rc.12 cannot describe RLS in the schema contract, `pnpm run
build` (which runs `db migrate`) fails verification on these tables. The
workaround is `pnpm run build:app` (contract emit + Next.js build, no
migration step). The DB schema itself is correct — applied via
`scripts/apply_days_7_9_migration.mjs`.

---

## Day 8 — Immutable movement ledger

**Status:** complete.

### Decision

Every change to on-hand stock flows through a single function,
`recordMovement()` in `server/inventory/recordMovement.ts` — the only place in
the application that mutates `material.current_stock`. This makes the inventory
ledger complete and auditable by construction.

- `prisma/schema.prisma` — new `StockMovement` model: immutable rows with
  material, optional warehouse, movement type (`PURCHASE/SALE/RETURN/DAMAGE/
  TRANSFER/ADJUSTMENT/RESERVATION/RESERVATION_RELEASE`), signed quantity,
  optional reference + referenceId.
- `prisma/policies.sql` — `stock_movements_tenant_isolation` RLS policy.
- `server/inventory/recordMovement.ts` — the single writing gate. Records the
  movement row and updates `material.current_stock` in the same logical step.
  Also writes an audit entry. Includes a safeguard against negative on-hand
  (configurable — remove the check if you want to allow negative stock).
- `server/inventory/reverseMovement()` — creates a reversing entry (opposite
  quantity) linked back to the original movement, for cancellations/corrections.
- `server/model/stock-movements.ts` — read-only `listMaterialMovements()` for
  the history page.
- `server/model/material-stock.ts` — `listMaterialStock()` / `getMaterialStock()`
  return on-hand, reserved, available-to-promise, and min-stock.
- `app/api/materials/[id]/movements/route.ts` — `POST` to record a movement
  for a material (gated by `RECORD_MOVEMENT`).
- `app/api/materials/[id]/history/route.ts` — `GET` the movement ledger for
  one material (gated by `VIEW_INVENTORY`).
- `app/(root)/inventory/materials/[id]/page.tsx` — material detail: stock
  levels table (on hand / reserved / ATP / min) + link to movement history.
- `app/(root)/inventory/materials/[id]/history/page.tsx` — `LedgerTable`
  (built on `DataTable`) with `MovementTypeBadge`: green for PURCHASE/RETURN,
  red for SALE/DAMAGE, neutral for TRANSFER/ADJUSTMENT.

### Movement type color coding

| Type | Color | Icon |
|---|---|---|
| PURCHASE | green | + |
| RETURN | green | ↻ |
| SALE | red | − |
| DAMAGE | red | ! |
| TRANSFER | neutral | ↕ |
| ADJUSTMENT | neutral | ⚖ |
| RESERVATION | amber | ✂ |
| RESERVATION_RELEASE | green | ↻ |

---

## Day 10 — Concurrency control, part 1

**Status:** complete.

### Decision

Stock reservations must be safe under concurrent requests. Two operators
reserving against the same material at the same time must not both succeed when
there isn't enough stock — the check-then-act race must be closed.

- `server/inventory/reserve.ts` — `reserveStock()`, `releaseReservation()`, and
  `adjustReservation()` all wrap their read + check + write in a transaction
  with `SELECT ... FOR NO KEY UPDATE` on the material row. This acquires a
  row-level lock that blocks concurrent writers to the same material, so the
  second transaction waits, re-reads, and finds the updated `reserved_qty`.
- Why `FOR NO KEY UPDATE` instead of `FOR UPDATE`: we only change
  `reserved_qty`, not any key column. `FOR UPDATE` also blocks `SELECT ... FOR
  KEY SHARE` (used by FK checks), which is unnecessary and would increase lock
  contention under high reservation concurrency. `FOR NO KEY UPDATE` prevents
  lost updates on our row without blocking FK-sharing readers.
- Why not the single-atomic-UPDATE alternative: an `UPDATE ... WHERE
  (current_stock - reserved_qty) >= $1` would be simpler but gives poorer error
  messages (we can't report the actual available count without a second query)
  and makes richer pre-conditions harder to add later. The explicit lock + check
  + update pattern keeps the error informative and the logic extensible.
- See `docs/writeups/concurrency-case-study.md` for the full tradeoff discussion.

---

## Day 11 — Alternative approach + deadlock-safe transfers

**Status:** complete.

### Decision

Stock transfers between warehouses are recorded as two immutable movements (an
outflow from the source and an inflow to the destination) inside a single
transaction, so the transfer is atomic: either both movements land or neither
does.

- `server/inventory/transfer.ts` — `transferStock()` is the single entry point
  for warehouse-to-warehouse transfers.
- Lock ordering to prevent deadlocks: when two transfers run concurrently between
  the same pair of warehouses in opposite directions, a naive lock-in-call-order
  would deadlock (A locks wh1→wh2, B locks wh2→wh1). We always lock warehouses
  in **ascending id order** so both transfers lock the same warehouse first and
  the second simply waits — no circular wait.
- The source warehouse on-hand is verified per-warehouse by summing movements
  scoped to that warehouse, not just the global material `current_stock` mirror.
- The transfer does NOT touch `reserved_qty` — reservations are per-material,
  not per-warehouse.
- `app/api/inventory/transfers/route.ts` — `POST` to create a transfer
  (gated by `TRANSFER_STOCK`).
- `app/(root)/inventory/transfers/page.tsx` — `InventoryActionForm` in a Sheet
  with material + warehouse selects. Insufficient-stock errors render as
  `Alert variant="danger"`.

---

## Day 12 — The concurrency test

**Status:** complete.

### Decision

The concurrency control is verified by a deterministic race test, not by
reasoning alone.

- `tests/concurrency/stock-race.test.ts` — seeds a material with 10 units,
  fires two concurrent `reserveStock()` calls (8 and 7 units), and asserts:
    - exactly one resolves (fulfilled)
    - the other rejects with an insufficient-stock error
    - after both settle, `reserved_qty` equals the winning quantity
  - The test runs the race 10 times in a loop to catch intermittent failures.
  - The test is rerunnable: it creates its own material + session each run and
    cleans up after itself.
- `app/(root)/materials/[id]/reserve/page.tsx` — `ReserveForm` (Card + Input +
  Button) with the result shown as a live `Alert`. Built to open in two tabs for
  the live demo: two tabs submit at the same time, one succeeds, one fails.
- The reserve button is wired into the material detail page
  (`inventory/materials/[id]/page.tsx`) next to the movement history button.

---

## Day 13 — Manual adjustments + replay protection

**Status:** complete.

### Decision

Manual stock adjustments (corrections, damage found, shrinkage, write-offs)
flow through the same `recordMovement()` gate as every other stock change, so
the ledger stays complete.

- Idempotency (replay protection): `recordMovement()` accepts an optional
  `idempotencyKey`. If a movement with that key already exists (stored as
  `reference_id` on the row), the call returns the existing movement's id and
  newStock WITHOUT creating a duplicate. This makes retries safe: the same key
  submitted twice produces exactly one movement.
- The idempotency key is durable (stored on the row) so it survives process
  restarts and is visible in the ledger for audit.
- `app/api/stock-movements/route.ts` — shared `POST /api/stock-movements` for
  recording any movement type (used by adjustments and available for future
  programmatic writes). `GET` lists movements with pagination.
- `app/(root)/inventory/adjustments/page.tsx` — `InventoryActionForm` with a
  reason `Select` (correction, damage, theft, write-off, other) and a note
  field. Each adjustment gets a unique idempotency key so a browser retry won't
  double-count.

---

## Day 14 — Buffer + tests

**Status:** complete.

### Decision

Polish pass across the inventory surfaces: loading states, empty states, and
error states on every form.

- `components/ui/alert.tsx` — `Alert` component with `default`, `danger`,
  `warning`, and `success` variants. Used by the transfers, adjustments, and
  reserve pages to surface success and error messages.
- `components/ui/skeleton.tsx` — `Skeleton` and `TableRowSkeleton` for loading
  states in list tables.
- `components/ui/empty-state.tsx` — `EmptyState` component for zero-data
  surfaces (e.g. a material with no movements yet).
- The movement history page (`inventory/materials/[id]/history/page.tsx`) already
  had an empty state for zero-history materials; the transfers and adjustments
  pages show `Alert` error states on form failure.
- Typecheck and build pass end-to-end (`pnpm run build:app`).

### Week 2 gate

- Concurrency test passes reliably (10+ iterations, exactly one winner each time).
- The reserve page can be opened in two tabs and the race is visible live:
  one tab succeeds, the other shows an insufficient-stock error.
- All inventory mutations flow through `recordMovement()` or the reservation
  functions, both of which write audit entries — the trail is complete by
  construction.

---

## Day 9 — Reservations

**Status:** complete.

### Decision

Stock reservations let the application commit stock to an order or allocation
_without touching on-hand. `reserved_qty` on `materials` tracks committed
stock; available-to-promise (ATP) = `current_stock − reserved_qty`.

- `prisma/schema.prisma` — `Material.reservedQty` (Int, default 0) added
  alongside the existing `currentStock`.
- `server/inventory/reserve.ts` — three functions:
  - `reserveStock()` — increments `reserved_qty` by quantity; throws if ATP
    would go negative.
  - `releaseReservation()` — decrements `reserved_qty`; throws if release would
    go below zero.
  - `adjustReservation()` — sets `reserved_qty` to an exact value; useful for
    full/partial cancellations.
- All three write an audit entry so reservation changes are traceable.
- `server/model/material-stock.ts` — ATP is computed on read as
  `onHand − reserved`.
- The materials detail page (`inventory/materials/[id]/page.tsx`) shows on-hand,
  reserved, and ATP columns so a planner sees the full picture.
- `app/api/materials/[id]/movements/route.ts` — accepts `RESERVATION` and
  `RESERVATION_RELEASE` movement types, which flow through `recordMovement()`
  and keep the ledger consistent with the reservation counters.
