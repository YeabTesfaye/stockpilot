import { refreshReorderPointStatus } from '../../server/planning/reorderPoint';

/**
 * Background processor: refresh reorder point status.
 *
 * Called periodically (e.g. every hour) to recompute which materials
 * are below their reorder point. The result is used to populate the
 * ReorderStatusBadge column on the materials DataTable.
 */
export async function processReorderPointRefresh(tenantId: string) {
  return refreshReorderPointStatus(tenantId);
}
