const express = require('express');
const router = express.Router();
const { register, login, getMe, googleLogin, deleteAccount, updateProfile, updatePins, verifyPin } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { authLimiter } = require('../middlewares/rateLimiter');

// Deprecated — returns 410 Gone
router.post('/google', googleLogin);

// Protected routes (require valid Firebase ID Token in Authorization header)
router.post('/register', protect, authLimiter, validate(['name']), register);
router.post('/login', protect, authLimiter, login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/pins', protect, updatePins);
router.post('/verify-pin', protect, authLimiter, verifyPin);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;
