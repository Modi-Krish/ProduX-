const { db, formatDoc, formatDocs } = require('../config/firebase');
const { awardSubtaskXP } = require('../services/gamificationService');

// Helper to get target time for a specific day in the 21-Day challenge
const getHobbyTargetTime = (day) => {
  if (day <= 3) return 60; // 1 hour
  if (day <= 7) return 90; // 1.5 hours
  if (day <= 14) return 120; // 2 hours
  return 150; // 2.5 hours
};

/**
 * @desc    Create a new hobby challenge
 * @route   POST /api/hobbies
 * @access  Private
 */
const createHobby = async (req, res, next) => {
  try {
    const { title, description } = req.body;

    const hobbyData = {
      userId: req.user._id,
      title,
      description: description || '',
      currentDay: 1,
      timeSpentToday: 0,
      lastUpdated: new Date(),
      history: [],
      isActive: true,
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('hobbies').add(hobbyData);

    res.status(201).json({
      success: true,
      data: {
        _id: docRef.id,
        ...hobbyData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all hobbies for user
 * @route   GET /api/hobbies
 * @access  Private
 */
const getHobbies = async (req, res, next) => {
  try {
    const hobbiesSnap = await db.collection('hobbies')
      .where('userId', '==', req.user._id)
      .where('isActive', '==', true)
      .get();
    
    const hobbies = formatDocs(hobbiesSnap);

    res.status(200).json({ success: true, data: hobbies });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update progress for a hobby (adding minutes)
 * @route   PATCH /api/hobbies/:id/progress
 * @access  Private
 */
const updateHobbyProgress = async (req, res, next) => {
  try {
    const { minutes } = req.body;
    const hobbyRef = db.collection('hobbies').doc(req.params.id);
    const hobbySnap = await hobbyRef.get();

    if (!hobbySnap.exists) {
      return res.status(404).json({ success: false, message: 'Hobby not found' });
    }

    const hobby = hobbySnap.data();

    if (hobby.userId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const today = new Date();
    // Support Firestore Timestamp conversion for lastUpdated
    const lastUpdate = hobby.lastUpdated && typeof hobby.lastUpdated.toDate === 'function'
      ? hobby.lastUpdated.toDate()
      : new Date(hobby.lastUpdated || Date.now());

    const isSameDay = today.toDateString() === lastUpdate.toDateString();

    if (!isSameDay) {
      // New day, reset time spent today
      hobby.timeSpentToday = 0;
    }

    hobby.timeSpentToday = (hobby.timeSpentToday || 0) + minutes;
    hobby.lastUpdated = today;

    const targetTime = getHobbyTargetTime(hobby.currentDay || 1);
    let leveledUpForDay = false;

    if (hobby.timeSpentToday >= targetTime && !hobby.isCompleted) {
      // Day completed!
      if (!hobby.history) hobby.history = [];
      hobby.history.push({
        day: hobby.currentDay || 1,
        timeSpent: hobby.timeSpentToday,
        date: today
      });

      if ((hobby.currentDay || 1) >= 21) {
        hobby.isCompleted = true;
      } else {
        hobby.currentDay = (hobby.currentDay || 1) + 1;
        hobby.timeSpentToday = 0; // Reset for next day
      }
      leveledUpForDay = true;
    }

    hobby.updatedAt = today;

    await hobbyRef.update(hobby);

    // Format updated data for output
    const updatedHobby = {
      _id: hobbyRef.id,
      ...hobby
    };

    // Award XP (1 XP per minute, plus 50 XP bonus for completing a day)
    const gamificationResult = await awardSubtaskXP(req.user._id, minutes + (leveledUpForDay ? 50 : 0));

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('gamification_update', gamificationResult);
      io.to(req.user._id.toString()).emit('hobby_updated', updatedHobby);
    }

    res.status(200).json({ 
      success: true, 
      data: updatedHobby, 
      leveledUpForDay,
      gamification: gamificationResult 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createHobby, getHobbies, updateHobbyProgress };
