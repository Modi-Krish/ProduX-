const { db, admin, isFCMEnabled, formatDoc, formatDocs } = require('../config/firebase');
const webpush = require('web-push');
const socialService = require('../services/socialService');

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.PUBLIC_VAPID_KEY,
  process.env.PRIVATE_VAPID_KEY
);

/**
 * @desc    Get global leaderboard
 * @route   GET /api/social/leaderboard
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
 */
const sendFriendRequest = async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user._id;

    if (requesterId === recipientId) {
      return res.status(400).json({ success: false, message: "You can't friend yourself" });
    }

    // Check if friendship already exists in either direction
    const snap1 = await db.collection('friendships')
      .where('requester', '==', requesterId)
      .where('recipient', '==', recipientId)
      .get();
    const snap2 = await db.collection('friendships')
      .where('requester', '==', recipientId)
      .where('recipient', '==', requesterId)
      .get();

    if (!snap1.empty || !snap2.empty) {
      return res.status(400).json({ success: false, message: 'Friend request already exists' });
    }

    const friendshipData = {
      requester: requesterId,
      recipient: recipientId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
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

    res.status(201).json({ success: true, data: friendship });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept/reject a friend request
 * @route   PATCH /api/social/friends/:id
 */
const respondFriendRequest = async (req, res, next) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'
    const friendshipRef = db.collection('friendships').doc(req.params.id);
    const friendshipSnap = await friendshipRef.get();

    if (!friendshipSnap.exists) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const friendship = friendshipSnap.data();

    if (friendship.recipient !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await friendshipRef.update({
      status,
      updatedAt: new Date()
    });

    const updatedFriendship = {
      _id: friendshipRef.id,
      ...friendship,
      status
    };

    // Notify requester
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
 * @desc    Get friend list + pending requests
 * @route   GET /api/social/friends
 */
const getFriends = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Accepted friends
    const snap1 = await db.collection('friendships')
      .where('requester', '==', userId)
      .where('status', '==', 'accepted')
      .get();
    const snap2 = await db.collection('friendships')
      .where('recipient', '==', userId)
      .where('status', '==', 'accepted')
      .get();

    const friendships = [...formatDocs(snap1), ...formatDocs(snap2)];

    // Pending requests for me
    const pendingSnap = await db.collection('friendships')
      .where('recipient', '==', userId)
      .where('status', '==', 'pending')
      .get();

    const pendingRequests = formatDocs(pendingSnap);

    // Get all unique user IDs involved to batch fetch details
    const userIds = new Set();
    friendships.forEach((f) => {
      userIds.add(f.requester);
      userIds.add(f.recipient);
    });
    pendingRequests.forEach((r) => {
      userIds.add(r.requester);
    });

    const userProfiles = {};
    if (userIds.size > 0) {
      const userSnaps = await Promise.all(
        Array.from(userIds).map((uid) => db.collection('users').doc(uid).get())
      );
      userSnaps.forEach((snap) => {
        if (snap.exists) {
          userProfiles[snap.id] = { _id: snap.id, ...snap.data() };
        }
      });
    }

    const friends = friendships.map((f) => {
      const friendId = f.requester === userId ? f.recipient : f.requester;
      const friend = userProfiles[friendId] || { name: 'Unknown', xp: 0, level: 1, streak: 0 };
      return {
        friendshipId: f._id,
        _id: friendId,
        name: friend.name,
        xp: friend.xp || 0,
        level: friend.level || 1,
        streak: friend.streak || 0,
      };
    });

    const pending = pendingRequests.map((r) => {
      const requester = userProfiles[r.requester] || { name: 'Unknown', xp: 0, level: 1 };
      return {
        friendshipId: r._id,
        _id: r.requester,
        name: requester.name,
        xp: requester.xp || 0,
        level: requester.level || 1,
      };
    });

    res.status(200).json({ success: true, data: { friends, pending } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send a chat message (DM)
 * @route   POST /api/social/messages
 */
const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, text, fileUrl, fileType, fileName, fileSize } = req.body;
    const senderId = req.user._id;

    const messageData = {
      senderId,
      receiverId,
      text: text || '',
      groupId: null,
      read: false,
      status: 'sent',
      seenAt: null,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('messages').add(messageData);

    const [senderSnap, receiverSnap] = await Promise.all([
      db.collection('users').doc(senderId).get(),
      db.collection('users').doc(receiverId).get()
    ]);
    const senderName = senderSnap.exists ? senderSnap.data().name : 'Unknown';
    const receiverName = receiverSnap.exists ? receiverSnap.data().name : 'Unknown';

    const populated = {
      _id: docRef.id,
      id: docRef.id,
      ...messageData,
      senderId: { _id: senderId, name: senderName },
      receiverId: { _id: receiverId, name: receiverName }
    };

    // Real-time delivery
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId).emit('new_message', populated);
      io.to(senderId).emit('new_message', populated);
    }

    // Send Web Push Notification to receiver
    if (receiverSnap.exists) {
      const receiver = receiverSnap.data();
      const pushBody = fileUrl ? (fileName || 'Sent a file') : (text || '').substring(0, 50);
      if (receiver.pushSubscriptions && receiver.pushSubscriptions.length > 0) {
        const payload = JSON.stringify({
          title: `New message from ${senderName}`,
          body: pushBody,
          icon: '/favicon.ico',
          url: '/social'
        });
        
        const sendPromises = receiver.pushSubscriptions.map(sub => 
          webpush.sendNotification(sub, payload).catch(err => {
            if (err.statusCode === 404 || err.statusCode === 410) {
              console.log('Subscription has expired or is no longer valid');
            } else {
              console.error('Error sending push notification:', err);
            }
          })
        );
        await Promise.all(sendPromises);
      }
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get chat history with a specific user
 * @route   GET /api/social/messages/:userId
 */
const getMessages = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const otherId = req.params.userId;

    const snap1 = await db.collection('messages')
      .where('groupId', '==', null)
      .where('senderId', '==', userId)
      .where('receiverId', '==', otherId)
      .get();
    const snap2 = await db.collection('messages')
      .where('groupId', '==', null)
      .where('senderId', '==', otherId)
      .where('receiverId', '==', userId)
      .get();

    const rawMessages = [...formatDocs(snap1), ...formatDocs(snap2)];
    rawMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const sliced = rawMessages.slice(0, 100);

    const [senderSnap, receiverSnap] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('users').doc(otherId).get()
    ]);
    const userName = senderSnap.exists ? senderSnap.data().name : 'Unknown';
    const otherName = receiverSnap.exists ? receiverSnap.data().name : 'Unknown';

    const messages = sliced.map(m => ({
      ...m,
      senderId: m.senderId === userId ? { _id: userId, name: userName } : { _id: otherId, name: otherName },
      receiverId: m.receiverId === userId ? { _id: userId, name: userName } : { _id: otherId, name: otherName }
    }));

    // Mark as read + seen
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
      unreadSnap.forEach(doc => {
        batch.update(doc.ref, { read: true, status: 'seen', seenAt, updatedAt: new Date() });
        seenMsgIds.push(doc.id);
      });
      await batch.commit();

      // Notify sender that their messages were seen
      const io = req.app.get('io');
      if (io && seenMsgIds.length > 0) {
        io.to(otherId).emit('messages_seen', {
          byUserId: userId,
          messageIds: seenMsgIds,
          seenAt: seenAt.toISOString(),
        });
      }
    }

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

