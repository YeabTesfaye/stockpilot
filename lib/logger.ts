/**
 * Structured logger for the application and worker process.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('order created', { orderId, tenantId });
 *   logger.error('payment failed', { orderId, err: error.message });
 *
 * In production, set LOG_LEVEL=debug|info|warn|error to control verbosity.
 * All logs include a timestamp, level, and service tag for aggregation.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const configuredLevel = (process.env['LOG_LEVEL'] as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configuredLevel];
}

function tag(): string {
  if (process.env['NODE_APP_INSTANCE']) return `app-${process.env['NODE_APP_INSTANCE']}`;
  return process.env['NODE_ENV'] === 'test' ? 'test' : 'web';
}

function formatArgs(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const svc = tag();
  const base = `${ts} [${svc}] ${level.toUpperCase()} ${message}`;
  if (!data || Object.keys(data).length === 0) return base;
  return `${base} ${JSON.stringify(data)}`;
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    if (!shouldLog('debug')) return;
    console.debug(formatArgs('debug', message, data));
  },
  info: (message: string, data?: Record<string, unknown>) => {
    if (!shouldLog('info')) return;
    console.info(formatArgs('info', message, data));
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    if (!shouldLog('warn')) return;
    console.warn(formatArgs('warn', message, data));
  },
  error: (message: string, data?: Record<string, unknown>) => {
    if (!shouldLog('error')) return;
    console.error(formatArgs('error', message, data));
  },
  // Bind a child logger with a permanent data context (e.g. tenant id).
  child: (data: Record<string, unknown>) => {
    return {
      debug: (message: string, extra?: Record<string, unknown>) =>
        logger.debug(message, { ...data, ...extra }),
      info: (message: string, extra?: Record<string, unknown>) =>
        logger.info(message, { ...data, ...extra }),
      warn: (message: string, extra?: Record<string, unknown>) =>
        logger.warn(message, { ...data, ...extra }),
      error: (message: string, extra?: Record<string, unknown>) =>
        logger.error(message, { ...data, ...extra }),
    };
  },
};
