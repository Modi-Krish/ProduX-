const Hobby = require('../models/Hobby');
const { awardSubtaskXP } = require('../services/gamificationService');

/**
 * @desc    Create a new hobby challenge
 * @route   POST /api/hobbies
 */
const createHobby = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const hobby = await Hobby.create({
      userId: req.user._id,
      title,
      description,
    });
    res.status(201).json({ success: true, data: hobby });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all hobbies for user
 * @route   GET /api/hobbies
 */
const getHobbies = async (req, res, next) => {
  try {
    const hobbies = await Hobby.find({ userId: req.user._id, isActive: true });
    res.status(200).json({ success: true, data: hobbies });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update progress for a hobby (adding minutes)
 * @route   PATCH /api/hobbies/:id/progress
 */
const updateHobbyProgress = async (req, res, next) => {
  try {
    const { minutes } = req.body;
    const hobby = await Hobby.findById(req.params.id);

    if (!hobby) {
      return res.status(404).json({ success: false, message: 'Hobby not found' });
    }

    const today = new Date();
    const lastUpdate = new Date(hobby.lastUpdated);
    const isSameDay = today.toDateString() === lastUpdate.toDateString();

    if (!isSameDay) {
      // New day, reset time spent today
      hobby.timeSpentToday = 0;
      // Note: We don't increment currentDay automatically here. 
      // It increments when the target for the day is met.
    }

    hobby.timeSpentToday += minutes;
    hobby.lastUpdated = today;

    const targetTime = hobby.getTargetTime();
    let leveledUpForDay = false;

    if (hobby.timeSpentToday >= targetTime && !hobby.isCompleted) {
      // Day completed!
      hobby.history.push({
        day: hobby.currentDay,
        timeSpent: hobby.timeSpentToday,
        date: today
      });

      if (hobby.currentDay >= 21) {
        hobby.isCompleted = true;
      } else {
        hobby.currentDay += 1;
        hobby.timeSpentToday = 0; // Reset for next day
      }
      leveledUpForDay = true;
    }

    await hobby.save();

    // Award XP (1 XP per minute, plus 50 XP bonus for completing a day)
    const gamificationResult = await awardSubtaskXP(req.user._id, minutes + (leveledUpForDay ? 50 : 0));

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('gamification_update', gamificationResult);
      io.to(req.user._id.toString()).emit('hobby_updated', hobby);
    }

    res.status(200).json({ 
      success: true, 
      data: hobby, 
      leveledUpForDay,
      gamification: gamificationResult 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createHobby, getHobbies, updateHobbyProgress };
