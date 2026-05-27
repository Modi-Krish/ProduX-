const express = require('express');
const router = express.Router();
const {
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
  getUnreadCount,
  getConversations,
  registerFCMToken,
  triggerFCMPush,
  markMessagesSeen,
} = require('../controllers/socialController');
const { protect } = require('../middlewares/auth');

router.use(protect);

// Leaderboard
router.get('/leaderboard', getLeaderboard);

// Friends
router.get('/friends', getFriends);
router.post('/friends/request', sendFriendRequest);
router.patch('/friends/:id', respondFriendRequest);
router.get('/unread', getUnreadCount);

// Conversations (DM list with unread counts)
router.get('/conversations', getConversations);

// DM Chat
router.post('/messages', sendMessage);
router.post('/messages/seen', markMessagesSeen);
router.get('/messages/:userId', getMessages);

// Group Chat
router.post('/groups', createGroup);
router.get('/groups', getGroups);
router.post('/groups/:id/messages', sendGroupMessage);
router.get('/groups/:id/messages', getGroupMessages);
router.post('/groups/:id/members', addGroupMember);

// Find user by customId
router.get('/users/:customId', findUserByCustomId);

// Native FCM Push Token & Notifications
router.post('/fcm/token', registerFCMToken);
router.post('/push-notify', triggerFCMPush);

// Web Push Subscribe
const { subscribePush } = require('../controllers/socialController');
router.post('/subscribe', subscribePush);

module.exports = router;
