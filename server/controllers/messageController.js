/**
 * Message Controller — DM and Group Messaging
 *
 * Handles all direct message and group message operations.
 *
 * FIX (BUG-1 / CRITICAL): All DMs now go through this backend controller,
 * which writes to the single 'messages' Firestore collection.
 * The client's socialSlice.js no longer writes directly to the 'dms' collection.
 * This eliminates the dual-storage bug where message history was split across
 * two collections, causing incomplete history in API responses.
 *
 * FIX (PERF-3): getGroupMessages now uses .orderBy('createdAt').limit(200)
 * instead of fetching all messages and slicing in memory.
 *
 * FIX (SEC-9): addGroupMember now requires the requesting user to be the
 * group CREATOR (not just any member) before adding new members.
 */

const { db, formatDocs, admin, isFCMEnabled } = require('../config/firebase');
const webpush = require('web-push');
const logger = require('../utils/logger');

// FIX (SEC-5): VAPID mailto moved from hardcoded string to environment variable
if (process.env.PUBLIC_VAPID_KEY && process.env.PRIVATE_VAPID_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:admin@produx.app',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
  );
}

const MAX_DM_TEXT_LENGTH = 4000;
const MAX_DM_HISTORY = 100;
const MAX_GROUP_HISTORY = 200;

// ── Helpers ─────────────────────────────────────────────────

async function sendWebPush(pushSubscriptions, payload) {
  if (!pushSubscriptions || pushSubscriptions.length === 0) return;
  const payloadStr = JSON.stringify(payload);
  const promises = pushSubscriptions.map((sub) =>
    webpush.sendNotification(sub, payloadStr).catch((err) => {
      // 404/410 means subscription expired — silently ignore
      if (err.statusCode !== 404 && err.statusCode !== 410) {
        logger.warn('Web push send failed', { error: err.message });
      }
    })
  );
  await Promise.all(promises);
}

