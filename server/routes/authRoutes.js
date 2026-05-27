const express = require('express');
const router = express.Router();
const { register, login, getMe, googleLogin, deleteAccount } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

// Public routes
router.post('/google', googleLogin);

// Protected routes (secured via Firebase ID Token verification)
router.post('/register', protect, validate(['name']), register);
router.post('/login', protect, login);
router.get('/me', protect, getMe);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;
