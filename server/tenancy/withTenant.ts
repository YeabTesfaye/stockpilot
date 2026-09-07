import { AsyncLocalStorage } from 'node:async_hooks';
import { db } from '../db';

/**
 * Carries the active tenant id through async code. Day 1 it is purely a
 * context carrier. Day 2 enforcement drops in by wrapping `fn` in a
 * `SET LOCAL app.current_tenant_id` transaction inside this same helper —
 * every call site already goes through here, so none of them will change.
 */
export const tenantContext = new AsyncLocalStorage<{ tenantId: string }>();

export async function withTenant<T>(
  tenantId: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  return tenantContext.run({ tenantId }, async () => {
    // Day 2: set the PG session variable inside a transaction so that every
    // query executed by `fn` (and any async work it spawns) sees the correct
    // tenant id. `SET LOCAL` is transaction-scoped, so we wrap in
    // `db.transaction`. The setting is read by the RLS policies in
    // `prisma/policies.sql`.
    return db.transaction(async () => {
      await db.raw.sql`SET LOCAL app.current_tenant_id = ${tenantId}`;
      return fn();
    });
  });
}
