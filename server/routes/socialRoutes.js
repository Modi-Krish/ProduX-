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
} = require('../controllers/socialController');
const { protect } = require('../middlewares/auth');

router.use(protect);

// Leaderboard
router.get('/leaderboard', getLeaderboard);

// Friends
router.get('/friends', getFriends);
router.post('/friends/request', sendFriendRequest);
router.patch('/friends/:id', respondFriendRequest);

// DM Chat
router.post('/messages', sendMessage);
router.get('/messages/:userId', getMessages);

// Group Chat
router.post('/groups', createGroup);
router.get('/groups', getGroups);
router.post('/groups/:id/messages', sendGroupMessage);
router.get('/groups/:id/messages', getGroupMessages);
router.post('/groups/:id/members', addGroupMember);

module.exports = router;