async function sendFCMPush(tokens, payload) {
  if (!isFCMEnabled) {
    logger.warn('FCM push notification skipped: Firebase Admin SDK is not initialized or FCM is disabled on this server.');
    return;
  }
  if (!tokens || tokens.length === 0) return;
  
  // Deduplicate and filter tokens
  const cleanTokens = [...new Set(tokens.filter((t) => typeof t === 'string' && t.trim()))];
  if (cleanTokens.length === 0) return;

  const message = {
    tokens: cleanTokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        clickAction: 'FCM_PLUGIN_ACTIVITY',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
        },
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info('FCM multicast notification sent from chat', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (err) {
    logger.error('Failed to send FCM multicast from chat', { error: err.message });
  }
}

// ── Direct Messages ────────────────────────────────────────

/**
 * @desc    Send a DM to another user
 * @route   POST /api/social/messages
 * @access  Private
 *
 * BUG-1 FIX: Messages are written to 'messages' collection on the backend.
 * The client's direct Firestore write (to 'dms') is disabled in socialSlice.js
 * so all DMs flow through this controller.
 */
const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, text, fileUrl, fileType, fileName, fileSize, objectKey } = req.body;
    const senderId = req.user._id;

    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'receiverId is required' });
    }

    if (!text && !fileUrl) {
      return res.status(400).json({ success: false, message: 'Message text or file attachment is required' });
    }

    const messageData = {
      senderId,
      receiverId,
      text: text ? String(text).substring(0, MAX_DM_TEXT_LENGTH) : '',
      groupId: null,
      read: false,
      status: 'sent',
      seenAt: null,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName ? String(fileName).substring(0, 255) : null,
      fileSize: typeof fileSize === 'number' ? fileSize : null,
      objectKey: objectKey || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection('messages').add(messageData);

    const [senderSnap, receiverSnap] = await Promise.all([
      db.collection('users').doc(senderId).get(),
      db.collection('users').doc(receiverId).get(),
    ]);
    const senderName = senderSnap.exists ? senderSnap.data().name : 'Unknown';
    const receiverName = receiverSnap.exists ? receiverSnap.data().name : 'Unknown';

    const populated = {
      _id: docRef.id,
      ...messageData,
      senderId: { _id: senderId, name: senderName },
      receiverId: { _id: receiverId, name: receiverName },
    };

    // Real-time delivery to both participants
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId).emit('new_message', populated);
      io.to(senderId).emit('new_message', populated);
    }

    // Push notifications (Web Push + Native FCM)
    if (receiverSnap.exists) {
      const receiver = receiverSnap.data();
      
      // 1. Web Push
      if (receiver.pushSubscriptions?.length > 0) {
        sendWebPush(receiver.pushSubscriptions, {
          title: `New message from ${senderName}`,
          body: fileUrl ? (fileName || 'Sent a file') : (text || '').substring(0, 80),
          icon: '/favicon.ico',
          url: '/social',
        }).catch(() => {});
      }

      // 2. Native FCM Push
      if (receiver.fcmTokens?.length > 0) {
        sendFCMPush(receiver.fcmTokens, {
          title: `New message from ${senderName}`,
          body: fileUrl ? (fileName || 'Sent a file') : (text || '').substring(0, 80),
          data: { type: 'dm', id: senderId },
        }).catch(() => {});
      }
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get DM history with a specific user
 * @route   GET /api/social/messages/:userId
 * @access  Private
 */
const getMessages = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const otherId = req.params.userId;

    const [snap1, snap2] = await Promise.all([
      db.collection('messages').where('groupId', '==', null).where('senderId', '==', userId).where('receiverId', '==', otherId).get(),
      db.collection('messages').where('groupId', '==', null).where('senderId', '==', otherId).where('receiverId', '==', userId).get(),
    ]);

    const rawMessages = [...formatDocs(snap1), ...formatDocs(snap2)];
    rawMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const sliced = rawMessages.slice(-MAX_DM_HISTORY);

    // Build name lookup for both participants
    const [senderSnap, receiverSnap] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('users').doc(otherId).get(),
    ]);
    const userName = senderSnap.exists ? senderSnap.data().name : 'Unknown';
    const otherName = receiverSnap.exists ? receiverSnap.data().name : 'Unknown';

    const messages = sliced.map((m) => ({
      ...m,
      senderId: m.senderId === userId ? { _id: userId, name: userName } : { _id: otherId, name: otherName },
      receiverId: m.receiverId === userId ? { _id: userId, name: userName } : { _id: otherId, name: otherName },
    }));

    // Mark unread messages as seen
    const unreadSnap = await db.collection('messages')
      .where('groupId', '==', null)
      .where('senderId', '==', otherId)
      .where('receiverId', '==', userId)
      .where('read', '==', false)
      .get();

    const seenAt = new Date();
    const seenMsgIds = [];

    if (!unreadSnap.empty) {
      const batch = db.batch();
      unreadSnap.forEach((doc) => {
        batch.update(doc.ref, { read: true, status: 'seen', seenAt, updatedAt: new Date() });
        seenMsgIds.push(doc.id);
      });
      await batch.commit();

      const io = req.app.get('io');
      if (io && seenMsgIds.length > 0) {
        io.to(otherId).emit('messages_seen', { byUserId: userId, messageIds: seenMsgIds, seenAt: seenAt.toISOString() });
      }
    }

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark messages as seen (explicit call from client)
 * @route   POST /api/social/messages/seen
 * @access  Private
 */
const markMessagesSeen = async (req, res, next) => {
  try {
    const { senderId } = req.body;
    const userId = req.user._id;

    if (!senderId) {
      return res.status(400).json({ success: false, message: 'senderId is required' });
    }

    const unreadSnap = await db.collection('messages')
      .where('groupId', '==', null)
      .where('senderId', '==', senderId)
      .where('receiverId', '==', userId)
      .where('read', '==', false)
      .get();

    const seenAt = new Date();
    const seenMsgIds = [];

    if (!unreadSnap.empty) {
      const batch = db.batch();
      unreadSnap.forEach((doc) => {
        batch.update(doc.ref, { read: true, status: 'seen', seenAt, updatedAt: new Date() });
        seenMsgIds.push(doc.id);
      });
      await batch.commit();

      const io = req.app.get('io');
      if (io && seenMsgIds.length > 0) {
        io.to(senderId).emit('messages_seen', { byUserId: userId, messageIds: seenMsgIds, seenAt: seenAt.toISOString() });
      }
    }

    res.status(200).json({ success: true, data: { markedCount: seenMsgIds.length } });
  } catch (error) {
    next(error);
  }
};

// ── Group Chat ─────────────────────────────────────────────

/**
 * @desc    Create a group chat
 * @route   POST /api/social/groups
 * @access  Private
 */
