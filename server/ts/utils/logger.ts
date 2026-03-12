/**
 * Structured Logging with Pino + OpenTelemetry Correlation
 *
 * - Dev: pino-pretty for human-readable output
 * - Prod: pino-opentelemetry-transport injects trace_id/span_id into every log line
 * - createModuleLogger() for per-module child loggers
 * - createPlayerLogger() for player-scoped child loggers with id/name context
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

// Dev: pino-pretty for readable output
// Prod: pino-opentelemetry-transport for trace correlation
const transport = isDev
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname,service,version',
      },
    }
  : {
      targets: [
        // JSON to stdout (standard structured logging)
        { target: 'pino/file', options: { destination: 1 }, level: logLevel as string },
        // OTel transport: injects trace_id/span_id and ships to collector
        {
          target: 'pino-opentelemetry-transport',
          options: {
            resourceAttributes: {
              'service.name': 'fracture-server',
              'deployment.environment': process.env.NODE_ENV || 'production',
            },
          },
          level: logLevel as string,
        },
      ],
    };

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

/**
 * Create a player-scoped child logger
 * Automatically includes playerId and playerName in every log line
 *
 * @example
 * const log = createPlayerLogger(player.id, player.name);
 * log.info({ level: 5, xp: 1200 }, 'Level up');
 */
export function createPlayerLogger(playerId: number | string, playerName: string): pino.Logger {
  return logger.child({ playerId, playerName });
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
