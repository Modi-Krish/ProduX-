const { db, formatDoc, formatDocs } = require('../config/firebase');
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

    // Generate unique _id values for subtasks for client toggles compatibility
    const formattedSubtasks = (subtasks || []).map(sub => ({
      _id: sub._id || Math.random().toString(36).substring(2, 11),
      title: sub.title,
      isCompleted: sub.isCompleted || false,
    }));

    const taskData = {
      userId: req.user._id,
      title,
      description: description || '',
      category: category || 'General',
      status: 'Pending',
      deadline: deadline ? new Date(deadline) : new Date(),
      subtasks: formattedSubtasks,
      repeat: repeat || 'None',
      is21DayChallenge: is21DayChallenge || false,
      hobbyId: null,
      alarmTime: alarmTime ? new Date(alarmTime) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // If 21-day challenge, create a Hobby first and link it
    if (is21DayChallenge) {
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
      
      const hobbyRef = await db.collection('hobbies').add(hobbyData);
      taskData.hobbyId = hobbyRef.id;
    }

    const docRef = await db.collection('tasks').add(taskData);

    // If repeat is Daily/Weekly, also create a linked Habit
    if (repeat && repeat !== 'None') {
      const habitData = {
        userId: req.user._id,
        title,
        description: description || '',
        frequency: repeat,
        streak: 0,
        lastCompleted: null,
        history: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('habits').add(habitData);
    }

    const taskWithPriority = attachPriority({
      _id: docRef.id,
      ...taskData
    });

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
    const tasksSnap = await db.collection('tasks').where('userId', '==', req.user._id).get();
    const tasks = formatDocs(tasksSnap);

    // Populate hobbyId documents in parallel if present
    const hobbyIds = [...new Set(tasks.map(t => t.hobbyId).filter(Boolean))];
    let hobbiesMap = {};
    
    if (hobbyIds.length > 0) {
      const hobbiesSnaps = await Promise.all(
        hobbyIds.map(id => db.collection('hobbies').doc(id).get())
      );
      hobbiesSnaps.forEach(snap => {
        if (snap.exists) {
          hobbiesMap[snap.id] = { _id: snap.id, ...snap.data() };
        }
      });
    }

    const populatedTasks = tasks.map(task => {
      if (task.hobbyId && hobbiesMap[task.hobbyId]) {
        return {
          ...task,
          hobbyId: hobbiesMap[task.hobbyId]
        };
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

    // Ensure user owns this task
    if (task.userId !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task',
      });
    }

    const previousStatus = task.status;
    
    // Normalize dates in req.body if they exist
    const updateData = { ...req.body, updatedAt: new Date() };
    if (updateData.deadline) updateData.deadline = new Date(updateData.deadline);
    if (updateData.alarmTime) updateData.alarmTime = new Date(updateData.alarmTime);

    await taskRef.update(updateData);

    const updatedSnap = await taskRef.get();
    const updatedTask = {
      _id: taskRef.id,
      ...updatedSnap.data()
    };

    const taskWithPriority = attachPriority(updatedTask);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('task_updated', taskWithPriority);
    }

    // ── Gamification: trigger on completion ──
    let gamificationResult = null;
    if (previousStatus !== 'Completed' && taskWithPriority.status === 'Completed') {
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
    const taskRef = db.collection('tasks').doc(req.params.id);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    const task = taskSnap.data();

    // Ensure user owns this task
    if (task.userId !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this task',
      });
    }

    await taskRef.delete();

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
    const taskRef = db.collection('tasks').doc(id);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = taskSnap.data();

    if (task.userId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const subtask = (task.subtasks || []).find(sub => sub._id === subtaskId);
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

    await taskRef.update({ subtasks: task.subtasks, updatedAt: new Date() });
    
    const taskWithPriority = attachPriority({
      _id: taskRef.id,
      ...task,
      subtasks: task.subtasks
    });

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
