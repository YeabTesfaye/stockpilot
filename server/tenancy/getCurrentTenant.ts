import { tenantContext } from './withTenant';

/** Returns the tenant id established by the nearest `withTenant`, or null. */
export function getCurrentTenant(): string | null {
  return tenantContext.getStore()?.tenantId ?? null;
}
