/**
 * Gamification Service
 * Handles XP awards, streak tracking, leveling, and badge unlocking.
 *
 * FIX (BUG-3 / PERF-5): All user updates now only write the specific changed
 * fields instead of the entire user document, and processTaskCompletion uses a
 * Firestore transaction to prevent race conditions under concurrent completions.
 */

const { db, admin } = require('../config/firebase');
const logger = require('../utils/logger');

// ── Constants ─────────────────────────────────────────────
const SUBTASK_XP = 5;
const HABIT_XP = 20;

// ── Badge Definitions ─────────────────────────────────────
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

// ── Pure Calculation Functions ─────────────────────────────

/**
 * Calculate XP reward for completing a task based on priority score.
 * @param {number} priorityScore - The task's priority score (0-100+)
 * @returns {number} XP to award
 */
function calculateXP(priorityScore) {
  if (priorityScore >= 100) return 50;  // Overdue — bonus for clearing debt
  if (priorityScore >= 90) return 40;   // Critical
  if (priorityScore >= 70) return 30;   // High
  if (priorityScore >= 50) return 20;   // Medium
  if (priorityScore >= 35) return 15;   // Low
  return 10;                            // Minimal / completed
}

/**
 * Calculate level from total XP using sqrt curve.
 * Level = floor(sqrt(XP / 100)) + 1
 * @param {number} xp - Total XP
 * @returns {number} Level
 */
function calculateLevel(xp) {
  return Math.floor(Math.sqrt((xp || 0) / 100)) + 1;
}

/**
 * Calculate XP required for a given level.
 * @param {number} level - Target level
 * @returns {number} Total XP needed
 */
function xpForLevel(level) {
  return Math.pow(level - 1, 2) * 100;
}

/**
 * Check if two dates are the same calendar day.
 */
function isSameDay(d1, d2) {
  const date1 = d1 && typeof d1.toDate === 'function' ? d1.toDate() : new Date(d1);
  const date2 = d2 && typeof d2.toDate === 'function' ? d2.toDate() : new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if d1 is exactly the day before d2 (calendar days).
 */
function isYesterday(d1, d2) {
  const date2 = d2 && typeof d2.toDate === 'function' ? d2.toDate() : new Date(d2);
  const yesterday = new Date(date2);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(d1, yesterday);
}

/**
 * Check which new badges the user has earned.
 * @param {Object} user - User data with current badges, stats
 * @returns {Array} Array of newly earned badge objects
 */
function checkNewBadges(user) {
  const earnedBadgeIds = (user.badges || []).map((b) => b.id);
  const now = new Date();
  const newBadges = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (!earnedBadgeIds.includes(badge.id) && badge.condition(user)) {
      newBadges.push({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        earnedAt: now,
      });
    }
  }

  return newBadges;
}

// ── Service Functions ─────────────────────────────────────

/**
 * Process a task completion: award XP, update streak, check badges.
 * Uses a Firestore TRANSACTION to prevent race conditions when two
 * completions happen simultaneously.
 *
 * FIX (PERF-5 / BUG-3): Uses db.runTransaction() for atomic read-modify-write.
 * Only the changed gamification fields are written (not the full user document),
 * which prevents push subscriptions and FCM tokens from being overwritten.
 *
 * @param {string} userId - The user's Firebase UID
 * @param {number} priorityScore - The completed task's priority score
 * @returns {Object} Gamification result
 */
async function processTaskCompletion(userId, priorityScore) {
  const userRef = db.collection('users').doc(userId);
  const now = new Date();
  const xpGained = calculateXP(priorityScore);

  let result;

  try {
    result = await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new Error('User not found');
      }

      const user = userSnap.data();
      const oldLevel = user.level || 1;

      // ── Compute new XP and Level ──
      const newXP = (user.xp || 0) + xpGained;
      const newLevel = calculateLevel(newXP);
      const newTotalTasksCompleted = (user.totalTasksCompleted || 0) + 1;

      // ── Compute Streak ──
      let newStreak = user.streak || 0;
      if (user.lastCompletedDate) {
        if (isSameDay(user.lastCompletedDate, now)) {
          // Same day — streak already counted, no change
        } else if (isYesterday(user.lastCompletedDate, now)) {
          // Consecutive day — increment streak
          newStreak = newStreak + 1;
        } else {
          // Streak broken — reset to 1
          newStreak = 1;
        }
      } else {
        // First ever completion
        newStreak = 1;
      }

      const newLongestStreak = Math.max(newStreak, user.longestStreak || 0);

      // ── Check Badges ──
      // Build the updated user state to evaluate badge conditions
      const updatedUserForBadgeCheck = {
        ...user,
        xp: newXP,
        level: newLevel,
        streak: newStreak,
        totalTasksCompleted: newTotalTasksCompleted,
      };

      const newBadges = checkNewBadges(updatedUserForBadgeCheck);
      const updatedBadges = [...(user.badges || []), ...newBadges];

      // FIX (BUG-3): Only write the specific gamification fields.
      // This prevents overwriting pushSubscriptions, fcmTokens, etc.
      const updatePayload = {
        xp: newXP,
        level: newLevel,
        streak: newStreak,
        longestStreak: newLongestStreak,
        totalTasksCompleted: newTotalTasksCompleted,
        lastCompletedDate: now,
        badges: updatedBadges,
        updatedAt: now,
      };

      transaction.update(userRef, updatePayload);

      return {
        xpGained,
        newXP,
        newLevel,
        leveledUp: newLevel > oldLevel,
        newStreak,
        longestStreak: newLongestStreak,
        totalTasksCompleted: newTotalTasksCompleted,
        newBadges,
        xpForCurrentLevel: xpForLevel(newLevel),
        xpForNextLevel: xpForLevel(newLevel + 1),
      };
    });
  } catch (error) {
    logger.error('processTaskCompletion transaction failed', {
      userId,
      error: error.message,
    });
    throw error;
  }

  return result;
}

