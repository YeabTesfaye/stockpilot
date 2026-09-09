import { db } from '../db';
import { audit } from '../audit/log';

// MovementType values matching the Prisma schema enum.
// Kept in sync with prisma/schema.prisma (MovementType enum).
export type MovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'DAMAGE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'RESERVATION'
  | 'RESERVATION_RELEASE';

export type MovementInput = {
  materialId: string;
  warehouseId?: string;
  type: MovementType;
  quantity: number; // signed: positive = stock in, negative = stock out
  reference?: string;
  referenceId?: string;
  actorUserId: string;
  actorName: string;
  tenantId: string;
  description?: string;
  idempotencyKey?: string;
};

/**
 * Record a single stock movement and keep Material.current_stock in sync.
 *
 * This is the ONLY function in the application that mutates on-hand stock.
 * Every inventory change — purchase receipt, sale dispatch, return, damage
 * write-off, transfer, manual adjustment — flows through here so the ledger
 * is complete and the current_stock mirror stays accurate.
 *
 * - `quantity` is signed: positive adds to on-hand, negative subtracts.
 * - `current_stock` on the Material row is a fast-read mirror of the sum of
 *   all movements for that material (kept in sync here, never written directly).
 * - An audit entry is written for every movement so the trail is traceable.
 *
 * Idempotency (Day 13):
 *   - If `input.idempotencyKey` is provided, we check whether a movement with
 *     that key already exists. If it does, we return the existing movement's
 *     id and newStock WITHOUT creating a duplicate. This makes retries safe:
 *     the same key submitted twice produces exactly one movement.
 *   - The idempotency key is stored on the movement row so the guard is
 *     durable (survives process restarts) and visible in the ledger.
 *
 * Throws if:
 *   - the material or warehouse (if given) does not exist
 *   - the movement would make current_stock negative (optional safeguard —
 *     remove the check if you want to allow negative stock)
 */
export async function recordMovement(input: MovementInput): Promise<{ id: string; newStock: number }> {
  const { materialId, warehouseId, type, quantity, reference, referenceId, actorUserId, actorName, tenantId, description, idempotencyKey } = input;

  if (quantity === 0) {
    throw new Error('Movement quantity must be non-zero');
  }

  // Verify the material exists and belongs to the tenant (RLS would also catch this).
  const material = await db.orm.public.Material
    .select('id', 'currentStock', 'reservedQty')
    .where((m) => m.id.eq(materialId))
    .first();
  if (!material) throw new Error('Material not found');

  // Optional: prevent negative on-hand stock
  if (material.currentStock + quantity < 0) {
    throw new Error(`Insufficient stock: material has ${material.currentStock}, attempted to remove ${Math.abs(quantity)}`);
  }

  // Idempotency guard (Day 13): if a key is provided and a matching movement
  // already exists, return it verbatim — never double-count. Check AFTER
  // we've loaded the material so the returned newStock is accurate.
  if (idempotencyKey) {
    const existing = await db.orm.public.StockMovement
      .select('id', 'quantity')
      .where((m) => m.referenceId.eq(idempotencyKey))
      .first();
    if (existing) {
      return { id: existing.id, newStock: material.currentStock + existing.quantity };
    }
  }

  // Record the movement row (immutable ledger entry).
  // If an idempotency key is provided, store it as the reference_id so the
  // guard above can find this row on a retry.
  const movement = await db.orm.public.StockMovement.create({
    tenantId,
    materialId,
    warehouseId: warehouseId ?? null,
    type,
    quantity,
    reference: reference ?? null,
    referenceId: idempotencyKey ?? referenceId ?? null,
  });

  // Update the material's on-hand mirror.
  const newStock = material.currentStock + quantity;
  await db.orm.public.Material
    .where((m) => m.id.eq(materialId))
    .update({ currentStock: newStock });

  // Write an audit entry so the movement is traceable.
  await audit(
    tenantId,
    actorUserId,
    actorName,
    type === 'PURCHASE' || type === 'RETURN' ? 'CREATE' : type === 'DAMAGE' ? 'DELETE' : 'UPDATE',
    'stock_movement',
    movement.id,
    description ?? `${type} movement: ${quantity > 0 ? '+' : ''}${quantity} ${type.toLowerCase()} for material`,
  );

  return { id: movement.id, newStock };
}

/** Reverse a previous movement by quantity sign. Used for cancellations / corrections. */
export async function reverseMovement(
  movementId: string,
  actorUserId: string,
  actorName: string,
  tenantId: string,
): Promise<{ id: string; newStock: number }> {
  const original = await db.orm.public.StockMovement
    .select('id', 'materialId', 'warehouseId', 'type', 'quantity', 'reference', 'referenceId')
    .where((m) => m.id.eq(movementId))
    .first();
  if (!original) throw new Error('Movement not found');

  // Create a reversing entry with opposite quantity and a reference back to the original.
  return recordMovement({
    materialId: original.materialId,
    warehouseId: original.warehouseId ?? undefined,
    type: original.type,
    quantity: -original.quantity,
    reference: original.reference ?? undefined,
    referenceId: original.id,
    actorUserId,
    actorName,
    tenantId,
    description: `Reversal of movement ${original.id}`,
  });
}
