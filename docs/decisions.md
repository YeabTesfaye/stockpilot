## Day 4 — Catalog: Materials, Products, Warehouses

**Status:** implemented and verified.

### Decision

Add a catalog layer with three tenant-owned entities — `Material`, `Product`, `Warehouse` — backed by CRUD API routes and list pages with create forms. SKU uniqueness is scoped per tenant (`UNIQUE(tenant_id, sku)`). Products carry a bill of materials (BOM) as a junction table (`bom_items`) linking materials to products with quantity and unit.

### Why per-tenant SKU uniqueness

A SKU like `CHAIR-001` means different things to different tenants. Enforcing uniqueness only within `(tenant_id, sku)` lets every tenant use their own numbering scheme without collisions across the platform. The same physical product code can exist in Acme and Beta without conflict.

### Why a separate BOM junction table

A product's bill of materials is a many-to-many between products and materials with a quantity. A junction table (`bom_items`) with `(product_id, material_id)` unique constraint prevents duplicate material lines on the same product, and the quantity+unit columns capture how many of each material go into one unit of the product.

### What we changed

#### `prisma/schema.prisma` (extended)

- `Material` — name, SKU (unique per tenant), optional description, unit, min stock threshold
- `Product` — name, SKU (unique per tenant), optional description; reverse side `bomItems`
- `Warehouse` — name, optional code, optional address
- `BomItem` — junction: product + material + quantity + unit; unique on `(product_id, material_id)`

All four tables carry `tenant_id` + foreign key to `tenants` with `ON DELETE CASCADE`.

#### `prisma/policies.sql` (extended)

RLS policies added for `materials`, `products`, `warehouses`, and `bom_items` — same pattern as Day 2: `tenant_id = current_setting('app.current_tenant_id')`. The `bom_items` policy uses a subquery on `products` since the table doesn't have its own `tenant_id` column.

#### `server/model/materials.ts` (new)

CRUD for materials. SKU conflict checked at create and update time (query for existing SKU within the tenant, enforced by RLS scoping). `tenantId` passed explicitly from the API route.

#### `server/model/products.ts` (new)

CRUD for products with BOM lines. `listProducts` and `getProduct` eagerly load BOM items with material names. `addBomItem` / `removeBomItem` manage the junction. SKU conflict checked same as materials.

#### `server/model/warehouses.ts` (new)

CRUD for warehouses — simpler than materials (no SKU), same tenant-scoped pattern.

#### `app/api/materials/` (new)

- `GET /api/materials` — list, gated by `VIEW_MATERIALS`
- `POST /api/materials` — create, gated by `CREATE_MATERIAL`
- `GET/PUT/DELETE /api/materials/[id]` — read/update/delete, gated by respective actions

#### `app/api/products/` (new)

- `GET /api/products` — list with BOM, gated by `VIEW_PRODUCTS`
- `POST /api/products` — create, gated by `CREATE_PRODUCT`
- `GET/PUT/DELETE /api/products/[id]` — read/update/delete
- `POST /api/products/[id]/bom` — add BOM line, gated by `CREATE_BOM`
- `DELETE /api/products/[id]/bom?materialId=...` — remove BOM line, gated by `UPDATE_BOM`

#### `app/api/warehouses/` (new)

- `GET /api/warehouses` — list, gated by `VIEW_WAREHOUSES`
- `POST /api/warehouses` — create, gated by `CREATE_WAREHOUSE`
- `GET/PUT/DELETE /api/warehouses/[id]` — read/update/delete

#### `server/rabc/permissions.ts` (extended)

New actions: `VIEW_MATERIALS`, `CREATE_MATERIAL`, `UPDATE_MATERIAL`, `DELETE_MATERIAL`, `VIEW_WAREHOUSES`, `CREATE_WAREHOUSE`, `UPDATE_WAREHOUSE`, `DELETE_WAREHOUSE`, `CREATE_PRODUCT`, `UPDATE_PRODUCT`, `DELETE_PRODUCT`. View actions granted to all roles; create/update/delete granted to OWNER + PRODUCTION_MANAGER.

#### `app/dashboard/layout.tsx` (updated)

Added Materials, Products, and Warehouses nav items gated by their respective view actions.

#### `components/ui/` (new primitives)

- `data-table.tsx` — reusable table with columns, row actions dropdown
- `sheet.tsx` — Radix Dialog-based slide-over panel for create/edit forms
- `status-badge.tsx` — green/amber/red pill for stock health / status
- `page-header.tsx` — title + description + optional action buttons
- `select.tsx` — Radix Select dropdown (used in BOM material picker)
- `dropdown-menu.tsx` — Radix DropdownMenu wrapper (used by DataTable row actions)

#### `app/(root)/inventory/materials/page.tsx` (new)

Materials list page: PageHeader with "Add material" button, DataTable with SKU/name/unit/stock-health columns, Sheet-based create form with name/SKU/description/unit/minStock fields. Row actions: edit (navigates to dashboard detail), delete.

#### `app/(root)/products/page.tsx` (new)

Products list page: PageHeader with "Add product" button, DataTable with SKU/name/BOM/status columns. Create flow is two-step: create the product, then a BOM editor Sheet opens pre-loaded with the new product. BOM editor lists existing lines with remove buttons, and an "Add material" section with a material dropdown + quantity field.

#### `app/(root)/warehouses/page.tsx` (new)

Warehouses list page: PageHeader with "Add warehouse" button, DataTable with name/code/address columns, Sheet-based create form.

#### `prisma/seed.ts` (extended)

Added the chair example for Acme Manufacturing:
- 6 materials: Seat (SEAT-001), Backrest (BACK-001), Wheels (WHL-001), Gas Cylinder (CYL-001), Screws M6 (SCR-M6), Armrest Pair (ARM-001)
- 1 product: Executive Chair (CHAIR-001) with description
- 6 BOM items: Seat×1, Backrest×1, Wheels×5, Gas Cylinder×1, Screws×8, Armrest Pair×1

### Seed verification

```bash
pnpm db:seed
# Seed complete: 2 tenants, 6 users, 6 memberships, 6 materials, 1 products, 6 bom_items.
```

Verified in psql:
- 6 materials with correct SKUs and min stock values
- CHAIR-001 product with 6 BOM lines linking to the correct materials with correct quantities
