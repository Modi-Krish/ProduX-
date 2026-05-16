const express = require('express');
const router = express.Router();
const { getGamificationStats } = require('../controllers/gamificationController');
const { protect } = require('../middlewares/auth');

router.get('/stats', protect, getGamificationStats);

module.exports = router;
