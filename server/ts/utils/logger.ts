/**
 * Structured Logging with Pino
 *
 * Replaces console.log with proper structured logging.
 * Supports log levels, context injection, and JSON output in production.
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

// Base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: logLevel,
  base: {
    service: 'fracture-server',
    version: process.env.npm_package_version || '1.0.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// In development, use pino-pretty for readable output
const transport = isDev
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname,service,version',
      },
    }
  : undefined;

// Create the main logger
export const logger = pino({
  ...baseConfig,
  transport,
});

/**
 * Create a child logger with additional context
 * Use this to add player/entity/request context to logs
 *
 * @example
 * const playerLogger = createChildLogger({ playerId: player.id, playerName: player.name });
 * playerLogger.info('Player connected');
 */
export function createChildLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}

/**
 * Create a logger for a specific module
 *
 * @example
 * const log = createModuleLogger('CombatSystem');
 * log.info({ damage: 50 }, 'Player dealt damage');
 */
export function createModuleLogger(moduleName: string): pino.Logger {
  return logger.child({ module: moduleName });
}

// Named log level methods for convenience
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  fatal: logger.fatal.bind(logger),
};

// Export types for consumers
export type Logger = pino.Logger;
