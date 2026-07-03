const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  getVoiceHistory,
  saveVoiceHistory,
  getUploadUrl,
  updateSettings,
  getSettings,
} = require('../controllers/voiceController');

// All voice routes require authentication
router.use(protect);

// Voice History Routes
router.get('/history/:roomId', getVoiceHistory);
router.post('/history', saveVoiceHistory);

// Voice Audio Upload Route
router.get('/upload-url', getUploadUrl);

// Voice Settings Routes
router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

module.exports = router;
