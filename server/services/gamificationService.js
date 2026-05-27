/**
 * Gamification Service
 * Handles XP awards, streak tracking, leveling, and badge unlocking.
 */

const { db } = require('../config/firebase');

// ── Badge Definitions ──
const BADGE_DEFINITIONS = [
  {
    id: 'first_task',
    name: 'First Step',
    description: 'Complete your first task',
    icon: '🎯',
    condition: (user) => (user.totalTasksCompleted || 0) >= 1,
  },
  {
    id: 'five_tasks',
    name: 'Getting Started',
    description: 'Complete 5 tasks',
    icon: '🚀',
    condition: (user) => (user.totalTasksCompleted || 0) >= 5,
  },
  {
    id: 'ten_tasks',
    name: 'Task Master',
    description: 'Complete 10 tasks',
    icon: '⚡',
    condition: (user) => (user.totalTasksCompleted || 0) >= 10,
  },
  {
    id: 'twentyfive_tasks',
    name: 'Powerhouse',
    description: 'Complete 25 tasks',
    icon: '💪',
    condition: (user) => (user.totalTasksCompleted || 0) >= 25,
  },
  {
    id: 'fifty_tasks',
    name: 'Half Century',
    description: 'Complete 50 tasks',
    icon: '🏆',
    condition: (user) => (user.totalTasksCompleted || 0) >= 50,
  },
  {
    id: 'hundred_tasks',
    name: 'Centurion',
    description: 'Complete 100 tasks',
    icon: '👑',
    condition: (user) => (user.totalTasksCompleted || 0) >= 100,
  },
  {
    id: 'streak_3',
    name: 'On Fire',
    description: 'Maintain a 3-day streak',
    icon: '🔥',
    condition: (user) => (user.streak || 0) >= 3,
  },
  {
    id: 'streak_7',
    name: 'Weekly Warrior',
    description: 'Maintain a 7-day streak',
    icon: '⚔️',
    condition: (user) => (user.streak || 0) >= 7,
  },
  {
    id: 'streak_14',
    name: 'Unstoppable',
    description: 'Maintain a 14-day streak',
    icon: '🌟',
    condition: (user) => (user.streak || 0) >= 14,
  },
  {
    id: 'streak_30',
    name: 'Legendary',
    description: 'Maintain a 30-day streak',
    icon: '💎',
    condition: (user) => (user.streak || 0) >= 30,
  },
  {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reach Level 5',
    icon: '⭐',
    condition: (user) => (user.level || 1) >= 5,
  },
  {
    id: 'level_10',
    name: 'Elite',
    description: 'Reach Level 10',
    icon: '🌠',
    condition: (user) => (user.level || 1) >= 10,
  },
];

/**
 * Calculate XP reward for completing a task based on priority score
 * @param {number} priorityScore - The task's priority score (0-100)
 * @returns {number} XP to award
 */
function calculateXP(priorityScore) {
  if (priorityScore >= 100) return 50;   // Overdue — bonus for clearing debt
  if (priorityScore >= 90) return 40;    // Critical
  if (priorityScore >= 70) return 30;    // High
  if (priorityScore >= 50) return 20;    // Medium
  if (priorityScore >= 35) return 15;    // Low
  return 10;                             // Minimal / completed
}

/**
 * Calculate level from total XP
 * Uses sqrt curve: Level = floor(sqrt(XP / 100)) + 1
 * @param {number} xp - Total XP
 * @returns {number} Level
 */
function calculateLevel(xp) {
  return Math.floor(Math.sqrt((xp || 0) / 100)) + 1;
}

/**
 * Calculate XP required for a given level
 * @param {number} level - Target level
 * @returns {number} Total XP needed
 */
function xpForLevel(level) {
  return Math.pow(level - 1, 2) * 100;
}

/**
 * Check if two dates are the same calendar day
 */
