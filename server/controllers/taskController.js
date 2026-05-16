const Task = require('../models/Task');
const Habit = require('../models/Habit');
const Hobby = require('../models/Hobby');
const { sortByPriority, attachPriority } = require('../services/priorityService');
const { processTaskCompletion, awardSubtaskXP } = require('../services/gamificationService');

/**
 * @desc    Create a new task
 * @route   POST /api/tasks
 * @access  Private
 */
const createTask = async (req, res, next) => {
  try {
    const { title, description, category, deadline, subtasks, repeat, is21DayChallenge, alarmTime } = req.body;

    const taskData = {
      userId: req.user._id,
      title,
      description,
      category,
      deadline,
      subtasks: subtasks || [],
      repeat: repeat || 'None',
      is21DayChallenge: is21DayChallenge || false,
      alarmTime: alarmTime || null,
    };

    // If 21-day challenge, create a Hobby first and link it
    if (is21DayChallenge) {
      const hobby = await Hobby.create({
        userId: req.user._id,
        title,
        description,
      });
      taskData.hobbyId = hobby._id;
    }

    const task = await Task.create(taskData);

    // If repeat is Daily/Weekly, also create a linked Habit
    if (repeat && repeat !== 'None') {
      await Habit.create({
        userId: req.user._id,
        title,
        description,
        frequency: repeat,
      });
    }

    const taskWithPriority = attachPriority(task);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('task_created', taskWithPriority);
    }

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
    const tasks = await Task.find({ userId: req.user._id }).populate('hobbyId');
    const sorted = sortByPriority(tasks);

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
 */
const updateTask = async (req, res, next) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // Ensure user owns this task
    if (task.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task',
      });
    }

    const previousStatus = task.status;

    task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    const taskWithPriority = attachPriority(task);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('task_updated', taskWithPriority);
    }

    // ── Gamification: trigger on completion ──
    let gamificationResult = null;
    if (previousStatus !== 'Completed' && task.status === 'Completed') {
      try {
        gamificationResult = await processTaskCompletion(
          req.user._id,
          taskWithPriority.priorityScore
        );
        // Emit gamification event in real-time
        if (io) {
          io.to(req.user._id.toString()).emit('gamification_update', gamificationResult);
        }
      } catch (gamErr) {
        console.error('Gamification processing error:', gamErr);
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
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // Ensure user owns this task
    if (task.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this task',
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('task_deleted', { taskId: req.params.id });
    }

    res.status(200).json({
      success: true,
      data: { _id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle a subtask
 * @route   PATCH /api/tasks/:id/subtasks/:subtaskId
 * @access  Private
 */
const toggleSubtask = async (req, res, next) => {
  try {
    const { id, subtaskId } = req.params;
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const subtask = task.subtasks.id(subtaskId);
    if (!subtask) {
      return res.status(404).json({ success: false, message: 'Subtask not found' });
    }

    subtask.isCompleted = !subtask.isCompleted;
    
    let gamificationResult = null;
    if (subtask.isCompleted) {
      gamificationResult = await awardSubtaskXP(req.user._id);
      // Emit real-time event for XP
      const io = req.app.get('io');
      if (io) {
        io.to(req.user._id.toString()).emit('gamification_update', gamificationResult);
      }
    }

    await task.save();
    const taskWithPriority = attachPriority(task);

    // Emit real-time event for task update
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('task_updated', taskWithPriority);
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
