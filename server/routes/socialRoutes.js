const express = require('express');
const router = express.Router();
const {
  getLeaderboard,
  sendFriendRequest,
  respondFriendRequest,
  getFriends,
  sendMessage,
  getMessages,
} = require('../controllers/socialController');
const { protect } = require('../middlewares/auth');

router.use(protect);

// Leaderboard
router.get('/leaderboard', getLeaderboard);

// Friends
router.get('/friends', getFriends);
router.post('/friends/request', sendFriendRequest);
router.patch('/friends/:id', respondFriendRequest);

// Chat
router.post('/messages', sendMessage);
router.get('/messages/:userId', getMessages);

module.exports = router;
