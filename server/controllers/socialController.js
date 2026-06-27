/**
 * Social Controller — Leaderboard, Friends, and User Search
 *
 * Split from the original 1178-line socialController.js (CODE-1 fix).
 * This file handles: leaderboard, friend requests, friends list, user search,
 * unread counts, and conversations.
 *
 * FIX (SEC-5): VAPID mailto moved to environment variable VAPID_MAILTO.
 * FIX (CODE-1): Controller split into social / message / push responsibility areas.
 */

const { db, formatDocs } = require('../config/firebase');
const socialService = require('../services/socialService');
const logger = require('../utils/logger');

/**
 * @desc    Get global leaderboard (top 50 users by XP)
 * @route   GET /api/social/leaderboard
 * @access  Private
 */
const getLeaderboard = async (req, res, next) => {
  try {
    const leaderboard = await socialService.getLeaderboard(50);
    res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send a friend request
 * @route   POST /api/social/friends/request
 * @access  Private
 */
const sendFriendRequest = async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'recipientId is required' });
    }

    if (requesterId === recipientId) {
      return res.status(400).json({ success: false, message: "You can't friend yourself" });
    }

    // Check if friendship already exists in either direction
    const [snap1, snap2] = await Promise.all([
      db.collection('friendships').where('requester', '==', requesterId).where('recipient', '==', recipientId).get(),
      db.collection('friendships').where('requester', '==', recipientId).where('recipient', '==', requesterId).get(),
    ]);

    if (!snap1.empty || !snap2.empty) {
      return res.status(400).json({ success: false, message: 'Friend request already exists' });
    }

    const friendshipData = {
      requester: requesterId,
      recipient: recipientId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection('friendships').add(friendshipData);
    const friendship = { _id: docRef.id, ...friendshipData };

    // Notify recipient via socket
    const io = req.app.get('io');
    if (io) {
      const requesterSnap = await db.collection('users').doc(requesterId).get();
      const requesterName = requesterSnap.exists ? requesterSnap.data().name : 'User';
      io.to(recipientId).emit('friend_request', {
        friendshipId: friendship._id,
        from: { _id: requesterId, name: requesterName },
      });
    }

    logger.info('Friend request sent', { requesterId, recipientId });

    res.status(201).json({ success: true, data: friendship });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept or reject a friend request
 * @route   PATCH /api/social/friends/:id
 * @access  Private
 */
const respondFriendRequest = async (req, res, next) => {
  try {
    const { status } = req.body;
    const VALID_STATUSES = ['accepted', 'rejected'];

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'accepted' or 'rejected'" });
    }

    const friendshipRef = db.collection('friendships').doc(req.params.id);
    const friendshipSnap = await friendshipRef.get();

    if (!friendshipSnap.exists) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    const friendship = friendshipSnap.data();

    // Only the recipient can respond to the request
    if (friendship.recipient !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized to respond to this request' });
    }

    await friendshipRef.update({ status, updatedAt: new Date() });

    const updatedFriendship = { _id: friendshipRef.id, ...friendship, status };

    // Notify the original requester when accepted
    const io = req.app.get('io');
    if (io && status === 'accepted') {
      const accepterSnap = await db.collection('users').doc(req.user._id).get();
      const accepterName = accepterSnap.exists ? accepterSnap.data().name : 'User';
      io.to(friendship.requester).emit('friend_accepted', {
        friendshipId: friendshipRef.id,
        from: { _id: req.user._id, name: accepterName },
      });
    }

    res.status(200).json({ success: true, data: updatedFriendship });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get friends list and pending requests
 * @route   GET /api/social/friends
 * @access  Private
 */
const getFriends = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [snap1, snap2, pendingSnap] = await Promise.all([
      db.collection('friendships').where('requester', '==', userId).where('status', '==', 'accepted').get(),
      db.collection('friendships').where('recipient', '==', userId).where('status', '==', 'accepted').get(),
      db.collection('friendships').where('recipient', '==', userId).where('status', '==', 'pending').get(),
    ]);

    const friendships = [...formatDocs(snap1), ...formatDocs(snap2)];
    const pendingRequests = formatDocs(pendingSnap);

    // Batch-fetch all involved user profiles
    const userIds = new Set();
    friendships.forEach((f) => { userIds.add(f.requester); userIds.add(f.recipient); });
    pendingRequests.forEach((r) => { userIds.add(r.requester); });

    const userProfiles = {};
    if (userIds.size > 0) {
      const userSnaps = await Promise.all(Array.from(userIds).map((uid) => db.collection('users').doc(uid).get()));
      userSnaps.forEach((snap) => {
        if (snap.exists) userProfiles[snap.id] = { _id: snap.id, ...snap.data() };
      });
    }

    const friends = friendships.map((f) => {
      const friendId = f.requester === userId ? f.recipient : f.requester;
      const friend = userProfiles[friendId] || { name: 'Unknown', xp: 0, level: 1, streak: 0 };
      return { friendshipId: f._id, _id: friendId, name: friend.name, xp: friend.xp || 0, level: friend.level || 1, streak: friend.streak || 0 };
    });

    const pending = pendingRequests.map((r) => {
      const requester = userProfiles[r.requester] || { name: 'Unknown', xp: 0, level: 1 };
      return { friendshipId: r._id, _id: r.requester, name: requester.name, xp: requester.xp || 0, level: requester.level || 1 };
    });

    res.status(200).json({ success: true, data: { friends, pending } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Find a user by their unique customId (e.g. PRDX-123456)
 * @route   GET /api/social/users/:customId
 * @access  Private
 */
const findUserByCustomId = async (req, res, next) => {
  try {
    const customId = req.params.customId.trim().toUpperCase();
    const currentUserId = req.user._id;

    if (!customId.match(/^PRDX-\d{6}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid customId format. Expected: PRDX-XXXXXX' });
    }

    const usersSnap = await db.collection('users').where('customId', '==', customId).limit(1).get();

    if (usersSnap.empty) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userDoc = usersSnap.docs[0];
    const user = { _id: userDoc.id, ...userDoc.data() };

    // Check existing relationship status
    const [snap1, snap2] = await Promise.all([
      db.collection('friendships').where('requester', '==', currentUserId).where('recipient', '==', user._id).get(),
      db.collection('friendships').where('requester', '==', user._id).where('recipient', '==', currentUserId).get(),
    ]);

    const friendshipDoc = !snap1.empty ? snap1.docs[0] : (!snap2.empty ? snap2.docs[0] : null);
    let relationship = 'none';
    let friendshipId = null;

    if (friendshipDoc) {
      const friendship = friendshipDoc.data();
      friendshipId = friendshipDoc.id;
      if (friendship.status === 'accepted') relationship = 'friends';
      else if (friendship.status === 'pending') {
        relationship = friendship.requester === currentUserId ? 'pending_sent' : 'pending_received';
      }
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        customId: user.customId,
        level: user.level,
        xp: user.xp,
        streak: user.streak,
        badgeCount: user.badges?.length || 0,
        relationship,
        friendshipId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unread message + friend request counts
 * @route   GET /api/social/unread
 * @access  Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [pendingFriendsSnap, unreadMessagesSnap] = await Promise.all([
      db.collection('friendships').where('recipient', '==', userId).where('status', '==', 'pending').get(),
      db.collection('messages').where('groupId', '==', null).where('receiverId', '==', userId).where('read', '==', false).get(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        pendingFriendsCount: pendingFriendsSnap.size,
        unreadMessagesCount: unreadMessagesSnap.size,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all DM conversations with latest message and unread count
 * @route   GET /api/social/conversations
 * @access  Private
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [snap1, snap2] = await Promise.all([
      db.collection('messages').where('groupId', '==', null).where('senderId', '==', userId).get(),
      db.collection('messages').where('groupId', '==', null).where('receiverId', '==', userId).get(),
    ]);

    const allDMs = [...formatDocs(snap1), ...formatDocs(snap2)];
    allDMs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const conversationMap = {};
    allDMs.forEach((msg) => {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversationMap[partnerId]) {
        conversationMap[partnerId] = {
          partnerId,
          lastMessage: msg.text,
          lastMessageAt: msg.createdAt,
          lastSenderId: msg.senderId,
          unreadCount: 0,
        };
      }
      if (msg.receiverId === userId && !msg.read) {
        conversationMap[partnerId].unreadCount += 1;
      }
    });

    const partnerIds = Object.keys(conversationMap);
    if (partnerIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const partnerSnaps = await Promise.all(partnerIds.map((pid) => db.collection('users').doc(pid).get()));

    const conversations = partnerSnaps
      .filter((snap) => snap.exists)
      .map((snap) => {
        const data = snap.data();
        const conv = conversationMap[snap.id];
        return {
          _id: snap.id,
          partnerId: snap.id,
          partnerName: data.name,
          partnerLevel: data.level || 1,
          partnerXp: data.xp || 0,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          lastSenderId: conv.lastSenderId,
          unreadCount: conv.unreadCount,
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeaderboard,
  sendFriendRequest,
  respondFriendRequest,
  getFriends,
  findUserByCustomId,
  getUnreadCount,
  getConversations,
};
