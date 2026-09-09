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
