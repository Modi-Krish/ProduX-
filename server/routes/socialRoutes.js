const express = require('express');
const router = express.Router();

const {
  getLeaderboard,
  sendFriendRequest,
  respondFriendRequest,
  getFriends,
  findUserByCustomId,
  getUnreadCount,
  getConversations,
} = require('../controllers/socialController');

const {
  sendMessage,
  getMessages,
  markMessagesSeen,
  createGroup,
  getGroups,
  sendGroupMessage,
  getGroupMessages,
  addGroupMember,
} = require('../controllers/messageController');

const {
  subscribePush,
  registerFCMToken,
  triggerFCMPush,
} = require('../controllers/pushController');

const { protect } = require('../middlewares/auth');
const {
  socialLimiter,
  friendRequestLimiter,
} = require('../middlewares/rateLimiter');

// All social routes require authentication
router.use(protect);

// ── Leaderboard ───────────────────────────────────────────
router.get('/leaderboard', getLeaderboard);

// ── Friends ───────────────────────────────────────────────
router.get('/friends', getFriends);
router.post('/friends/request', friendRequestLimiter, sendFriendRequest);
router.patch('/friends/:id', respondFriendRequest);

// ── Unread counts ─────────────────────────────────────────
router.get('/unread', getUnreadCount);

// ── Conversations (DM inbox) ──────────────────────────────
router.get('/conversations', getConversations);

// ── DM Chat ───────────────────────────────────────────────
router.post('/messages', socialLimiter, sendMessage);
router.post('/messages/seen', markMessagesSeen);
router.get('/messages/:userId', getMessages);

// ── Group Chat ────────────────────────────────────────────
router.post('/groups', createGroup);
router.get('/groups', getGroups);
router.post('/groups/:id/messages', socialLimiter, sendGroupMessage);
router.get('/groups/:id/messages', getGroupMessages);
router.post('/groups/:id/members', addGroupMember);

// ── User Search ───────────────────────────────────────────
router.get('/users/:customId', findUserByCustomId);

// ── Native FCM Push ───────────────────────────────────────
router.post('/fcm/token', registerFCMToken);
router.post('/push-notify', triggerFCMPush);

// ── Web Push Subscribe ────────────────────────────────────
router.post('/subscribe', subscribePush);

module.exports = router;
