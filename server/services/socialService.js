const { db, formatDocs } = require('../config/firebase');

class SocialService {
  async getLeaderboard(limit = 50) {
    const usersSnap = await db.collection('users')
      .orderBy('xp', 'desc')
      .limit(limit)
      .get();
    
    const users = formatDocs(usersSnap);

    return users.map((u, index) => ({
      _id: u._id,
      rank: index + 1,
      name: u.name,
      xp: u.xp || 0,
      level: u.level || 1,
      streak: u.streak || 0,
      totalTasksCompleted: u.totalTasksCompleted || 0,
      badgeCount: u.badges?.length || 0,
    }));
  }
}

module.exports = new SocialService();
