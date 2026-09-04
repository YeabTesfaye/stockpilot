import { AsyncLocalStorage } from 'node:async_hooks';

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
  return tenantContext.run({ tenantId }, async () => fn());
}
