const rateLimit = require('express-rate-limit');

/**
 * Global API limiter — applied to all /api/* routes
 * Allows 200 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,   // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
  skip: () => true, // DISABLED FOR TESTING
});

/**
 * Strict limiter for Auth endpoints — prevents brute-force login
 * Allows 10 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes and try again.',
  },
  skip: () => true, // DISABLED FOR TESTING
});

/**
 * Strict limiter for AI endpoints — prevents Gemini quota exhaustion
 * Allows 20 requests per 10 minutes per IP
 */
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'AI request limit reached. Please wait before generating more content.',
  },
  skip: () => true, // DISABLED FOR TESTING
});

/**
 * Social/messaging limiter — prevents message spam
 * Allows 60 requests per minute per IP
 */
const socialLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'You are sending messages too quickly. Please slow down.',
  },
  skip: () => true, // DISABLED FOR TESTING
});

/**
 * Friend request limiter — prevents spam friend requests
 * Allows 10 friend requests per minute per IP
 */
const friendRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many friend requests. Please slow down.',
  },
  skip: () => true, // DISABLED FOR TESTING
});

module.exports = {
  globalLimiter,
  authLimiter,
  aiLimiter,
  socialLimiter,
  friendRequestLimiter,
};
