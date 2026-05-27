const { admin, db, formatDoc } = require('../config/firebase');


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

    if (userDoc.exists) {
      return res.status(200).json({
        success: true,
        data: {
          _id: userDoc.id,
          ...userDoc.data()
        }
      });
    }

    // Generate a unique customId: PRDX-XXXXXX
    let isUnique = false;
    let generatedId = '';
    while (!isUnique) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      generatedId = `PRDX-${randomNum}`;
      
      const existing = await db.collection('users').where('customId', '==', generatedId).get();
      if (existing.empty) {
        isUnique = true;
      }
    }

    const newUser = {
      name,
      email: email.toLowerCase(),
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
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await userRef.set(newUser);

    res.status(201).json({
      success: true,
      data: {
        _id: userId,
        ...newUser
      }
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
    // req.user has already been resolved from the Firestore 'users' collection in auth middleware
    res.status(200).json({
      success: true,
      data: req.user
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
    data: req.user
  });
};

/**
 * @desc    Google login dummy endpoint (deprecated in favor of full Email/Password Firebase client flow)
 */
const googleLogin = async (req, res, next) => {
  res.status(400).json({
    success: false,
    message: 'Google auth is disabled. Standard Email/Password Firebase flow is active.'
  });
};

/**
 * @desc    Delete user account and purge all user data from Firestore & Firebase Auth
 * @route   DELETE /api/auth/delete-account
 * @access  Private
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Delete user document from 'users'
    await db.collection('users').doc(userId).delete();

    // 2. Delete all tasks belonging to the user
    const tasksSnap = await db.collection('tasks').where('userId', '==', userId).get();
    const tasksBatch = db.batch();
    tasksSnap.forEach((doc) => {
      tasksBatch.delete(doc.ref);
    });
    await tasksBatch.commit();

    // 3. Delete all habits belonging to the user
    const habitsSnap = await db.collection('habits').where('userId', '==', userId).get();
    const habitsBatch = db.batch();
    habitsSnap.forEach((doc) => {
      habitsBatch.delete(doc.ref);
    });
    await habitsBatch.commit();

    // 4. Delete all hobbies belonging to the user
    const hobbiesSnap = await db.collection('hobbies').where('userId', '==', userId).get();
    const hobbiesBatch = db.batch();
    hobbiesSnap.forEach((doc) => {
      hobbiesBatch.delete(doc.ref);
    });
    await hobbiesBatch.commit();

    // 5. Delete friendships where user is requester or accepter
    const friendshipsRequesterSnap = await db.collection('friendships').where('requesterId', '==', userId).get();
    const friendshipsAccepterSnap = await db.collection('friendships').where('accepterId', '==', userId).get();
    const friendshipsBatch = db.batch();
    friendshipsRequesterSnap.forEach((doc) => friendshipsBatch.delete(doc.ref));
    friendshipsAccepterSnap.forEach((doc) => friendshipsBatch.delete(doc.ref));
    await friendshipsBatch.commit();

    // 6. Delete messages sent or received by the user
    const messagesSenderSnap = await db.collection('messages').where('senderId', '==', userId).get();
    const messagesReceiverSnap = await db.collection('messages').where('receiverId', '==', userId).get();
    const messagesBatch = db.batch();
    messagesSenderSnap.forEach((doc) => messagesBatch.delete(doc.ref));
    messagesReceiverSnap.forEach((doc) => messagesBatch.delete(doc.ref));
    await messagesBatch.commit();

    // 7. Cleanup groups (delete if creator, remove from members array otherwise)
    const groupsCreatorSnap = await db.collection('groups').where('creator', '==', userId).get();
    const groupsCreatorBatch = db.batch();
    groupsCreatorSnap.forEach((doc) => groupsCreatorBatch.delete(doc.ref));
    await groupsCreatorBatch.commit();

    const groupsMemberSnap = await db.collection('groups').where('members', 'arrayContains', userId).get();
    const groupMemberPromises = [];
    groupsMemberSnap.forEach((doc) => {
      const data = doc.data();
      const updatedMembers = (data.members || []).filter(m => m !== userId);
      groupMemberPromises.push(doc.ref.update({ members: updatedMembers }));
    });
    if (groupMemberPromises.length > 0) {
      await Promise.all(groupMemberPromises);
    }

    // 8. Delete user from Firebase Auth
    await admin.auth().deleteUser(userId);

    res.status(200).json({
      success: true,
      message: 'Account and all associated data have been permanently deleted.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, googleLogin, deleteAccount };
