const { getStats } = require('../services/gamificationService');

/**
 * @desc    Get gamification stats for current user
 * @route   GET /api/gamification/stats
 * @access  Private
 */
const getGamificationStats = async (req, res, next) => {
  try {
    const stats = await getStats(req.user._id);
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getGamificationStats };
