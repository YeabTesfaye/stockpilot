import { db } from '../db';
import { audit } from '../audit/log';
import type { ResourceType } from '../audit/log';

/** Result of a successful reservation. */
export type ReservationResult = {
  materialId: string;
  previousReserved: number;
  newReserved: number;
  delta: number;
};

/**
 * Reserve stock against a material. Increments `reserved_qty` by `quantity`.
 *
 * Throws if:
 *   - the material does not exist
 *   - the reservation would exceed available stock (onHand − reserved)
 *
 * This does NOT touch `current_stock` (on-hand) — it only bumps the
 * reserved counter. The available-to-promise figure is `current_stock −
 * reserved_qty` and is computed on read.
 */
export async function reserveStock(
  materialId: string,
  quantity: number,
  tenantId: string,
  actorUserId: string,
  actorName: string,
  reference?: string,
): Promise<ReservationResult> {
  if (quantity <= 0) throw new Error('Reservation quantity must be positive');

  const material = await db.orm.public.Material
    .select('id', 'currentStock', 'reservedQty')
    .where((m) => m.id.eq(materialId))
    .first();
  if (!material) throw new Error('Material not found');

  const available = material.currentStock - material.reservedQty;
  if (available < quantity) {
    throw new Error(
      `Insufficient available stock: need ${quantity}, have ${available} (on hand ${material.currentStock}, reserved ${material.reservedQty})`,
    );
  }

  const newReserved = material.reservedQty + quantity;
  await db.orm.public.Material
    .where((m) => m.id.eq(materialId))
    .update({ reservedQty: newReserved });

  await audit(
    tenantId,
    actorUserId,
    actorName,
    'CREATE',
    'material',
    materialId,
    reference ?? `Reserved ${quantity} units`,
    JSON.stringify({ previousReserved: material.reservedQty, newReserved, quantity }),
  );

  return {
    materialId,
    previousReserved: material.reservedQty,
    newReserved,
    delta: quantity,
  };
}

/**
 * Release a reservation. Decrements `reserved_qty` by `quantity`.
 *
 * Throws if the release would make reserved_qty negative.
 */
export async function releaseReservation(
  materialId: string,
  quantity: number,
  tenantId: string,
  actorUserId: string,
  actorName: string,
  reference?: string,
): Promise<ReservationResult> {
  if (quantity <= 0) throw new Error('Release quantity must be positive');

  const material = await db.orm.public.Material
    .select('id', 'currentStock', 'reservedQty')
    .where((m) => m.id.eq(materialId))
    .first();
  if (!material) throw new Error('Material not found');

  if (material.reservedQty < quantity) {
    throw new Error(
      `Cannot release ${quantity}: only ${material.reservedQty} reserved`,
    );
  }

  const newReserved = material.reservedQty - quantity;
  await db.orm.public.Material
    .where((m) => m.id.eq(materialId))
    .update({ reservedQty: newReserved });

  await audit(
    tenantId,
    actorUserId,
    actorName,
    'UPDATE',
    'material',
    materialId,
    reference ?? `Released ${quantity} units from reservation`,
    JSON.stringify({ previousReserved: material.reservedQty, newReserved, quantity }),
  );

  return {
    materialId,
    previousReserved: material.reservedQty,
    newReserved,
    delta: -quantity,
  };
}

/**
 * Adjust reserved quantity to an exact value. Useful when an order is
 * cancelled in full or partially and you know the final reserved amount.
 */
export async function adjustReservation(
  materialId: string,
  newReserved: number,
  tenantId: string,
  actorUserId: string,
  actorName: string,
  reference?: string,
): Promise<ReservationResult> {
  if (newReserved < 0) throw new Error('reserved_qty cannot be negative');

  const material = await db.orm.public.Material
    .select('id', 'currentStock', 'reservedQty')
    .where((m) => m.id.eq(materialId))
    .first();
  if (!material) throw new Error('Material not found');

  // Sanity: can't reserve more than on-hand.
  if (newReserved > material.currentStock) {
    throw new Error(
      `Cannot reserve ${newReserved}: on hand is only ${material.currentStock}`,
    );
  }

  await db.orm.public.Material
    .where((m) => m.id.eq(materialId))
    .update({ reservedQty: newReserved });

  await audit(
    tenantId,
    actorUserId,
    actorName,
    'UPDATE',
    'material',
    materialId,
    reference ?? `Adjusted reservation to ${newReserved}`,
    JSON.stringify({ previousReserved: material.reservedQty, newReserved }),
  );

  return {
    materialId,
    previousReserved: material.reservedQty,
    newReserved,
    delta: newReserved - material.reservedQty,
  };
}
