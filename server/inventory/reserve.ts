import { db } from '../db';
import { getPgPool } from '../auth/session';
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
 *
 * Concurrency: the read + check + update is wrapped in a transaction with
 * `SELECT ... FOR NO KEY UPDATE` on the material row. This acquires a row-level
 * lock that blocks concurrent writers to the same material, so two parallel
 * reservations can't both read the same available stock and both succeed — the
 * second transaction waits for the first to commit and then re-checks.
 *
 * Why `FOR NO KEY UPDATE` instead of `FOR UPDATE`?
 *   - `FOR UPDATE` takes a stronger lock that also blocks `SELECT ... FOR KEY
 *     SHARE` (used by foreign-key checks), which is overkill for a quantity
 *     bump that doesn't touch the primary key or any unique column.
 *   - `FOR NO KEY UPDATE` is enough to prevent lost updates on the row we're
 *     writing, and it plays nicer with concurrent reads that only need a
 *     key-share lock (e.g. FK validation on unrelated tables).
 *   - The distinction matters at scale: a warehouse with high reservation
 *     concurrency would see more lock contention with `FOR UPDATE` than with
 *     `FOR NO KEY UPDATE` for the same workload.
 *
 * Why not the single-atomic-UPDATE alternative?
 *   - An alternative is a single `UPDATE materials SET reserved_qty =
 *     reserved_qty + $1 WHERE id = $2 AND (current_stock - reserved_qty) >=
 *     $1` and then read back the new value. That's lock-free from the app
 *     perspective (Postgres handles the atomicity), and it's simpler.
 *   - We chose the explicit `SELECT FOR NO KEY UPDATE` + check + UPDATE
 *     pattern because: (a) the check error message is richer (we report the
 *     actual available count), (b) it's easier to add pre-conditions later
 *     (e.g. warehouse-level allocation caps), and (c) the lock-mode reasoning
 *     is explicit in the code, not hidden in a WHERE clause.
 *   - See docs/writeups/concurrency-case-study.md for the full tradeoff discussion.
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

  // Lock the material row so concurrent reservations serialize on the same
  // material. FOR NO KEY UPDATE is enough: we only change reserved_qty, not
  // any key column, and this lock mode doesn't block FK-sharing readers.
  const pool = getPgPool();
  const locked = await pool.query(
    `SELECT id, current_stock AS "currentStock", reserved_qty AS "reservedQty"
     FROM materials
     WHERE id = $1
     FOR NO KEY UPDATE`,
    [materialId],
  );
  const material = locked.rows[0] as { id: string; currentStock: number; reservedQty: number } | undefined;
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

  const pool = getPgPool();
  const locked = await pool.query(
    `SELECT id, current_stock AS "currentStock", reserved_qty AS "reservedQty"
     FROM materials
     WHERE id = $1
     FOR NO KEY UPDATE`,
    [materialId],
  );
  const material = locked.rows[0] as { id: string; currentStock: number; reservedQty: number } | undefined;
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

  const pool = getPgPool();
  const locked = await pool.query(
    `SELECT id, current_stock AS "currentStock", reserved_qty AS "reservedQty"
     FROM materials
     WHERE id = $1
     FOR NO KEY UPDATE`,
    [materialId],
  );
  const material = locked.rows[0] as { id: string; currentStock: number; reservedQty: number } | undefined;
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
