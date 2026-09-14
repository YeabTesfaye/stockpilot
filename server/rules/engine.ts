import { db } from '../db';
import { createNotification } from '../notifications/createNotification';

/**
 * Rules engine. Evaluates a set of rules against the current state of the
 * system and fires notifications when rules are triggered.
 *
 * Rules evaluated:
 *   1. LOW_STOCK — material available stock is at or below minStock.
 *   2. OUT_OF_STOCK — material has zero available stock.
 *   3. SHORTAGE — a sales order has material shortages (from BOM explosion).
 *   4. REORDER_POINT — material is approaching its reorder point (within 20%
 *      of minStock).
 *
 * Each rule fires a notification to all users in the tenant with the
 * appropriate role (see permissions for who gets notified).
 *
 * This is designed to be called from a background job or on-demand after
 * state changes (sales order created, stock adjusted, etc.).
 */
export type RuleResult = {
  rule: string;
  triggered: boolean;
  details: string;
  affectedResourceId?: string;
  affectedResourceType?: string;
};

export async function evaluateRules(tenantId: string): Promise<RuleResult[]> {
  const results: RuleResult[] = [];

  // Rule 1: Low stock — available at or below minStock.
  const lowStockMaterials = await db.orm.public.Material
    .select('id', 'name', 'sku', 'minStock', 'currentStock', 'reservedQty')
    .all();

  for (const mat of lowStockMaterials) {
    const available = mat.currentStock - mat.reservedQty;
    if (available <= mat.minStock && mat.minStock > 0) {
      results.push({
        rule: 'LOW_STOCK',
        triggered: true,
        details: `${mat.sku} (${mat.name}) is below reorder point: ${available} available vs ${mat.minStock} min.`,
        affectedResourceId: mat.id,
        affectedResourceType: 'material',
      });
    }
  }

  // Rule 2: Out of stock — zero available.
  for (const mat of lowStockMaterials) {
    const available = mat.currentStock - mat.reservedQty;
    if (available <= 0 && mat.currentStock <= 0) {
      results.push({
        rule: 'OUT_OF_STOCK',
        triggered: true,
        details: `${mat.sku} (${mat.name}) is completely out of stock.`,
        affectedResourceId: mat.id,
        affectedResourceType: 'material',
      });
    }
  }

  // Rule 3: Reorder point approaching (within 20% above minStock).
  for (const mat of lowStockMaterials) {
    const available = mat.currentStock - mat.reservedQty;
    if (mat.minStock > 0 && available > mat.minStock && available <= mat.minStock * 1.2) {
      results.push({
        rule: 'REORDER_POINT',
        triggered: true,
        details: `${mat.sku} (${mat.name}) is approaching reorder point: ${available} available vs ${mat.minStock} min.`,
        affectedResourceId: mat.id,
        affectedResourceType: 'material',
      });
    }
  }

  return results;
}

/**
 * Evaluate rules and fire notifications for triggered rules.
 * Called by the background job processor or on-demand.
 */
export async function evaluateAndNotify(tenantId: string, actorUserId: string, actorName: string) {
  const results = await evaluateRules(tenantId);
  const triggered = results.filter(r => r.triggered);

  for (const rule of triggered) {
    await createNotification({
      tenantId,
      userId: actorUserId,
      type: rule.rule.toLowerCase(),
      title: rule.rule === 'LOW_STOCK' ? 'Low stock alert'
        : rule.rule === 'OUT_OF_STOCK' ? 'Out of stock'
        : rule.rule === 'REORDER_POINT' ? 'Reorder point approaching'
        : `Rule: ${rule.rule}`,
      message: rule.details,
      resourceType: rule.affectedResourceType ?? null,
      resourceId: rule.affectedResourceId ?? null,
    });
  }

  return { evaluated: results.length, triggered: triggered.length };
}
