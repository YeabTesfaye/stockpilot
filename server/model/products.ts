import { db } from '../db';
import * as bom from './bom';

export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /** Current BOM version number, or null if no BOM yet. */
  currentBomVersion: number | null;
  bomItems: Array<{
    id: string;
    materialId: string;
    materialName: string;
    materialSku: string;
    quantity: number;
    unit: string;
  }>;
};

export type ProductInput = {
  name: string;
  sku: string;
  description?: string;
};

export type BomItemInput = {
  materialId: string;
  quantity: number;
  unit: string;
};

function bomItemsFromBom(bomItems: bom.BomItem[]): Product['bomItems'] {
  return bomItems.map((i) => ({
    id: i.id,
    materialId: i.materialId,
    materialName: i.materialName,
    materialSku: i.materialSku,
    quantity: i.quantity,
    unit: i.unit,
  }));
}

export async function listProducts(): Promise<Product[]> {
  const rows = await db.orm.public.Product
    .select('id', 'name', 'sku', 'description', 'createdAt', 'updatedAt', 'currentBomId')
    .all();

  const products: Product[] = [];
  for (const row of rows) {
    const currentVersion = row.currentBomId
      ? await bom.maxVersion(row.id)
      : 0;

    const items = currentVersion > 0
      ? (await bom.getCurrentBom(row.id))?.items ?? []
      : [];

    products.push({
      id: row.id,
      name: row.name,
      sku: row.sku,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      currentBomVersion: currentVersion > 0 ? currentVersion : null,
      bomItems: bomItemsFromBom(items),
    });
  }

  return products;
}

export async function getProduct(id: string): Promise<Product | null> {
  const row = await db.orm.public.Product
    .select('id', 'name', 'sku', 'description', 'createdAt', 'updatedAt', 'currentBomId')
    .where((p) => p.id.eq(id))
    .first();
  if (!row) return null;

  const currentVersion = row.currentBomId
    ? await bom.maxVersion(row.id)
    : 0;

  const items = currentVersion > 0
    ? (await bom.getCurrentBom(row.id))?.items ?? []
    : [];

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    currentBomVersion: currentVersion > 0 ? currentVersion : null,
    bomItems: bomItemsFromBom(items),
  };
}

export async function createProduct(tenantId: string, input: ProductInput): Promise<Product> {
  const existing = await db.orm.public.Product
    .where((p) => p.sku.eq(input.sku))
    .first();
  if (existing) {
    throw new Error(`SKU ${input.sku} already exists in this tenant`);
  }
  const row = await db.orm.public.Product.create({
    tenantId,
    name: input.name,
    sku: input.sku,
    description: input.description ?? null,
  });
  return getProduct(row.id) as Promise<Product>;
}

export async function updateProduct(
  id: string,
  input: { name?: string; sku?: string; description?: string | null },
): Promise<Product> {
  const existing = await db.orm.public.Product
    .where((p) => p.id.eq(id))
    .first();
  if (!existing) throw new Error('Product not found');

  if (input.sku && input.sku !== existing.sku) {
    const conflict = await db.orm.public.Product
      .where((p) => p.sku.eq(input.sku!))
      .first();
    if (conflict) throw new Error(`SKU ${input.sku} already exists in this tenant`);
  }

  await db.orm.public.Product
    .where((p) => p.id.eq(id))
    .update({
      name: input.name ?? existing.name,
      sku: input.sku ?? existing.sku,
      description: input.description !== undefined ? input.description : existing.description,
    });

  return getProduct(id) as Promise<Product>;
}

export async function deleteProduct(id: string): Promise<void> {
  const existing = await db.orm.public.Product
    .where((p) => p.id.eq(id))
    .first();
  if (!existing) throw new Error('Product not found');
  await db.orm.public.Product.where((p) => p.id.eq(id)).delete();
}

/** Add a BOM line to the current BOM version. Creates a new BOM version if none exists. */
export async function addBomItem(
  productId: string,
  input: BomItemInput,
): Promise<{ version: number }> {
  const current = await bom.getCurrentBom(productId);
  if (current) {
    // Check for duplicate material in this BOM
    const allItems = await db.orm.public.BomItem
      .select('id', 'materialId')
      .where((i) => i.bomId.eq(current.id))
      .all();
    if (allItems.some((i) => i.materialId === input.materialId)) {
      throw new Error('This material is already in the BOM');
    }

    const material = await db.orm.public.Material
      .where((m) => m.id.eq(input.materialId))
      .first();
    if (!material) throw new Error('Material not found');

    await db.orm.public.BomItem.create({
      bomId: current.id,
      materialId: input.materialId,
      quantityPerUnit: input.quantity,
      unit: input.unit,
    });

    return { version: current.version };
  } else {
    // Create first BOM version with this item
    await bom.createBomVersion(productId, [{
      materialId: input.materialId,
      quantityPerUnit: input.quantity,
      unit: input.unit,
    }]);
    const version = await bom.maxVersion(productId);
    return { version };
  }
}

/** Remove a BOM line from the current BOM version. */
export async function removeBomItem(productId: string, materialId: string): Promise<void> {
  const current = await bom.getCurrentBom(productId);
  if (!current) throw new Error('No BOM for this product');

  const allItems = await db.orm.public.BomItem
    .select('id', 'materialId')
    .where((i) => i.bomId.eq(current.id))
    .all();
  const target = allItems.find((i) => i.materialId === materialId);
  if (!target) throw new Error('BOM item not found');

  await db.orm.public.BomItem.where((i) => i.id.eq(target.id)).delete();
}

/** Get all materials available for BOM editing (used by the BOM editor dropdown). */
export async function listMaterialsForBom(): Promise<Array<{ id: string; name: string; sku: string; unit: string }>> {
  return db.orm.public.Material
    .select('id', 'name', 'sku', 'unit')
    .all()
    .then((rows) => rows.map((r) => ({ id: r.id, name: r.name, sku: r.sku, unit: r.unit })));
}