const createGroup = async (req, res, next) => {
  try {
    const { name, memberIds } = req.body;
    const creatorId = req.user._id;

    if (!name || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Group name and at least one member required' });
    }

    const allMembers = [...new Set([creatorId, ...memberIds])];

    const groupData = {
      name: String(name).trim().substring(0, 100),
      members: allMembers,
      creator: creatorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection('groups').add(groupData);

    const userSnaps = await Promise.all(allMembers.map((uid) => db.collection('users').doc(uid).get()));
    const memberProfiles = [];
    let creatorName = 'Unknown';

    userSnaps.forEach((snap) => {
      if (snap.exists) {
        const data = snap.data();
        memberProfiles.push({ _id: snap.id, name: data.name, xp: data.xp || 0, level: data.level || 1 });
        if (snap.id === creatorId) creatorName = data.name;
      }
    });

    const populated = {
      _id: docRef.id,
      ...groupData,
      members: memberProfiles,
      creator: { _id: creatorId, name: creatorName },
    };

    const io = req.app.get('io');
    if (io) {
      allMembers.forEach((memberId) => {
        const sockets = io.sockets.adapter.rooms.get(memberId);
        if (sockets) {
          sockets.forEach((socketId) => io.sockets.sockets.get(socketId)?.join(`group:${docRef.id}`));
        }
        if (memberId !== creatorId) {
          io.to(memberId).emit('group_created', populated);
        }
      });
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all groups the current user belongs to
 * @route   GET /api/social/groups
 * @access  Private
 */
const getGroups = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const groupsSnap = await db.collection('groups').where('members', 'array-contains', userId).get();
    const groups = formatDocs(groupsSnap);
    groups.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const allMemberIds = new Set();
    groups.forEach((g) => {
      g.members.forEach((m) => allMemberIds.add(m));
      allMemberIds.add(g.creator);
    });

    const userProfiles = {};
    if (allMemberIds.size > 0) {
      const userSnaps = await Promise.all(Array.from(allMemberIds).map((uid) => db.collection('users').doc(uid).get()));
      userSnaps.forEach((snap) => { if (snap.exists) userProfiles[snap.id] = { _id: snap.id, ...snap.data() }; });
    }

    const populatedGroups = groups.map((g) => {
      const groupMembers = (g.members || []).map((m) => {
        const p = userProfiles[m] || { name: 'Unknown', xp: 0, level: 1 };
        return { _id: m, name: p.name, xp: p.xp || 0, level: p.level || 1 };
      });
      const creatorProfile = userProfiles[g.creator] || { name: 'Unknown' };
      return { ...g, members: groupMembers, creator: { _id: g.creator, name: creatorProfile.name } };
    });

    res.status(200).json({ success: true, data: populatedGroups });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send a message to a group
 * @route   POST /api/social/groups/:id/messages
 * @access  Private
 */
const sendGroupMessage = async (req, res, next) => {
  try {
    const { text, fileUrl, fileType, fileName, fileSize, objectKey } = req.body;
    const groupId = req.params.id;
    const senderId = req.user._id;

    if (!text && !fileUrl) {
      return res.status(400).json({ success: false, message: 'Message text or file attachment is required' });
    }

    const groupRef = db.collection('groups').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    const group = groupSnap.data();

    if (!group.members.includes(senderId)) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    const messageData = {
      senderId,
      receiverId: null,
      groupId,
      text: text ? String(text).substring(0, MAX_DM_TEXT_LENGTH) : '',
      status: 'sent',
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName ? String(fileName).substring(0, 255) : null,
      fileSize: typeof fileSize === 'number' ? fileSize : null,
      objectKey: objectKey || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection('messages').add(messageData);
    const senderSnap = await db.collection('users').doc(senderId).get();
    const senderName = senderSnap.exists ? senderSnap.data().name : 'Unknown';

    const populated = {
      _id: docRef.id,
      ...messageData,
      senderId: { _id: senderId, name: senderName },
      groupId,
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`group:${groupId}`).emit('group_message', populated);
    }

    // Push notifications (Web Push + Native FCM)
    const membersToNotify = group.members.filter((m) => m !== senderId);
    if (membersToNotify.length > 0) {
      const userSnaps = await Promise.all(membersToNotify.map((uid) => db.collection('users').doc(uid).get()));
      
      // 1. Web Push
      const pushPayload = {
        title: `New message in ${group.name}`,
        body: `${senderName}: ${(text || '').substring(0, 80)}`,
        icon: '/favicon.ico',
        url: '/social',
      };
      userSnaps.forEach((snap) => {
        if (snap.exists && snap.data().pushSubscriptions?.length > 0) {
          sendWebPush(snap.data().pushSubscriptions, pushPayload).catch(() => {});
        }
      });

      // 2. Native FCM Push
      const fcmTokens = [];
      userSnaps.forEach((snap) => {
        if (snap.exists && snap.data().fcmTokens) {
          fcmTokens.push(...snap.data().fcmTokens);
        }
      });
      if (fcmTokens.length > 0) {
        sendFCMPush(fcmTokens, {
          title: `Group: ${group.name}`,
          body: `${senderName}: ${fileUrl ? (fileName || 'Sent a file') : (text || '').substring(0, 80)}`,
          data: { type: 'group', id: groupId },
        }).catch(() => {});
      }
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get message history for a group (last 200, paginated)
 * @route   GET /api/social/groups/:id/messages
 * @access  Private
 *
 * FIX (PERF-3): Uses .orderBy('createdAt', 'desc').limit(200) on the Firestore
 * query instead of fetching ALL messages and slicing in memory. This prevents
 * full-table scans on large groups.
 */
const getGroupMessages = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const userId = req.user._id;

    const groupSnap = await db.collection('groups').doc(groupId).get();
    if (!groupSnap.exists) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    const group = groupSnap.data();

    if (!group.members.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    // FIX (PERF-3): Query with orderBy + limit to avoid full-table scan
    const messagesSnap = await db.collection('messages')
      .where('groupId', '==', groupId)
      .orderBy('createdAt', 'desc')
      .limit(MAX_GROUP_HISTORY)
      .get();

    const messages = formatDocs(messagesSnap).reverse(); // Reverse to get chronological order

    // Batch-fetch sender profiles
    const senderIds = [...new Set(messages.map((m) => m.senderId))];
    const senderProfiles = {};
    if (senderIds.length > 0) {
      const userSnaps = await Promise.all(senderIds.map((uid) => db.collection('users').doc(uid).get()));
      userSnaps.forEach((snap) => {
        if (snap.exists) senderProfiles[snap.id] = snap.data();
      });
    }

    const populatedMessages = messages.map((m) => ({
      ...m,
      senderId: { _id: m.senderId, name: senderProfiles[m.senderId]?.name || 'Unknown' },
    }));

    res.status(200).json({ success: true, data: populatedMessages });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a member to a group
 * @route   POST /api/social/groups/:id/members
 * @access  Private
 *
 * FIX (SEC-9): Only the group CREATOR can add new members.
 * Previously, any group member could add others, creating an authorization gap.
 */
const addGroupMember = async (req, res, next) => {
  try {
    const { memberId } = req.body;
    const groupId = req.params.id;
    const userId = req.user._id;

    if (!memberId) {
      return res.status(400).json({ success: false, message: 'memberId is required' });
    }

    const groupRef = db.collection('groups').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupSnap.data();

    // FIX (SEC-9): Only the creator can add members
    if (group.creator !== userId) {
      return res.status(403).json({ success: false, message: 'Only the group creator can add members' });
    }

    if (group.members.includes(memberId)) {
      return res.status(400).json({ success: false, message: 'User is already a member of this group' });
    }

    // Use FieldValue.arrayUnion for atomic add (prevents race conditions)
    await groupRef.update({
      members: admin.firestore.FieldValue.arrayUnion(memberId),
      updatedAt: new Date(),
    });

    const updatedSnap = await groupRef.get();
    const updatedGroup = updatedSnap.data();

    const userSnaps = await Promise.all(updatedGroup.members.map((uid) => db.collection('users').doc(uid).get()));
    const memberProfiles = [];
    let creatorName = 'Unknown';
    userSnaps.forEach((snap) => {
      if (snap.exists) {
        const data = snap.data();
        memberProfiles.push({ _id: snap.id, name: data.name, xp: data.xp || 0, level: data.level || 1 });
        if (snap.id === group.creator) creatorName = data.name;
      }
    });

    const populated = {
      _id: groupRef.id,
      ...updatedGroup,
      members: memberProfiles,
      creator: { _id: group.creator, name: creatorName },
    };

    const io = req.app.get('io');
    if (io) {
      const sockets = io.sockets.adapter.rooms.get(memberId);
      if (sockets) {
        sockets.forEach((socketId) => io.sockets.sockets.get(socketId)?.join(`group:${groupId}`));
      }
      io.to(memberId).emit('group_created', populated);
      io.to(`group:${groupId}`).emit('group_member_added', { groupId, group: populated, addedMemberId: memberId });
    }

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getMessages,
  markMessagesSeen,
  createGroup,
  getGroups,
  sendGroupMessage,
  getGroupMessages,
  addGroupMember,
};