function isSameDay(d1, d2) {
  const date1 = typeof d1.toDate === 'function' ? d1.toDate() : new Date(d1);
  const date2 = typeof d2.toDate === 'function' ? d2.toDate() : new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if d1 is exactly the day before d2 (calendar days)
 */
function isYesterday(d1, d2) {
  const date2 = typeof d2.toDate === 'function' ? d2.toDate() : new Date(d2);
  const yesterday = new Date(date2);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(d1, yesterday);
}

/**
 * Process a task completion: award XP, update streak, check badges
 * @param {string} userId - The user's Firebase UID
 * @param {number} priorityScore - The completed task's priority score
 * @returns {Object} Gamification result { xpGained, newXP, newLevel, leveledUp, newStreak, newBadges }
 */
async function processTaskCompletion(userId, priorityScore) {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  const now = new Date();
  const xpGained = calculateXP(priorityScore);
  const oldLevel = user.level || 1;

  // ── Update XP & Level ──
  user.xp = (user.xp || 0) + xpGained;
  user.level = calculateLevel(user.xp);
  user.totalTasksCompleted = (user.totalTasksCompleted || 0) + 1;

  // ── Streak Logic ──
  if (user.lastCompletedDate) {
    if (isSameDay(user.lastCompletedDate, now)) {
      // Same day — streak already counted, no change
    } else if (isYesterday(user.lastCompletedDate, now)) {
      // Consecutive day — increment streak
      user.streak = (user.streak || 0) + 1;
    } else {
      // Streak broken — reset to 1
      user.streak = 1;
    }
  } else {
    // First ever completion
    user.streak = 1;
  }

  // Update longest streak
  if (user.streak > (user.longestStreak || 0)) {
    user.longestStreak = user.streak;
  }

  user.lastCompletedDate = now;

  // ── Check Badges ──
  const earnedBadgeIds = (user.badges || []).map((b) => b.id);
  const newBadges = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (!earnedBadgeIds.includes(badge.id) && badge.condition(user)) {
      const newBadge = {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        earnedAt: now,
      };
      if (!user.badges) user.badges = [];
      user.badges.push(newBadge);
      newBadges.push(newBadge);
    }
  }

  await userRef.update(user);

  const leveledUp = user.level > oldLevel;

  return {
    xpGained,
    newXP: user.xp,
    newLevel: user.level,
    leveledUp,
    newStreak: user.streak,
    longestStreak: user.longestStreak,
    totalTasksCompleted: user.totalTasksCompleted,
    newBadges,
    xpForCurrentLevel: xpForLevel(user.level),
    xpForNextLevel: xpForLevel(user.level + 1),
  };
}

/**
 * Award XP for subtask completion or general progress
 */
async function awardSubtaskXP(userId, amount = 5) {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  const xpGained = amount;
  const oldLevel = user.level || 1;

  user.xp = (user.xp || 0) + xpGained;
  user.level = calculateLevel(user.xp);
  await userRef.update({
    xp: user.xp,
    level: user.level
  });

  return {
    xpGained,
    newXP: user.xp,
    newLevel: user.level,
    leveledUp: user.level > oldLevel,
  };
}

/**
 * Process a habit completion
 */
async function processHabitCompletion(userId, habitId) {
  const userRef = db.collection('users').doc(userId);
  const habitRef = db.collection('habits').doc(habitId);
  const [userSnap, habitSnap] = await Promise.all([userRef.get(), habitRef.get()]);

  if (!userSnap.exists || !habitSnap.exists) throw new Error('User or Habit not found');
  const user = userSnap.data();
  const habit = habitSnap.data();

  const now = new Date();
  const xpGained = 20; // Fixed XP for habit
  const oldLevel = user.level || 1;

  // Update user XP
  user.xp = (user.xp || 0) + xpGained;
  user.level = calculateLevel(user.xp);

  // Update Habit Streak
  if (habit.lastCompleted) {
    if (isSameDay(habit.lastCompleted, now)) {
      return { message: 'Already completed today' };
    } else if (isYesterday(habit.lastCompleted, now)) {
      habit.streak = (habit.streak || 0) + 1;
    } else {
      habit.streak = 1;
    }
  } else {
    habit.streak = 1;
  }

  habit.lastCompleted = now;
  if (!habit.history) habit.history = [];
  habit.history.push({ date: now, xpGained });

  await Promise.all([
    userRef.update({ xp: user.xp, level: user.level }),
    habitRef.update({ streak: habit.streak, lastCompleted: habit.lastCompleted, history: habit.history })
  ]);

  return {
    xpGained,
    newXP: user.xp,
    newLevel: user.level,
    leveledUp: user.level > oldLevel,
    newStreak: habit.streak,
  };
}

/**
 * Get gamification stats for a user
 * @param {string} userId
 * @returns {Object} Stats
 */
async function getStats(userId) {
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  return {
    xp: user.xp || 0,
    level: user.level || 1,
    streak: user.streak || 0,
    longestStreak: user.longestStreak || 0,
    totalTasksCompleted: user.totalTasksCompleted || 0,
    badges: user.badges || [],
    xpForCurrentLevel: xpForLevel(user.level || 1),
    xpForNextLevel: xpForLevel((user.level || 1) + 1),
    allBadges: BADGE_DEFINITIONS.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      earned: (user.badges || []).some((ub) => ub.id === b.id),
      earnedAt: (user.badges || []).find((ub) => ub.id === b.id)?.earnedAt || null,
    })),
  };
}

module.exports = {
  processTaskCompletion,
  awardSubtaskXP,
  processHabitCompletion,
  getStats,
  calculateXP,
  calculateLevel,
  xpForLevel,
  BADGE_DEFINITIONS,
};
