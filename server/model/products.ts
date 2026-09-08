import { db } from '../db';
import type { Material } from './materials';

export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
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

export async function listProducts(): Promise<Product[]> {
  const rows = await db.orm.public.Product
    .select('id', 'name', 'sku', 'description', 'createdAt', 'updatedAt')
    .all();

  const products: Product[] = [];
  for (const row of rows) {
    const bom = await db.orm.public.BomItem
      .select('id', 'quantity', 'unit', 'materialId')
      .where((b) => b.productId.eq(row.id))
      .all();

    const bomItems: Product['bomItems'] = [];
    for (const item of bom) {
      const mat = await db.orm.public.Material
        .select('name', 'sku')
        .where((m) => m.id.eq(item.materialId))
        .first();
      bomItems.push({
        id: item.id,
        materialId: item.materialId,
        materialName: mat?.name ?? 'Unknown',
        materialSku: mat?.sku ?? '',
        quantity: item.quantity,
        unit: item.unit,
      });
    }

    products.push({
      id: row.id,
      name: row.name,
      sku: row.sku,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      bomItems: bomItems,
    });
  }

  return products;
}

export async function getProduct(id: string): Promise<Product | null> {
  const row = await db.orm.public.Product
    .select('id', 'name', 'sku', 'description', 'createdAt', 'updatedAt')
    .where((p) => p.id.eq(id))
    .first();
  if (!row) return null;

  const bom = await db.orm.public.BomItem
    .select('id', 'quantity', 'unit', 'materialId')
    .where((b) => b.productId.eq(id))
    .all();

  const bomItems: Product['bomItems'] = [];
  for (const item of bom) {
    const mat = await db.orm.public.Material
      .select('name', 'sku')
      .where((m) => m.id.eq(item.materialId))
      .first();
    bomItems.push({
      id: item.id,
      materialId: item.materialId,
      materialName: mat?.name ?? 'Unknown',
      materialSku: mat?.sku ?? '',
      quantity: item.quantity,
      unit: item.unit,
    });
  }

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    bomItems: bomItems,
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

export async function addBomItem(
  productId: string,
  input: BomItemInput,
): Promise<void> {
  const product = await db.orm.public.Product.where((p) => p.id.eq(productId)).first();
  if (!product) throw new Error('Product not found');

  const material = await db.orm.public.Material.where((m) => m.id.eq(input.materialId)).first();
  if (!material) throw new Error('Material not found');

  const existing = await db.orm.public.BomItem
    .where({ productId, materialId: input.materialId } as never)
    .first();
  if (existing) throw new Error('This material is already in the BOM');

  await db.orm.public.BomItem.create({
    productId,
    materialId: input.materialId,
    quantity: input.quantity,
    unit: input.unit,
  });
}

export async function removeBomItem(productId: string, materialId: string): Promise<void> {
  const product = await db.orm.public.Product.where((p) => p.id.eq(productId)).first();
  if (!product) throw new Error('Product not found');

  const existing = await db.orm.public.BomItem
    .where({ productId, materialId } as never)
    .first();
  if (!existing) throw new Error('BOM item not found');

  await db.orm.public.BomItem.where((b) => b.id.eq(existing.id)).delete();
}

export async function listMaterialsForProduct(productId: string): Promise<Array<{ id: string; name: string; sku: string; unit: string }>> {
  const product = await db.orm.public.Product.where((p) => p.id.eq(productId)).first();
  if (!product) throw new Error('Product not found');

  const bomItems = await db.orm.public.BomItem
    .select('materialId', 'quantity', 'unit')
    .where((b) => b.productId.eq(productId))
    .all();

  const materials: Array<{ id: string; name: string; sku: string; unit: string }> = [];
  for (const item of bomItems) {
    const mat = await db.orm.public.Material
      .select('id', 'name', 'sku', 'unit')
      .where((m) => m.id.eq(item.materialId))
      .first();
    if (mat) {
      materials.push({ id: mat.id, name: mat.name, sku: mat.sku, unit: mat.unit });
    }
  }

  return materials;
}
