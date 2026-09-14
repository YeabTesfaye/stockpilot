import { db } from '../db';

export type Supplier = {
  id: string;
  name: string;
  code: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  leadTimeDays: number;
  reliabilityScore: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplierMaterial = {
  id: string;
  supplierId: string;
  materialId: string;
  unitPrice: number;
  leadTimeDays: number;
  createdAt: string;
};

export async function listSuppliers(): Promise<Supplier[]> {
  const rows = await db.orm.public.Supplier
    .select('id', 'name', 'code', 'contactName', 'email', 'phone', 'leadTimeDays', 'reliabilityScore', 'createdAt', 'updatedAt')
    .all();
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    code: r.code,
    contactName: r.contactName,
    email: r.email,
    phone: r.phone,
    leadTimeDays: r.leadTimeDays,
    reliabilityScore: r.reliabilityScore,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const row = await db.orm.public.Supplier
    .select('id', 'name', 'code', 'contactName', 'email', 'phone', 'leadTimeDays', 'reliabilityScore', 'createdAt', 'updatedAt')
    .where((s) => s.id.eq(id))
    .first();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    leadTimeDays: row.leadTimeDays,
    reliabilityScore: row.reliabilityScore,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createSupplier(tenantId: string, input: {
  name: string;
  code?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  leadTimeDays?: number;
}): Promise<Supplier> {
  const row = await db.orm.public.Supplier.create({
    tenantId,
    name: input.name,
    code: input.code ?? null,
    contactName: input.contactName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    leadTimeDays: input.leadTimeDays ?? 7,
    reliabilityScore: 0,
  });
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    leadTimeDays: row.leadTimeDays,
    reliabilityScore: row.reliabilityScore,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function updateSupplier(id: string, input: {
  name?: string;
  code?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  leadTimeDays?: number;
}): Promise<Supplier> {
  const existing = await db.orm.public.Supplier
    .where((s) => s.id.eq(id))
    .first();
  if (!existing) throw new Error('Supplier not found');

  await db.orm.public.Supplier
    .where((s) => s.id.eq(id))
    .update({
      name: input.name ?? existing.name,
      code: input.code !== undefined ? input.code : existing.code,
      contactName: input.contactName !== undefined ? input.contactName : existing.contactName,
      email: input.email !== undefined ? input.email : existing.email,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      leadTimeDays: input.leadTimeDays ?? existing.leadTimeDays,
    });

  const updated = await db.orm.public.Supplier
    .select('id', 'name', 'code', 'contactName', 'email', 'phone', 'leadTimeDays', 'reliabilityScore', 'createdAt', 'updatedAt')
    .where((s) => s.id.eq(id))
    .first();
  return updated ? {
    id: updated.id,
    name: updated.name,
    code: updated.code,
    contactName: updated.contactName,
    email: updated.email,
    phone: updated.phone,
    leadTimeDays: updated.leadTimeDays,
    reliabilityScore: updated.reliabilityScore,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  } : {
    id: id,
    name: existing.name,
    code: existing.code,
    contactName: existing.contactName,
    email: existing.email,
    phone: existing.phone,
    leadTimeDays: existing.leadTimeDays,
    reliabilityScore: existing.reliabilityScore,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
  };
}

export async function deleteSupplier(id: string): Promise<void> {
  const existing = await db.orm.public.Supplier
    .where((s) => s.id.eq(id))
    .first();
  if (!existing) throw new Error('Supplier not found');
  await db.orm.public.Supplier.where((s) => s.id.eq(id)).delete();
}

export async function linkSupplierMaterial(supplierId: string, materialId: string, unitPrice: number, leadTimeDays: number): Promise<SupplierMaterial> {
  // Check for duplicate.
  const existing = await db.orm.public.SupplierMaterial
    .where((sm) => sm.supplierId.eq(supplierId))
    .where((sm) => sm.materialId.eq(materialId))
    .first();
  if (existing) throw new Error('This supplier already supplies this material');

  const row = await db.orm.public.SupplierMaterial.create({
    supplierId,
    materialId,
    unitPrice,
    leadTimeDays,
  });
  return {
    id: row.id,
    supplierId: row.supplierId,
    materialId: row.materialId,
    unitPrice: row.unitPrice,
    leadTimeDays: row.leadTimeDays,
    createdAt: row.createdAt,
  };
}

export async function unlinkSupplierMaterial(supplierId: string, materialId: string): Promise<void> {
  const existing = await db.orm.public.SupplierMaterial
    .where((sm) => sm.supplierId.eq(supplierId))
    .where((sm) => sm.materialId.eq(materialId))
    .first();
  if (!existing) throw new Error('Supplier-material link not found');
  await db.orm.public.SupplierMaterial.where((sm) => sm.id.eq(existing.id)).delete();
}

export async function listSupplierMaterials(supplierId: string): Promise<SupplierMaterial[]> {
  return db.orm.public.SupplierMaterial
    .select('id', 'supplierId', 'materialId', 'unitPrice', 'leadTimeDays', 'createdAt')
    .where((sm) => sm.supplierId.eq(supplierId))
    .all();
}
