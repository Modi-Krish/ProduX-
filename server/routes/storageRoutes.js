const express = require('express');
const router = express.Router();
const { getPresignedUrl, removeObject } = require('../controllers/storageController');
const { protect } = require('../middlewares/auth');
const { globalLimiter } = require('../middlewares/rateLimiter');

// All storage routes are strictly protected
router.use(protect);
router.use(globalLimiter);

router.post('/presign', getPresignedUrl);
router.delete('/delete', removeObject);

module.exports = router;
