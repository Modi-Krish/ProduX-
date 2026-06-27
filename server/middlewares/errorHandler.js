/**
 * Global Error Handler Middleware
 *
 * FIX (CODE-4): Removed all Mongoose-specific error handlers (ValidationError,
 * code 11000 duplicate key, CastError, JWT errors). This project uses Firestore,
 * not MongoDB/Mongoose. Those handlers were dead code that created misleading
 * error messages for non-existent error types.
 *
 * Added: Winston structured logging, request context in error logs.
 */

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log the full error stack server-side — never leak this to the client
  logger.error('Unhandled Error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?._id || 'unauthenticated',
    statusCode: err.statusCode,
  });

  // Use a custom statusCode if attached to the error object, otherwise 500
  const statusCode = err.statusCode || 500;

  // In production, never expose raw internal error messages for 5xx errors
  const isOperational = err.isOperational || statusCode < 500;
  const message = isOperational
    ? err.message || 'Something went wrong'
    : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    // Only include error code in development for faster debugging
    ...(process.env.NODE_ENV !== 'production' && { debug: err.message }),
  });
};

module.exports = errorHandler;
