import { generatePurchaseRecommendations } from '../../server/mrp/purchaseRecommendations';

/**
 * Background processor: generate purchase recommendations.
 *
 * Called by the worker process when a purchase_recommendation job is dequeued.
 * Generates recommendations for all materials below their reorder point
 * and returns them for display on the purchasing recommendations page.
 */
export async function processPurchaseRecommendation(tenantId: string) {
  return generatePurchaseRecommendations(tenantId);
}
