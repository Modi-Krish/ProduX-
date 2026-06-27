const { db, formatDocs } = require('../config/firebase');
const { processHabitCompletion } = require('../services/gamificationService');
const logger = require('../utils/logger');

const VALID_FREQUENCIES = ['Daily', 'Weekly'];

/**
 * @desc    Create a new habit
 * @route   POST /api/habits
 * @access  Private
 */
const createHabit = async (req, res, next) => {
  try {
    const { title, description, frequency } = req.body;

    const habitData = {
      userId: req.user._id,
      title: String(title).trim().substring(0, 200),
      description: String(description || '').trim().substring(0, 1000),
      frequency: VALID_FREQUENCIES.includes(frequency) ? frequency : 'Daily',
      streak: 0,
      lastCompleted: null,
      history: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection('habits').add(habitData);

    res.status(201).json({
      success: true,
      data: { _id: docRef.id, ...habitData },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all active habits for current user
 * @route   GET /api/habits
 * @access  Private
 */
const getHabits = async (req, res, next) => {
  try {
    const habitsSnap = await db
      .collection('habits')
      .where('userId', '==', req.user._id)
      .where('isActive', '==', true)
      .get();

    const habits = formatDocs(habitsSnap);

    res.status(200).json({ success: true, data: habits });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark a habit as completed for today
 * @route   POST /api/habits/:id/complete
 * @access  Private
 *
 * FIX (BUG-8): The "already completed today" case now returns a consistent
 * response shape with a `data` object and `alreadyCompleted` flag, instead
 * of returning a bare `{ message: '...' }` that was inconsistent with the
 * normal success response shape.
 */
const completeHabit = async (req, res, next) => {
  try {
    const habitRef = db.collection('habits').doc(req.params.id);
    const habitSnap = await habitRef.get();

    if (!habitSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found',
      });
    }

    const habit = habitSnap.data();

    if (habit.userId !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Use the gamification service (which handles transactions and "already completed" checks)
    const gamificationResult = await processHabitCompletion(req.user._id, req.params.id);

    // FIX (BUG-8): Consistent response shape whether or not already completed
    if (gamificationResult.alreadyCompleted) {
      return res.status(200).json({
        success: true,
        alreadyCompleted: true,
        message: 'Habit already completed today',
        // Return current habit data for consistency
        data: { _id: habitRef.id, ...habit },
        gamification: null,
      });
    }

    // Fetch the updated habit from Firestore (updated by the transaction in gamificationService)
    const updatedSnap = await habitRef.get();
    const updatedHabit = { _id: habitRef.id, ...updatedSnap.data() };

    // Emit gamification and habit update events
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id).emit('gamification_update', gamificationResult);
      io.to(req.user._id).emit('habit_updated', updatedHabit);
    }

    logger.info('Habit completed', {
      habitId: req.params.id,
      userId: req.user._id,
      xpGained: gamificationResult.xpGained,
    });

    res.status(200).json({
      success: true,
      alreadyCompleted: false,
      data: updatedHabit,
      gamification: gamificationResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate (soft-delete) a habit
 * @route   DELETE /api/habits/:id
 * @access  Private
 */
const deactivateHabit = async (req, res, next) => {
  try {
    const habitRef = db.collection('habits').doc(req.params.id);
    const habitSnap = await habitRef.get();

    if (!habitSnap.exists) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    const habit = habitSnap.data();

    if (habit.userId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await habitRef.update({ isActive: false, updatedAt: new Date() });

    res.status(200).json({
      success: true,
      message: 'Habit deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createHabit, getHabits, completeHabit, deactivateHabit };
