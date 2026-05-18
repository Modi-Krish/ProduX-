// server/routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const { generateSubtasks, generateFocusWarning } = require('../controllers/aiController');
const { protect } = require('../middlewares/auth');

// Protected route for subtask breakdown (called by React web app)
router.post('/breakdown', protect, generateSubtasks);

// Public route for Chrome extension coaching warnings (easier for extension to query without login session)
router.post('/coach', generateFocusWarning);

module.exports = router;
