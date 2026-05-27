const { db, formatDoc, formatDocs } = require('../config/firebase');
const { processHabitCompletion } = require('../services/gamificationService');

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
      title,
      description: description || '',
      frequency: frequency || 'Daily',
      streak: 0,
      lastCompleted: null,
      history: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('habits').add(habitData);

    res.status(201).json({
      success: true,
      data: {
        _id: docRef.id,
        ...habitData
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all habits for current user
 * @route   GET /api/habits
 * @access  Private
 */
const getHabits = async (req, res, next) => {
  try {
    const habitsSnap = await db.collection('habits')
      .where('userId', '==', req.user._id)
      .where('isActive', '==', true)
      .get();
    
    const habits = formatDocs(habitsSnap);

    res.status(200).json({
      success: true,
      count: habits.length,
      data: habits,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete a habit
 * @route   POST /api/habits/:id/complete
 * @access  Private
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

    const gamificationResult = await processHabitCompletion(req.user._id, habitRef.id);

    // Fetch the updated habit data
    const updatedSnap = await habitRef.get();
    const updatedHabit = {
      _id: habitRef.id,
      ...updatedSnap.data()
    };

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('gamification_update', gamificationResult);
      io.to(req.user._id.toString()).emit('habit_updated', updatedHabit);
    }

    res.status(200).json({
      success: true,
      data: updatedHabit,
      gamification: gamificationResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete/Deactivate a habit
 * @route   DELETE /api/habits/:id
 * @access  Private
 */
const deleteHabit = async (req, res, next) => {
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

    await habitRef.update({
      isActive: false,
      updatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createHabit, getHabits, completeHabit, deleteHabit };
