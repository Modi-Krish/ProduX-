const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

// Public routes
router.post('/register', validate(['name', 'email', 'password']), register);
router.post('/login', validate(['email', 'password']), login);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;
