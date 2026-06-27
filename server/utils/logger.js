/**
 * Winston Structured Logger
 * Replaces all console.log/console.error calls throughout the application.
 * Provides: timestamps, log levels, JSON format in production, pretty format in dev.
 */

const { createLogger, format, transports } = require('winston');

const { combine, timestamp, errors, printf, colorize, json } = format;

// Custom pretty-print format for development
const devFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${stack || message}`;
  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }
  return log;
});

const isProduction = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    isProduction
      ? json()
      : combine(colorize({ all: true }), devFormat)
  ),
  transports: [
    new transports.Console(),
  ],
  // Never exit on handled exceptions
  exitOnError: false,
});

// Convenience wrappers so we can drop in as console replacements
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