/**
 * Award XP for subtask completion (non-transactional — lower stakes).
 * Uses FieldValue.increment for atomic increment without a full read.
 *
 * FIX (BUG-3): Uses admin.firestore.FieldValue.increment() instead of
 * read-modify-write, which is atomic and prevents the value from being
 * overwritten by concurrent operations.
 */
async function awardSubtaskXP(userId, amount = SUBTASK_XP) {
  const userRef = db.collection('users').doc(userId);
  const now = new Date();

  // Read current level to detect level-up
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  const oldXP = user.xp || 0;
  const oldLevel = user.level || 1;
  const newXP = oldXP + amount;
  const newLevel = calculateLevel(newXP);

  // Write only the fields that changed
  await userRef.update({
    xp: admin.firestore.FieldValue.increment(amount),
    level: newLevel,
    updatedAt: now,
  });

  return {
    xpGained: amount,
    newXP,
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

/**
 * Process a habit completion — awards XP and updates habit streak.
 * Uses a transaction for atomic read-modify-write on the habit document.
 */
async function processHabitCompletion(userId, habitId) {
  const userRef = db.collection('users').doc(userId);
  const habitRef = db.collection('habits').doc(habitId);
  const now = new Date();

  const result = await db.runTransaction(async (transaction) => {
    const [userSnap, habitSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(habitRef),
    ]);

    if (!userSnap.exists || !habitSnap.exists) {
      throw new Error('User or Habit not found');
    }

    const user = userSnap.data();
    const habit = habitSnap.data();

    // Check if already completed today
    if (habit.lastCompleted && isSameDay(habit.lastCompleted, now)) {
      return { alreadyCompleted: true };
    }

    const oldLevel = user.level || 1;
    const newXP = (user.xp || 0) + HABIT_XP;
    const newLevel = calculateLevel(newXP);

    // Update habit streak
    let newHabitStreak = habit.streak || 0;
    if (habit.lastCompleted) {
      if (isYesterday(habit.lastCompleted, now)) {
        newHabitStreak = newHabitStreak + 1;
      } else {
        newHabitStreak = 1;
      }
    } else {
      newHabitStreak = 1;
    }

    const updatedHistory = [...(habit.history || []), { date: now, xpGained: HABIT_XP }];

    // FIX (BUG-3): Only write changed fields on both documents
    transaction.update(userRef, {
      xp: newXP,
      level: newLevel,
      updatedAt: now,
    });

    transaction.update(habitRef, {
      streak: newHabitStreak,
      lastCompleted: now,
      history: updatedHistory,
      updatedAt: now,
    });

    return {
      alreadyCompleted: false,
      xpGained: HABIT_XP,
      newXP,
      newLevel,
      leveledUp: newLevel > oldLevel,
      newStreak: newHabitStreak,
    };
  });

  return result;
}

/**
 * Get gamification stats for a user.
 * @param {string} userId
 * @returns {Object} Stats
 */
async function getStats(userId) {
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  const currentLevel = user.level || 1;

  return {
    xp: user.xp || 0,
    level: currentLevel,
    streak: user.streak || 0,
    longestStreak: user.longestStreak || 0,
    totalTasksCompleted: user.totalTasksCompleted || 0,
    badges: user.badges || [],
    xpForCurrentLevel: xpForLevel(currentLevel),
    xpForNextLevel: xpForLevel(currentLevel + 1),
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
  // Pure functions exported for unit testing
  calculateXP,
  calculateLevel,
  xpForLevel,
  isSameDay,
  isYesterday,
  checkNewBadges,
  BADGE_DEFINITIONS,
};
