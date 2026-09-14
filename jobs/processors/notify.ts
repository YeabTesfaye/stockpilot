import { evaluateAndNotify } from '../../server/rules/engine';

/**
 * Background processor: evaluate rules and fire notifications.
 *
 * Called periodically or on-demand after state changes (sales order
 * created, stock adjusted, etc.) to check if any rules are triggered
 * and create notifications for users.
 */
export async function processNotify(tenantId: string, actorUserId: string, actorName: string) {
  return evaluateAndNotify(tenantId, actorUserId, actorName);
}