// ─── GROUP CHAT ─────────────────────────────────────────

/**
 * @desc    Create a group
 * @route   POST /api/social/groups
 */
const createGroup = async (req, res, next) => {
  try {
    const { name, memberIds } = req.body;
    const creatorId = req.user._id;

    if (!name || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Group name and at least one member required' });
    }

    // Always include the creator as a member
    const allMembers = [...new Set([creatorId, ...memberIds])];

    const groupData = {
      name,
      members: allMembers,
      creator: creatorId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('groups').add(groupData);

    const userSnaps = await Promise.all(
      allMembers.map(uid => db.collection('users').doc(uid).get())
    );
    const memberProfiles = [];
    let creatorName = 'Unknown';
    userSnaps.forEach(snap => {
      if (snap.exists) {
        const data = snap.data();
        memberProfiles.push({ _id: snap.id, name: data.name, xp: data.xp || 0, level: data.level || 1 });
        if (snap.id === creatorId) {
          creatorName = data.name;
        }
      }
    });

    const populated = {
      _id: docRef.id,
      id: docRef.id,
      ...groupData,
      members: memberProfiles,
      creator: { _id: creatorId, name: creatorName }
    };

    // Join all members to the socket room
    const io = req.app.get('io');
    if (io) {
      allMembers.forEach((memberId) => {
        const sockets = io.sockets.adapter.rooms.get(memberId);
        if (sockets) {
          sockets.forEach((socketId) => {
            io.sockets.sockets.get(socketId)?.join(`group:${docRef.id}`);
          });
        }
      });

      // Notify members
      allMembers.forEach((memberId) => {
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
 * @desc    Get all groups user belongs to
 * @route   GET /api/social/groups
 */
const getGroups = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const groupsSnap = await db.collection('groups')
      .where('members', 'array-contains', userId)
      .get();
    
    const groups = formatDocs(groupsSnap);
    groups.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Collect all unique user IDs across all these groups
    const allMemberIds = new Set();
    groups.forEach(g => {
      g.members.forEach(m => allMemberIds.add(m));
      allMemberIds.add(g.creator);
    });

    const userProfiles = {};
    if (allMemberIds.size > 0) {
      const userSnaps = await Promise.all(
        Array.from(allMemberIds).map(uid => db.collection('users').doc(uid).get())
      );
      userSnaps.forEach(snap => {
        if (snap.exists) {
          userProfiles[snap.id] = { _id: snap.id, ...snap.data() };
        }
      });
    }

    const populatedGroups = groups.map(g => {
      const groupMembers = g.members.map(m => {
        const p = userProfiles[m] || { name: 'Unknown', xp: 0, level: 1 };
        return { _id: m, name: p.name, xp: p.xp || 0, level: p.level || 1 };
      });
      const creatorProfile = userProfiles[g.creator] || { name: 'Unknown' };
      return {
        ...g,
        members: groupMembers,
        creator: { _id: g.creator, name: creatorProfile.name }
      };
    });

    res.status(200).json({ success: true, data: populatedGroups });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send a message to a group
 * @route   POST /api/social/groups/:id/messages
 */
const sendGroupMessage = async (req, res, next) => {
  try {
    const { text, fileUrl, fileType, fileName, fileSize } = req.body;
    const groupId = req.params.id;
    const senderId = req.user._id;

    // Verify user is a member
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
      groupId,
      text: text || '',
      status: 'sent',
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('messages').add(messageData);

    const senderSnap = await db.collection('users').doc(senderId).get();
    const senderName = senderSnap.exists ? senderSnap.data().name : 'Unknown';

    const populated = {
      _id: docRef.id,
      id: docRef.id,
      ...messageData,
      senderId: { _id: senderId, name: senderName }
    };

    // Real-time delivery to group room
    const io = req.app.get('io');
    if (io) {
      io.to(`group:${groupId}`).emit('group_message', {
        ...populated,
        groupId,
      });
    }

    // Send Web Push Notification to all group members (except sender)
    const membersToNotify = group.members.filter(m => m !== senderId);
    if (membersToNotify.length > 0) {
      const userSnaps = await Promise.all(
        membersToNotify.map(uid => db.collection('users').doc(uid).get())
      );
      
      const payload = JSON.stringify({
        title: `New message in ${group.name}`,
        body: `${senderName}: ${text.substring(0, 50)}`,
        icon: '/favicon.ico',
        url: '/social'
      });

      const sendPromises = [];
      userSnaps.forEach(memberSnap => {
        if (memberSnap.exists) {
          const memberUser = memberSnap.data();
          if (memberUser.pushSubscriptions && memberUser.pushSubscriptions.length > 0) {
            memberUser.pushSubscriptions.forEach(sub => {
              sendPromises.push(
                webpush.sendNotification(sub, payload).catch(err => {
                  if (err.statusCode !== 404 && err.statusCode !== 410) {
                    console.error('Error sending push notification:', err);
                  }
                })
              );
            });
          }
        }
      });
      await Promise.all(sendPromises);
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get message history for a group
 * @route   GET /api/social/groups/:id/messages
 */
const getGroupMessages = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const userId = req.user._id;

    // Verify membership
    const groupSnap = await db.collection('groups').doc(groupId).get();
    if (!groupSnap.exists) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    const group = groupSnap.data();
    if (!group.members.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    const messagesSnap = await db.collection('messages')
      .where('groupId', '==', groupId)
      .get();
    
    const messages = formatDocs(messagesSnap);
    messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const sliced = messages.slice(-200);

    const senderIds = [...new Set(sliced.map(m => m.senderId))];
    const senderProfiles = {};
    if (senderIds.length > 0) {
      const userSnaps = await Promise.all(
        senderIds.map(uid => db.collection('users').doc(uid).get())
      );
      userSnaps.forEach(snap => {
        if (snap.exists) {
          senderProfiles[snap.id] = snap.data();
        }
      });
    }

    const populatedMessages = sliced.map(m => ({
      ...m,
      senderId: {
        _id: m.senderId,
        name: senderProfiles[m.senderId]?.name || 'Unknown'
      }
    }));

    res.status(200).json({ success: true, data: populatedMessages });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a member to an existing group
 * @route   POST /api/social/groups/:id/members
 */
const addGroupMember = async (req, res, next) => {
  try {
    const { memberId } = req.body;
    const groupId = req.params.id;
    const userId = req.user._id;

    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Member ID is required' });
    }

    const groupRef = db.collection('groups').doc(groupId);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupSnap.data();

    // Verify requesting user is a member
    if (!group.members.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to add members to this group' });
    }

    // Verify member is not already in the group
    if (group.members.includes(memberId)) {
      return res.status(400).json({ success: false, message: 'User is already a member of this group' });
    }

    // Add member
    group.members.push(memberId);
    await groupRef.update({
      members: group.members,
      updatedAt: new Date()
    });

    const userSnaps = await Promise.all(
      group.members.map(uid => db.collection('users').doc(uid).get())
    );
    const memberProfiles = [];
    let creatorName = 'Unknown';
    userSnaps.forEach(snap => {
      if (snap.exists) {
        const data = snap.data();
        memberProfiles.push({ _id: snap.id, name: data.name, xp: data.xp || 0, level: data.level || 1 });
        if (snap.id === group.creator) {
          creatorName = data.name;
        }
      }
    });

    const populated = {
      _id: groupRef.id,
      id: groupRef.id,
      ...group,
      members: memberProfiles,
      creator: { _id: group.creator, name: creatorName }
    };

    // Socket: Join the new member's active sockets to the room and notify
    const io = req.app.get('io');
    if (io) {
      const sockets = io.sockets.adapter.rooms.get(memberId);
      if (sockets) {
        sockets.forEach((socketId) => {
          io.sockets.sockets.get(socketId)?.join(`group:${groupId}`);
        });
      }
      
      // Notify the added member of the new group in real-time
      io.to(memberId).emit('group_created', populated);
      
      // Notify existing group members of the new addition
      io.to(`group:${groupId}`).emit('group_member_added', {
        groupId,
        group: populated,
        addedMemberId: memberId,
      });
    }

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Find a user by unique customId
 * @route   GET /api/social/users/:customId
 */
const findUserByCustomId = async (req, res, next) => {
  try {
    const customId = req.params.customId.trim().toUpperCase();
    const currentUserId = req.user._id;

    const usersSnap = await db.collection('users')
      .where('customId', '==', customId)
      .limit(1)
      .get();
    
    if (usersSnap.empty) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userDoc = usersSnap.docs[0];
    const user = { _id: userDoc.id, ...userDoc.data() };

    // Check relationship status to send with response
    const snap1 = await db.collection('friendships')
      .where('requester', '==', currentUserId)
      .where('recipient', '==', user._id)
      .get();
    const snap2 = await db.collection('friendships')
      .where('requester', '==', user._id)
      .where('recipient', '==', currentUserId)
      .get();

    const friendshipDoc = !snap1.empty ? snap1.docs[0] : (!snap2.empty ? snap2.docs[0] : null);

    let relationship = 'none'; // 'none', 'pending_sent', 'pending_received', 'friends'
    let friendshipId = null;
    if (friendshipDoc) {
      const friendship = friendshipDoc.data();
      friendshipId = friendshipDoc.id;
      if (friendship.status === 'accepted') {
        relationship = 'friends';
      } else if (friendship.status === 'pending') {
        if (friendship.requester === currentUserId) {
          relationship = 'pending_sent';
        } else {
          relationship = 'pending_received';
        }
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
 * @desc    Subscribe to Web Push Notifications
 * @route   POST /api/social/subscribe
 */
const subscribePush = async (req, res, next) => {
  try {
    const subscription = req.body;
    const userId = req.user._id;

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userSnap.data();
    const pushSubscriptions = user.pushSubscriptions || [];

    const exists = pushSubscriptions.some(
      (sub) => sub.endpoint === subscription.endpoint
    );

    if (!exists) {
      pushSubscriptions.push(subscription);
      await userRef.update({ pushSubscriptions, updatedAt: new Date() });
    }

    res.status(201).json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unread counts for background polling
 * @route   GET /api/social/unread
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Count pending friend requests
    const pendingFriendsSnap = await db.collection('friendships')
      .where('recipient', '==', userId)
      .where('status', '==', 'pending')
      .get();
    const pendingFriendsCount = pendingFriendsSnap.size;

    // 2. Count unread messages
    const unreadMessagesSnap = await db.collection('messages')
      .where('groupId', '==', null)
      .where('receiverId', '==', userId)
      .where('read', '==', false)
      .get();
    const unreadMessagesCount = unreadMessagesSnap.size;

    res.status(200).json({
      success: true,
      data: {
        pendingFriendsCount,
        unreadMessagesCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register FCM Token
 * @route   POST /api/social/fcm/token
 */
const registerFCMToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user._id;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'FCM Token is required' });
    }

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userSnap.data();
    const fcmTokens = user.fcmTokens || [];

    if (!fcmTokens.includes(fcmToken)) {
      fcmTokens.push(fcmToken);
      await userRef.update({ fcmTokens, updatedAt: new Date() });
    }

    res.status(200).json({ success: true, message: 'FCM Token registered successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Trigger FCM Push Notification
 * @route   POST /api/social/push-notify
 */
const triggerFCMPush = async (req, res, next) => {
  try {
    const { receiverId, groupId, text } = req.body;
    const senderId = req.user._id;
    const senderName = req.user.name;

    if (!isFCMEnabled) {
      return res.status(200).json({ 
        success: true, 
        message: 'FCM is not enabled on this server (no service account). Push skipped.' 
      });
    }

    let tokens = [];
    let title = '';
    let body = '';
    let group = null;

    if (groupId) {
      // Group message push
      const groupSnap = await db.collection('groups').doc(groupId).get();
      if (!groupSnap.exists) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      group = groupSnap.data();

      // Check if sender is a member
      if (!group.members.includes(senderId)) {
        return res.status(403).json({ success: false, message: 'Not a member of this group' });
      }

      title = `Group: ${group.name}`;
      body = `${senderName}: ${text}`;

      // Collect tokens of other group members
      const memberSnaps = await Promise.all(
        group.members.map(uid => db.collection('users').doc(uid).get())
      );
      memberSnaps.forEach(snap => {
        if (snap.exists && snap.id !== senderId) {
          const data = snap.data();
          if (data.fcmTokens) {
            tokens.push(...data.fcmTokens);
          }
        }
      });
    } else if (receiverId) {
      // Direct message push
      const receiverSnap = await db.collection('users').doc(receiverId).get();
      if (!receiverSnap.exists) {
        return res.status(404).json({ success: false, message: 'Recipient user not found' });
      }
      const receiver = receiverSnap.data();

      title = senderName;
      body = text;

      if (receiver.fcmTokens) {
        tokens = receiver.fcmTokens;
      }
    } else {
      return res.status(400).json({ success: false, message: 'Either receiverId or groupId must be provided' });
    }

    // Filter out empty/null tokens
    tokens = [...new Set(tokens.filter(t => typeof t === 'string' && t.trim() !== ''))];

    if (tokens.length === 0) {
      return res.status(200).json({ success: true, message: 'No registered FCM tokens found for recipients.' });
    }

    // Prepare FCM multicast message
    const message = {
      tokens: tokens,
      notification: {
        title: title,
        body: body.length > 100 ? body.substring(0, 97) + '...' : body,
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        type: groupId ? 'group' : 'dm',
        id: groupId || senderId,
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'capacitor://localhost/social',
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          }
        }
      }
    };

    // Send using firebase-admin
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`📡 Multicast FCM push sent: ${response.successCount} success, ${response.failureCount} failure`);

    // Clean up expired/failed tokens
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            tokensToRemove.push(tokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        console.log(`🧹 Removing ${tokensToRemove.length} expired FCM tokens from Firestore...`);
        const recipientsToClean = groupId ? group.members : [receiverId];
        for (const uid of recipientsToClean) {
          const uRef = db.collection('users').doc(uid);
          const uSnap = await uRef.get();
          if (uSnap.exists) {
            const uData = uSnap.data();
            if (uData.fcmTokens) {
              const updatedTokens = uData.fcmTokens.filter(t => !tokensToRemove.includes(t));
              if (updatedTokens.length !== uData.fcmTokens.length) {
                await uRef.update({ fcmTokens: updatedTokens, updatedAt: new Date() });
              }
            }
          }
        }
      }
    }

    res.status(200).json({ success: true, successCount: response.successCount });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all DM conversations with latest message + unread count
 * @route   GET /api/social/conversations
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const snap1 = await db.collection('messages')
      .where('groupId', '==', null)
      .where('senderId', '==', userId)
      .get();
    const snap2 = await db.collection('messages')
      .where('groupId', '==', null)
      .where('receiverId', '==', userId)
      .get();

    const allDMs = [...formatDocs(snap1), ...formatDocs(snap2)];
    allDMs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const conversationMap = {};
    allDMs.forEach(msg => {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversationMap[partnerId]) {
        conversationMap[partnerId] = {
          partnerId,
          lastMessage: msg.text,
          lastMessageAt: msg.createdAt,
          lastSenderId: msg.senderId,
          unreadCount: 0
        };
      }
      if (msg.receiverId === userId && !msg.read) {
        conversationMap[partnerId].unreadCount += 1;
      }
    });

    const partnerIds = Object.keys(conversationMap);
    const conversations = [];

    if (partnerIds.length > 0) {
      const partnerSnaps = await Promise.all(
        partnerIds.map(pid => db.collection('users').doc(pid).get())
      );
      partnerSnaps.forEach(snap => {
        if (snap.exists) {
          const data = snap.data();
          const conv = conversationMap[snap.id];
          conversations.push({
            _id: snap.id,
            partnerId: snap.id,
            partnerName: data.name,
            partnerLevel: data.level || 1,
            partnerXp: data.xp || 0,
            lastMessage: conv.lastMessage,
            lastMessageAt: conv.lastMessageAt,
            lastSenderId: conv.lastSenderId,
            unreadCount: conv.unreadCount
          });
        }
      });
    }

    conversations.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark messages as seen (for Firestore real-time mode)
 * @route   POST /api/social/messages/seen
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
      unreadSnap.forEach(doc => {
        batch.update(doc.ref, { read: true, status: 'seen', seenAt, updatedAt: new Date() });
        seenMsgIds.push(doc.id);
      });
      await batch.commit();

      // Notify sender via socket
      const io = req.app.get('io');
      if (io && seenMsgIds.length > 0) {
        io.to(senderId).emit('messages_seen', {
          byUserId: userId,
          messageIds: seenMsgIds,
          seenAt: seenAt.toISOString(),
        });
      }
    }

    res.status(200).json({ success: true, data: { markedCount: seenMsgIds.length } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeaderboard,
  sendFriendRequest,
  respondFriendRequest,
  getFriends,
  sendMessage,
  getMessages,
  createGroup,
  getGroups,
  sendGroupMessage,
  getGroupMessages,
  addGroupMember,
  findUserByCustomId,
  subscribePush,
  getUnreadCount,
  getConversations,
  registerFCMToken,
  triggerFCMPush,
  markMessagesSeen,
};
