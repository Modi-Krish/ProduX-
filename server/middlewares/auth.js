const { admin, db } = require('../config/firebase');

/**
 * Protect routes — verify Firebase ID Token
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
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
    // Verify Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Check if user exists in Firestore users collection
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      // If it is the auth/register route, we let it pass but attach the decoded uid to req.user
      // so the register controller can create the user document in Firestore.
      if (req.originalUrl.includes('/api/auth/register')) {
        req.user = {
          _id: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || ''
        };
        return next();
      }

      return res.status(401).json({
        success: false,
        message: 'Not authorized — user profile not found in database',
      });
    }

    // Attach user profile with _id mapped for MongoDB backward compatibility
    req.user = {
      _id: userDoc.id,
      ...userDoc.data()
    };

    next();
  } catch (error) {
    console.error('Firebase Auth Middleware Error:', error.message);
    return res.status(401).json({
      success: false,
      message: `Not authorized — invalid or expired token. Error: ${error.message}`,
    });
  }
};

module.exports = { protect };
