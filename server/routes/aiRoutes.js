const express = require('express');
const router = express.Router();
const { generateSubtasks, generateFocusWarning } = require('../controllers/aiController');
const { protect } = require('../middlewares/auth');
const { aiLimiter } = require('../middlewares/rateLimiter');

// FIX (EXT-1 / SEC-16): Both AI routes now require Firebase Auth token.
// The Chrome extension MUST include a valid Authorization: Bearer <token> header.
// This prevents unauthenticated Gemini API calls that could exhaust quota.

router.use(protect);
router.use(aiLimiter); // Strict rate limiting — 20 requests per 10 minutes

router.post('/breakdown', generateSubtasks);
router.post('/coach', generateFocusWarning);

module.exports = router;
