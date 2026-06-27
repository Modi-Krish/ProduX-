const { admin, db } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Protect routes — verify Firebase ID Token
 * 
 * FIX (SEC-8): Error details are no longer leaked to the client.
 * Internal Firebase error codes are logged server-side and a generic
 * "Not authorized" message is returned to the caller.
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — no token provided',
    });
  }

  try {
    // Verify Firebase ID Token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Check if user exists in Firestore users collection
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      // Special case: allow /register through so the controller can create the profile
      if (req.originalUrl.includes('/api/auth/register')) {
        req.user = {
          _id: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || '',
        };
        return next();
      }

      return res.status(401).json({
        success: false,
        message: 'Not authorized — user profile not found',
      });
    }

    // Attach user profile — _id is the Firestore document ID (Firebase UID)
    req.user = {
      _id: userDoc.id,
      ...userDoc.data(),
    };

    next();
  } catch (error) {
    // FIX (SEC-8): Log full error server-side; return generic message to client
    logger.error('Firebase Auth Middleware Error', {
      code: error.code,
      message: error.message,
      path: req.originalUrl,
    });

    // Map Firebase error codes to appropriate HTTP responses without leaking internals
    const message =
      error.code === 'auth/id-token-expired'
        ? 'Session expired — please log in again'
        : 'Not authorized — invalid token';

    return res.status(401).json({
      success: false,
      message,
    });
  }
};

module.exports = { protect };
