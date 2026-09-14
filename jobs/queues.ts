/**
 * Job queue definitions for background processors.
 *
 * In a production system these would be backed by a real queue (BullMQ,
 * Redis, etc.). For now, they are in-memory stubs that the worker process
 * polls. The key types and names are defined here so both the main app
 * (which enqueues) and the worker (which processes) agree on the shape.
 */

/** The types of background jobs the system can run. */
export type JobType =
  | 'purchase_recommendation'
  | 'reorder_point_refresh'
  | 'forecast_refresh'
  | 'notify'
  | 'rules_evaluation';

/** A queued job. */
export type QueuedJob = {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  createdAt: string;
  scheduledAt: string;
};

/** Enqueue a job. In production this pushes to a real queue. */
export function enqueueJob(type: JobType, payload: Record<string, unknown>): QueuedJob {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    scheduledAt: new Date().toISOString(),
  };
}

/** Job names for the worker to subscribe to. */
export const JOB_TYPES: Record<JobType, string> = {
  purchase_recommendation: 'purchase_recommendation',
  reorder_point_refresh: 'reorder_point_refresh',
  forecast_refresh: 'forecast_refresh',
  notify: 'notify',
  rules_evaluation: 'rules_evaluation',
};
