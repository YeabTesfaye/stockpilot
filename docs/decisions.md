## Day 6 — Max buildable units ("Can we manufacture N units?")

**Status:** code written; DB verification pending (Docker Desktop not running as of this edit).

### Decision

Expose a deterministic "max buildable units" calculation for any product with a
bill of materials. The page answers the simplest production-management question
with a single number and an auditable per-material breakdown:

- `server/model/max-buildable.ts` — `computeMaxBuildable(productId, productName)`
  joins the **current BOM version**'s line items to `materials.current_stock` and
  returns `MIN(floor(available / quantity_per_unit))` across all lines, plus each
  line's own contribution.
- The binding constraint (the line whose ratio is smallest) is flagged on the
  frontend with `StatusBadge status="warning"`, so a planner sees *why* the
  number is what it is, not just the number.
- `GET /api/products/[id]/max-buildable` is RLS-scoped (goes through
  `withTenant`) and gated by `VIEW_PRODUCTS` permission. The page reuses the
  same cookie-forward fetch pattern as `products/[id]/bom/page.tsx`.
- The product detail page (`products/[id]/page.tsx`) adds a "Max buildable"
  button next to "Edit BOM" so the number is one click away from the product
  view.

### Seed state for the Day 6 test

The chair seed (`CHAIR-001`) was adjusted so the reported max-buildable is
**420**, limited by **Backrests**:

| Material | Qty / unit | Stock | Buildable |
|---|---|---|---|
| Seat | 1 pcs | 2,000 | 2,000 |
| Backrest | 1 pcs | 420 | **420** ← constraint |
| Wheels | 5 pcs | 5,000 | 1,000 |
| Gas Cylinder | 1 pcs | 4,500 | 4,500 |
| Screws (M6) | 8 pcs | 20,000 | 2,500 |
| Armrest Pair | 1 pcs | 500 | 500 |

The expected result is therefore `min(2000, 420, 1000, 4500, 2500, 500) = 420`,
with the Backrest row flagged as the binding constraint.

### Verification (run after Docker is up)

```bash
pnpm db:seed        # idempotent; only adjusts stock figures for the chair
pnpm dev            # then open /products/<chair-id>/max-buildable
```

Confirm:
1. The large number at the top reads **420**.
2. The Backrest row is flagged "Binding constraint".
3. The per-material table lists every BOM line and its `buildableFromMaterial`
   contribution.
4. The same URL renders correctly in both themes (the page is theme-agnostic —
   it uses the same shadcn primitives as the rest of the app).
