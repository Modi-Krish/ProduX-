const { db, formatDoc, formatDocs } = require('../config/firebase');
const { sortByPriority, attachPriority } = require('../services/priorityService');
const { processTaskCompletion, awardSubtaskXP } = require('../services/gamificationService');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// ── Allowed fields for task creation and update ─────────────
// FIX (SEC-3): Explicit whitelisting prevents mass assignment attacks.
// A malicious user cannot inject 'userId', 'hobbyId', or any other
// unintended fields through the request body.
const ALLOWED_CREATE_FIELDS = [
  'title', 'description', 'category', 'deadline',
  'subtasks', 'repeat', 'is21DayChallenge', 'alarmTime', 'attachments',
];

const ALLOWED_UPDATE_FIELDS = [
  'title', 'description', 'category', 'deadline', 'status',
  'subtasks', 'repeat', 'alarmTime', 'attachments',
];

const VALID_STATUSES = ['Pending', 'In Progress', 'Completed'];
const VALID_REPEAT_VALUES = ['None', 'Daily', 'Weekly'];

/**
 * @desc    Create a new task
 * @route   POST /api/tasks
 * @access  Private
 */
const createTask = async (req, res, next) => {
  try {
    // FIX (SEC-3): Only extract explicitly allowed fields from request body
    const {
      title, description, category, deadline,
      subtasks, repeat, is21DayChallenge, alarmTime, attachments,
    } = req.body;

    // Validate status-related fields
    const repeatValue = (repeat && VALID_REPEAT_VALUES.includes(repeat)) ? repeat : 'None';

    // FIX: Use uuid v4 for subtask IDs instead of Math.random() for guaranteed uniqueness
    const formattedSubtasks = (subtasks || []).map((sub) => ({
      _id: sub._id || uuidv4(),
      title: String(sub.title || '').trim().substring(0, 200),
      isCompleted: sub.isCompleted || false,
    }));

    const taskData = {
      userId: req.user._id,
      title: String(title).trim().substring(0, 200),
      description: String(description || '').trim().substring(0, 2000),
      category: String(category || 'General').trim().substring(0, 100),
      status: 'Pending',
      deadline: deadline ? new Date(deadline) : new Date(),
      subtasks: formattedSubtasks,
      repeat: repeatValue,
      is21DayChallenge: Boolean(is21DayChallenge),
      hobbyId: null,
      alarmTime: alarmTime ? new Date(alarmTime) : null,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // If 21-day challenge, create a Hobby first and link it
    if (taskData.is21DayChallenge) {
      const hobbyData = {
        userId: req.user._id,
        title: taskData.title,
        description: taskData.description,
        currentDay: 1,
        timeSpentToday: 0,
        lastUpdated: new Date(),
        history: [],
        isActive: true,
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const hobbyRef = await db.collection('hobbies').add(hobbyData);
      taskData.hobbyId = hobbyRef.id;
    }

    const docRef = await db.collection('tasks').add(taskData);

    // If repeat is Daily/Weekly, also create a linked Habit
    if (repeatValue !== 'None') {
      const habitData = {
        userId: req.user._id,
        title: taskData.title,
        description: taskData.description,
        frequency: repeatValue,
        streak: 0,
        lastCompleted: null,
        history: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection('habits').add(habitData);
    }

    const taskWithPriority = attachPriority({
      _id: docRef.id,
      ...taskData,
    });

    // Emit real-time event to user's personal socket room
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id).emit('task_created', taskWithPriority);
    }

    logger.info('Task created', { taskId: docRef.id, userId: req.user._id });

    res.status(201).json({
      success: true,
      data: taskWithPriority,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all tasks for current user (sorted by priority)
 * @route   GET /api/tasks
 * @access  Private
 */
const getTasks = async (req, res, next) => {
  try {
    const tasksSnap = await db
      .collection('tasks')
      .where('userId', '==', req.user._id)
      .get();

    const tasks = formatDocs(tasksSnap);

    // Populate hobbyId documents in parallel if present
    const hobbyIds = [...new Set(tasks.map((t) => t.hobbyId).filter(Boolean))];
    let hobbiesMap = {};

    if (hobbyIds.length > 0) {
      const hobbiesSnaps = await Promise.all(
        hobbyIds.map((id) => db.collection('hobbies').doc(id).get())
      );
      hobbiesSnaps.forEach((snap) => {
        if (snap.exists) {
          hobbiesMap[snap.id] = { _id: snap.id, ...snap.data() };
        }
      });
    }

    const populatedTasks = tasks.map((task) => {
      if (task.hobbyId && hobbiesMap[task.hobbyId]) {
        return { ...task, hobbyId: hobbiesMap[task.hobbyId] };
      }
      return task;
    });

    const sorted = sortByPriority(populatedTasks);

    res.status(200).json({
      success: true,
      count: sorted.length,
      data: sorted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a task
 * @route   PUT /api/tasks/:id
 * @access  Private
 *
 * FIX (SEC-3): Mass assignment prevented — only ALLOWED_UPDATE_FIELDS
 * are extracted from req.body. 'userId', 'hobbyId', 'createdAt', etc.
 * cannot be overwritten via the API.
 */
const updateTask = async (req, res, next) => {
  try {
    const taskRef = db.collection('tasks').doc(req.params.id);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    const task = taskSnap.data();

    // Authorization: ensure user owns this task
    if (task.userId !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task',
      });
    }

    const previousStatus = task.status;

    // FIX (SEC-3): Build update payload from whitelisted fields only
    const updateData = { updatedAt: new Date() };

    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) {
        // Normalize date fields
        if (field === 'deadline' || field === 'alarmTime') {
          updateData[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else if (field === 'status') {
          // Validate status enum
          if (VALID_STATUSES.includes(req.body[field])) {
            updateData[field] = req.body[field];
          }
        } else if (field === 'subtasks') {
          // Re-attach UUIDs to subtasks without _id
          updateData[field] = (req.body[field] || []).map((sub) => ({
            _id: sub._id || uuidv4(),
            title: String(sub.title || '').trim().substring(0, 200),
            isCompleted: Boolean(sub.isCompleted),
          }));
        } else if (field === 'repeat') {
          if (VALID_REPEAT_VALUES.includes(req.body[field])) {
            updateData[field] = req.body[field];
          }
        } else if (field === 'attachments') {
          updateData[field] = Array.isArray(req.body[field]) ? req.body[field] : [];
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    await taskRef.update(updateData);

    const updatedSnap = await taskRef.get();
    const updatedTask = { _id: taskRef.id, ...updatedSnap.data() };
    const taskWithPriority = attachPriority(updatedTask);

    // Emit real-time task update
    // FIX (BUG-7): io is only retrieved once — removed the duplicate const io
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id).emit('task_updated', taskWithPriority);
    }

    // ── Gamification: trigger on completion ──
    let gamificationResult = null;
    if (previousStatus !== 'Completed' && taskWithPriority.status === 'Completed') {
      try {
        gamificationResult = await processTaskCompletion(
          req.user._id,
          taskWithPriority.priorityScore
        );
        if (io) {
          io.to(req.user._id).emit('gamification_update', gamificationResult);
        }
      } catch (gamErr) {
        // Non-fatal: log but don't fail the task update response
        logger.error('Gamification processing error', {
          userId: req.user._id,
          taskId: taskRef.id,
          error: gamErr.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: taskWithPriority,
      gamification: gamificationResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a task
 * @route   DELETE /api/tasks/:id
 * @access  Private
 */
const deleteTask = async (req, res, next) => {
  try {
    const taskRef = db.collection('tasks').doc(req.params.id);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = taskSnap.data();

    if (task.userId !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this task',
      });
    }

    await taskRef.delete();

    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id).emit('task_deleted', { taskId: req.params.id });
    }

    logger.info('Task deleted', { taskId: req.params.id, userId: req.user._id });

    res.status(200).json({
      success: true,
      data: { _id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle a subtask completion state
 * @route   PATCH /api/tasks/:id/subtasks/:subtaskId
 * @access  Private
 *
 * FIX (BUG-7): Removed duplicate `const io = req.app.get('io')` that existed
 * both before and after the Firestore write. Now retrieved once.
 *
 * FIX (BUG-6): Subtask state is toggled on a fresh copy of the array
 * to minimize race condition window (full transaction would be ideal for
 * high concurrency but subtask toggles are lower-stakes than XP).
 */
const toggleSubtask = async (req, res, next) => {
  try {
    const { id, subtaskId } = req.params;
    const taskRef = db.collection('tasks').doc(id);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = taskSnap.data();

    if (task.userId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const subtaskIndex = (task.subtasks || []).findIndex(
      (sub) => sub._id === subtaskId
    );

    if (subtaskIndex === -1) {
      return res.status(404).json({ success: false, message: 'Subtask not found' });
    }

    // Toggle the specific subtask
    const updatedSubtasks = task.subtasks.map((sub, idx) =>
      idx === subtaskIndex ? { ...sub, isCompleted: !sub.isCompleted } : sub
    );

    const toggledSubtask = updatedSubtasks[subtaskIndex];

    // FIX (BUG-7): Single io reference used throughout this function
    const io = req.app.get('io');

    // Award XP if the subtask was just completed
    let gamificationResult = null;
    if (toggledSubtask.isCompleted) {
      try {
        gamificationResult = await awardSubtaskXP(req.user._id);
        if (io) {
          io.to(req.user._id).emit('gamification_update', gamificationResult);
        }
      } catch (gamErr) {
        logger.error('Subtask XP award error', {
          userId: req.user._id,
          error: gamErr.message,
        });
      }
    }

    await taskRef.update({ subtasks: updatedSubtasks, updatedAt: new Date() });

    const taskWithPriority = attachPriority({
      _id: taskRef.id,
      ...task,
      subtasks: updatedSubtasks,
    });

    if (io) {
      io.to(req.user._id).emit('task_updated', taskWithPriority);
    }

    res.status(200).json({
      success: true,
      data: taskWithPriority,
      gamification: gamificationResult,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createTask, getTasks, updateTask, deleteTask, toggleSubtask };
