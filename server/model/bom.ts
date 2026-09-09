import { db } from '../db';

export type BomItem = {
  id: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  quantity: number;
  unit: string;
};

export type Bom = {
  id: string;
  productId: string;
  version: number;
  effectiveAt: string;
  createdAt: string;
  items: BomItem[];
};

export type BomInput = {
  productId: string;
  items: Array<{
    materialId: string;
    quantityPerUnit: number;
    unit: string;
  }>;
};

function mapBomItem(row: {
  id: string;
  materialId: string;
  quantityPerUnit: number;
  unit: string;
}, materialName: string, materialSku: string): BomItem {
  return {
    id: row.id,
    materialId: row.materialId,
    materialName,
    materialSku,
    quantity: row.quantityPerUnit,
    unit: row.unit,
  };
}

/** Returns the highest version number for a product, or 0 if none. */
export async function maxVersion(productId: string): Promise<number> {
  const rows = await db.orm.public.Bom
    .select('version')
    .where((b) => b.productId.eq(productId))
    .all();
  const sorted = rows.sort((a, b) => b.version - a.version);
  return sorted.length > 0 ? sorted[0].version : 0;
}

/** Returns the current (latest) BOM for a product, or null. */
export async function getCurrentBom(productId: string): Promise<Bom | null> {
  const version = await maxVersion(productId);
  if (version === 0) return null;
  return getBomByVersion(productId, version);
}

/** Returns a specific BOM version by product + version. */
export async function getBomByVersion(productId: string, version: number): Promise<Bom | null> {
  const bomRows = await db.orm.public.Bom
    .select('id', 'productId', 'version', 'effectiveAt', 'createdAt')
    .where((b) => b.productId.eq(productId))
    .all();
  const bom = bomRows.find((r) => r.version === version);
  if (!bom) return null;

  const items = await db.orm.public.BomItem
    .select('id', 'materialId', 'quantityPerUnit', 'unit')
    .where((i) => i.bomId.eq(bom.id))
    .all();

  const itemsWithMaterial: BomItem[] = [];
  for (const item of items) {
    const mat = await db.orm.public.Material
      .select('name', 'sku')
      .where((m) => m.id.eq(item.materialId))
      .first();
    itemsWithMaterial.push(mapBomItem(item, mat?.name ?? 'Unknown', mat?.sku ?? ''));
  }

  return {
    id: bom.id,
    productId: bom.productId,
    version: bom.version,
    effectiveAt: bom.effectiveAt,
    createdAt: bom.createdAt,
    items: itemsWithMaterial,
  };
}

/** List all BOM versions for a product (newest first). */
export async function listBomVersions(productId: string): Promise<Array<{ id: string; version: number; effectiveAt: string; createdAt: string }>> {
  const rows = await db.orm.public.Bom
    .select('id', 'version', 'effectiveAt', 'createdAt')
    .where((b) => b.productId.eq(productId))
    .all();
  const sorted = rows.sort((a, b) => b.version - a.version);
  return sorted.map((r) => ({
    id: r.id,
    version: r.version,
    effectiveAt: r.effectiveAt,
    createdAt: r.createdAt,
  }));
}

/** Create a new BOM version for a product. Returns the created BOM. */
export async function createBomVersion(productId: string, items: BomInput['items']): Promise<Bom> {
  const nextVersion = (await maxVersion(productId)) + 1;

  const bom = await db.orm.public.Bom.create({
    productId,
    version: nextVersion,
    effectiveAt: new Date().toISOString(),
  });

  for (const item of items) {
    await db.orm.public.BomItem.create({
      bomId: bom.id,
      materialId: item.materialId,
      quantityPerUnit: item.quantityPerUnit,
      unit: item.unit,
    });
  }

  // Update product's current_bom_id
  await db.orm.public.Product
    .where((p) => p.id.eq(productId))
    .update({ currentBomId: bom.id });

  const result = await getBomByVersion(productId, nextVersion);
  if (!result) throw new Error('Failed to retrieve created BOM');
  return result;
}

/** Revert to a previous BOM version: creates a new version as a copy of an existing one. */
export async function revertBomVersion(productId: string, fromVersion: number): Promise<Bom> {
  const source = await getBomByVersion(productId, fromVersion);
  if (!source) throw new Error(`BOM version ${fromVersion} not found`);

  const items = source.items.map((i) => ({
    materialId: i.materialId,
    quantityPerUnit: i.quantity,
    unit: i.unit,
  }));

  return createBomVersion(productId, items);
}
