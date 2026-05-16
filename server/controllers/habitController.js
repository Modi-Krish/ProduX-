const Habit = require('../models/Habit');
const { processHabitCompletion } = require('../services/gamificationService');

/**
 * @desc    Create a new habit
 * @route   POST /api/habits
 * @access  Private
 */
const createHabit = async (req, res, next) => {
  try {
    const { title, description, frequency } = req.body;

    const habit = await Habit.create({
      userId: req.user._id,
      title,
      description,
      frequency,
    });

    res.status(201).json({
      success: true,
      data: habit,
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
    const habits = await Habit.find({ userId: req.user._id, isActive: true });

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
    const habit = await Habit.findById(req.params.id);

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found',
      });
    }

    if (habit.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const gamificationResult = await processHabitCompletion(req.user._id, habit._id);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('gamification_update', gamificationResult);
      io.to(req.user._id.toString()).emit('habit_updated', habit);
    }

    res.status(200).json({
      success: true,
      data: habit,
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
    const habit = await Habit.findById(req.params.id);

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found',
      });
    }

    if (habit.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    habit.isActive = false;
    await habit.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createHabit, getHabits, completeHabit, deleteHabit };
