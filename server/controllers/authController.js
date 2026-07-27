const { admin, db, formatDoc } = require('../config/firebase');
const logger = require('../utils/logger');
const crypto = require('crypto');

const hashPin = (pin) => {
  if (!pin) return null;
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
};

const verifyPinHash = (pin, hashStr) => {
  if (!hashStr) return false;
  const [salt, key] = hashStr.split(':');
  const derivedKey = crypto.scryptSync(pin, salt, 64).toString('hex');
  return key === derivedKey;
};

// ── Constants ─────────────────────────────────────────────
const MAX_CUSTOM_ID_ATTEMPTS = 15;

/**
 * @desc    Register a new user profile in Firestore (called after Firebase Auth signup)
 * @route   POST /api/auth/register
 * @access  Private (Verified by Firebase Auth ID Token in protect middleware)
 */
const register = async (req, res, next) => {
  try {
    const userId = req.user._id; // UID from Firebase Auth token
    const email = req.user.email;
    const name = req.body.name || req.user.name || 'User';

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    // Idempotent — if user profile already exists, return it
    if (userDoc.exists) {
      return res.status(200).json({
        success: true,
        data: {
          _id: userDoc.id,
          ...userDoc.data(),
        },
      });
    }

    // ── Generate unique customId: PRDX-XXXXXX ──
    // FIX (BUG-5): Added max attempt guard to prevent infinite loop.
    let generatedId = '';
    let attempts = 0;

    while (attempts < MAX_CUSTOM_ID_ATTEMPTS) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      generatedId = `PRDX-${randomNum}`;

      const existing = await db
        .collection('users')
        .where('customId', '==', generatedId)
        .limit(1)
        .get();

      if (existing.empty) break;

      attempts++;
      logger.warn('customId collision, retrying', { attempt: attempts, generatedId });
    }

    if (attempts >= MAX_CUSTOM_ID_ATTEMPTS) {
      const err = new Error('Failed to generate unique user ID. Please try again.');
      err.statusCode = 500;
      err.isOperational = true;
      return next(err);
    }

    const newUser = {
      name: String(name).trim().substring(0, 100),
      email: String(email).toLowerCase().trim(),
      customId: generatedId,
      xp: 0,
      level: 1,
      streak: 0,
      longestStreak: 0,
      lastCompletedDate: null,
      totalTasksCompleted: 0,
      badges: [],
      pushSubscriptions: [],
      fcmTokens: [],
      avatar: null, // Stores R2 attachment object
      communityPin: null,
      walkieTalkiePin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await userRef.set(newUser);

    logger.info('New user registered', { userId, customId: generatedId });

    res.status(201).json({
      success: true,
      data: {
        _id: userId,
        ...newUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user — verified by protect middleware, return profile
 * @route   POST /api/auth/login
 * @access  Private (Protected)
 */
const login = async (req, res, next) => {
  try {
    // req.user is already fully resolved from Firestore by the protect middleware
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
};

/**
 * @desc    Deprecated Google login endpoint.
 * @route   POST /api/auth/google
 */
const googleLogin = async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Google auth is no longer available. Please use Email/Password authentication.',
  });
};

/**
 * @desc    Update user profile (name, avatar)
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, avatar } = req.body;

    const updateData = { updatedAt: new Date() };
    if (name !== undefined) {
      updateData.name = String(name).trim().substring(0, 100);
    }
    if (avatar !== undefined) {
      updateData.avatar = avatar; // Expected object: { url, objectKey, fileName, etc }
    }

    const userRef = db.collection('users').doc(userId);
    await userRef.update(updateData);

    const updatedSnap = await userRef.get();
    res.status(200).json({
      success: true,
      data: { _id: userId, ...updatedSnap.data() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user account and purge all user data from Firestore & Firebase Auth
 * @route   DELETE /api/auth/delete-account
 * @access  Private
 *
 * FIX (BUG-2): Corrected field names from 'requesterId'/'accepterId' to
 * 'requester'/'recipient' to match the actual Firestore document schema
 * used when creating friendships in socialController.js.
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    logger.info('Account deletion initiated', { userId });

    const { deleteUserDirectory } = require('../services/storageService');
    
    // Clear out user files from R2
    try {
      await deleteUserDirectory(userId);
    } catch (err) {
      logger.warn(`Could not completely delete R2 directory for user ${userId}`, { error: err.message });
    }

    // 1. Finally delete the user document
    await db.collection('users').doc(userId).delete();

    // 2. Delete all tasks belonging to the user
    const tasksSnap = await db.collection('tasks').where('userId', '==', userId).get();
    if (!tasksSnap.empty) {
      const tasksBatch = db.batch();
      tasksSnap.forEach((doc) => tasksBatch.delete(doc.ref));
      await tasksBatch.commit();
    }

    // 3. Delete all habits belonging to the user
    const habitsSnap = await db.collection('habits').where('userId', '==', userId).get();
    if (!habitsSnap.empty) {
      const habitsBatch = db.batch();
      habitsSnap.forEach((doc) => habitsBatch.delete(doc.ref));
      await habitsBatch.commit();
    }

    // 4. Delete all hobbies belonging to the user
    const hobbiesSnap = await db.collection('hobbies').where('userId', '==', userId).get();
    if (!hobbiesSnap.empty) {
      const hobbiesBatch = db.batch();
      hobbiesSnap.forEach((doc) => hobbiesBatch.delete(doc.ref));
      await hobbiesBatch.commit();
    }

    // 5. Delete friendships where user is requester or recipient
    // FIX (BUG-2): Corrected field names: 'requester' and 'recipient'
    // (was incorrectly using 'requesterId' and 'accepterId' which don't exist in the schema)
    const friendshipsRequesterSnap = await db
      .collection('friendships')
      .where('requester', '==', userId)  // FIXED: was 'requesterId'
      .get();
    const friendshipsRecipientSnap = await db
      .collection('friendships')
      .where('recipient', '==', userId)  // FIXED: was 'accepterId'
      .get();

    if (!friendshipsRequesterSnap.empty || !friendshipsRecipientSnap.empty) {
      const friendshipsBatch = db.batch();
      friendshipsRequesterSnap.forEach((doc) => friendshipsBatch.delete(doc.ref));
      friendshipsRecipientSnap.forEach((doc) => friendshipsBatch.delete(doc.ref));
      await friendshipsBatch.commit();
    }

    // 6. Delete messages sent or received by the user
    const messagesSenderSnap = await db
      .collection('messages')
      .where('senderId', '==', userId)
      .get();
    const messagesReceiverSnap = await db
      .collection('messages')
      .where('receiverId', '==', userId)
      .get();

    if (!messagesSenderSnap.empty || !messagesReceiverSnap.empty) {
      const messagesBatch = db.batch();
      messagesSenderSnap.forEach((doc) => messagesBatch.delete(doc.ref));
      messagesReceiverSnap.forEach((doc) => messagesBatch.delete(doc.ref));
      await messagesBatch.commit();
    }

    // 7. Cleanup groups — delete groups the user created, remove from member lists otherwise
    const groupsCreatorSnap = await db
      .collection('groups')
      .where('creator', '==', userId)
      .get();
    if (!groupsCreatorSnap.empty) {
      const groupsCreatorBatch = db.batch();
      groupsCreatorSnap.forEach((doc) => groupsCreatorBatch.delete(doc.ref));
      await groupsCreatorBatch.commit();
    }

    const groupsMemberSnap = await db
      .collection('groups')
      .where('members', 'array-contains', userId)
      .get();
    if (!groupsMemberSnap.empty) {
      const groupMemberPromises = [];
      groupsMemberSnap.forEach((doc) => {
        const data = doc.data();
        const updatedMembers = (data.members || []).filter((m) => m !== userId);
        groupMemberPromises.push(
          doc.ref.update({ members: updatedMembers, updatedAt: new Date() })
        );
      });
      await Promise.all(groupMemberPromises);
    }

    // 8. Delete user from Firebase Auth (must be last)
    await admin.auth().deleteUser(userId);

    logger.info('Account deletion completed', { userId });

    res.status(200).json({
      success: true,
      message: 'Account and all associated data have been permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update feature PINs
 * @route   PUT /api/auth/pins
 * @access  Private
 */
const updatePins = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { communityPin, walkieTalkiePin } = req.body;

    const updateData = { updatedAt: new Date() };

    if (communityPin !== undefined) {
      updateData.communityPin = hashPin(communityPin);
    }
    
    if (walkieTalkiePin !== undefined) {
      updateData.walkieTalkiePin = hashPin(walkieTalkiePin);
    }

    if (Object.keys(updateData).length === 1) { // only updatedAt
      return res.status(400).json({ success: false, message: 'No pins provided' });
    }

    await db.collection('users').doc(userId).update(updateData);

    res.status(200).json({
      success: true,
      message: 'PINs updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify feature PIN
 * @route   POST /api/auth/verify-pin
 * @access  Private
 */
const verifyPin = async (req, res, next) => {
  try {
    const { feature, pin } = req.body;
    
    if (!feature || !pin) {
      return res.status(400).json({ success: false, message: 'Feature and PIN are required' });
    }

    const fieldName = feature === 'community' ? 'communityPin' : feature === 'walkieTalkie' ? 'walkieTalkiePin' : null;
    
    if (!fieldName) {
      return res.status(400).json({ success: false, message: 'Invalid feature specified' });
    }

    const storedHash = req.user[fieldName];
    if (!storedHash) {
      return res.status(400).json({ success: false, message: 'No PIN configured for this feature' });
    }

    const isValid = verifyPinHash(pin, storedHash);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Incorrect PIN' });
    }

    res.status(200).json({
      success: true,
      message: 'PIN verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  googleLogin,
  deleteAccount,
  updateProfile,
  updatePins,
  verifyPin,
};
