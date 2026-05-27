const { db, formatDocs } = require('../config/firebase');

/**
 * @desc    Get dashboard summary for current user
 * @route   GET /api/dashboard/summary
 * @access  Private
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all tasks for user from Firestore
    const tasksSnap = await db.collection('tasks').where('userId', '==', userId).get();
    const tasks = formatDocs(tasksSnap);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
    const pendingTasks = tasks.filter((t) => t.status === 'Pending').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'In Progress').length;

    // Tasks completed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const completedToday = tasks.filter(
      (t) => t.status === 'Completed' && new Date(t.updatedAt) >= todayStart
    ).length;

    // Overdue tasks
    const now = new Date();
    const overdueTasks = tasks.filter(
      (t) => t.status !== 'Completed' && t.deadline && new Date(t.deadline) < now
    ).length;

    // Category distribution
    const categoryMap = {};
    tasks.forEach((t) => {
      const cat = t.category || 'General';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    const categoryDistribution = Object.entries(categoryMap).map(
      ([category, count]) => ({ category, count })
    );

    res.status(200).json({
      success: true,
      data: {
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        completedToday,
        overdueTasks,
        categoryDistribution,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardSummary };
