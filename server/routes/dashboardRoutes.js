const express = require('express');
const router = express.Router();
const { getDashboardSummary } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/auth');

router.get('/summary', protect, getDashboardSummary);

module.exports = router;
