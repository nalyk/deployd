/**
 * Production-grade structured logging with Winston
 *
 * Replaces console.log/error/warn with structured JSON logging
 * Includes request IDs, timestamps, and log levels
 */

var winston = require('winston');

var env = process.env.NODE_ENV || 'development';

// Configure log format
var logFormat = winston.format.combine(
  winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
  winston.format.errors({stack: true}),
  winston.format.metadata(),
  winston.format.json()
);

// Development format (human-readable)
var devFormat = winston.format.combine(
  winston.format.timestamp({format: 'HH:mm:ss'}),
  winston.format.errors({stack: true}),
  winston.format.printf(function(info) {
    var msg = info.timestamp + ' [' + info.level.toUpperCase() + '] ' + info.message;
    if (info.requestId) {
      msg += ' (req: ' + info.requestId + ')';
    }
    if (info.stack) {
      msg += '\n' + info.stack;
    }
    return msg;
  })
);

// Create logger instance
var logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug'),
  format: env === 'production' ? logFormat : devFormat,
  defaultMeta: {
    service: 'deployd',
    environment: env
  },
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ]
});

// Add file transports in production
if (env === 'production') {
  logger.add(new winston.transports.File({
    filename: 'error.log',
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }));

  logger.add(new winston.transports.File({
    filename: 'combined.log',
    maxsize: 10485760,
    maxFiles: 5
  }));
}

/**
 * Create a child logger with request context
 */
function child(meta) {
  return logger.child(meta);
}

/**
 * Log with request ID if available
 */
function logWithRequest(level, message, req, meta) {
  var logMeta = meta || {};
  if (req && req.id) {
    logMeta.requestId = req.id;
  }
  if (req && req.method && req.url) {
    logMeta.method = req.method;
    logMeta.url = req.url;
  }
  // Call the winston logger directly, not the exported convenience methods
  logger.log(level, message, logMeta);
}

// Convenience methods
function info(message, req, meta) {
  logWithRequest('info', message, req, meta);
}

function warn(message, req, meta) {
  logWithRequest('warn', message, req, meta);
}

function error(message, req, meta) {
  logWithRequest('error', message, req, meta);
}

function debugLog(message, req, meta) {
  logWithRequest('debug', message, req, meta);
}

module.exports = logger;
module.exports.child = child;
module.exports.info = info;
module.exports.warn = warn;
module.exports.error = error;
module.exports.debug = debugLog;
