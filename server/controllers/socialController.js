const User = require('../models/User');
const Friendship = require('../models/Friendship');
const Message = require('../models/Message');
const Group = require('../models/Group');

/**
 * @desc    Get global leaderboard
 * @route   GET /api/social/leaderboard
 */
const getLeaderboard = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('name xp level streak totalTasksCompleted badges')
      .sort({ xp: -1 })
      .limit(50);

    const leaderboard = users.map((u, index) => ({
      _id: u._id,
      rank: index + 1,
      name: u.name,
      xp: u.xp,
      level: u.level,
      streak: u.streak,
      totalTasksCompleted: u.totalTasksCompleted,
      badgeCount: u.badges?.length || 0,
    }));

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

    if (requesterId.toString() === recipientId) {
      return res.status(400).json({ success: false, message: "You can't friend yourself" });
    }

    // Check if friendship already exists in either direction
    const existing = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Friend request already exists' });
    }

    const friendship = await Friendship.create({
      requester: requesterId,
      recipient: recipientId,
    });

    // Notify recipient via socket
    const io = req.app.get('io');
    if (io) {
      const requesterUser = await User.findById(requesterId).select('name');
      io.to(recipientId).emit('friend_request', {
        friendshipId: friendship._id,
        from: { _id: requesterId, name: requesterUser.name },
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
    const friendship = await Friendship.findById(req.params.id);

    if (!friendship) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (friendship.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    friendship.status = status;
    await friendship.save();

    // Notify requester
    const io = req.app.get('io');
    if (io && status === 'accepted') {
      const accepter = await User.findById(req.user._id).select('name');
      io.to(friendship.requester.toString()).emit('friend_accepted', {
        friendshipId: friendship._id,
        from: { _id: req.user._id, name: accepter.name },
      });
    }

    res.status(200).json({ success: true, data: friendship });
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
    const friendships = await Friendship.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted',
    })
      .populate('requester', 'name xp level streak')
      .populate('recipient', 'name xp level streak');

    const friends = friendships.map((f) => {
      const friend = f.requester._id.toString() === userId.toString() ? f.recipient : f.requester;
      return {
        friendshipId: f._id,
        _id: friend._id,
        name: friend.name,
        xp: friend.xp,
        level: friend.level,
        streak: friend.streak,
      };
    });

    // Pending requests for me
    const pendingRequests = await Friendship.find({
      recipient: userId,
      status: 'pending',
    }).populate('requester', 'name xp level');

    const pending = pendingRequests.map((r) => ({
      friendshipId: r._id,
      _id: r.requester._id,
      name: r.requester.name,
      xp: r.requester.xp,
      level: r.requester.level,
    }));

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
    const { receiverId, text } = req.body;
    const senderId = req.user._id;

    const message = await Message.create({ senderId, receiverId, text });

    const populated = await Message.findById(message._id)
      .populate('senderId', 'name')
      .populate('receiverId', 'name');

    // Real-time delivery
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId).emit('new_message', populated);
      io.to(senderId.toString()).emit('new_message', populated);
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

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId },
      ],
      groupId: null,
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('senderId', 'name')
      .populate('receiverId', 'name');

    // Mark as read
    await Message.updateMany(
      { senderId: otherId, receiverId: userId, read: false },
      { read: true }
    );

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
    const allMembers = [...new Set([creatorId.toString(), ...memberIds])];

    const group = await Group.create({
      name,
      members: allMembers,
      creator: creatorId,
    });

    const populated = await Group.findById(group._id)
      .populate('members', 'name xp level')
      .populate('creator', 'name');

    // Join all members to the socket room
    const io = req.app.get('io');
    if (io) {
      allMembers.forEach((memberId) => {
        const sockets = io.sockets.adapter.rooms.get(memberId);
        if (sockets) {
          sockets.forEach((socketId) => {
            io.sockets.sockets.get(socketId)?.join(`group:${group._id}`);
          });
        }
      });

      // Notify members
      allMembers.forEach((memberId) => {
        if (memberId !== creatorId.toString()) {
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

    const groups = await Group.find({ members: userId })
      .populate('members', 'name xp level')
      .populate('creator', 'name')
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, data: groups });
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
    const { text } = req.body;
    const groupId = req.params.id;
    const senderId = req.user._id;

    // Verify user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (!group.members.some((m) => m.toString() === senderId.toString())) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    const message = await Message.create({ senderId, groupId, text });

    const populated = await Message.findById(message._id)
      .populate('senderId', 'name');

    // Real-time delivery to group room
    const io = req.app.get('io');
    if (io) {
      io.to(`group:${groupId}`).emit('group_message', {
        ...populated.toObject(),
        groupId,
      });
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
    const group = await Group.findById(groupId);
    if (!group || !group.members.some((m) => m.toString() === userId.toString())) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    const messages = await Message.find({ groupId })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('senderId', 'name');

    res.status(200).json({ success: true, data: messages });
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

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Verify requesting user is a member
    if (!group.members.some((m) => m.toString() === userId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized to add members to this group' });
    }

    // Verify member is not already in the group
    if (group.members.some((m) => m.toString() === memberId.toString())) {
      return res.status(400).json({ success: false, message: 'User is already a member of this group' });
    }

    // Add member
    group.members.push(memberId);
    await group.save();

    const populated = await Group.findById(groupId)
      .populate('members', 'name xp level')
      .populate('creator', 'name');

    // Socket: Join the new member's active sockets to the room and notify
    const io = req.app.get('io');
    if (io) {
      const sockets = io.sockets.adapter.rooms.get(memberId.toString());
      if (sockets) {
        sockets.forEach((socketId) => {
          io.sockets.sockets.get(socketId)?.join(`group:${groupId}`);
        });
      }
      
      // Notify the added member of the new group in real-time
      io.to(memberId.toString()).emit('group_created', populated);
      
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
};
