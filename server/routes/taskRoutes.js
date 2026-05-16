const express = require('express');
const router = express.Router();
const {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  toggleSubtask,
} = require('../controllers/taskController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

// All task routes are protected
router.use(protect);

router.route('/')
  .get(getTasks)
  .post(validate(['title', 'deadline']), createTask);

router.route('/:id')
  .put(updateTask)
  .delete(deleteTask);

router.patch('/:id/subtasks/:subtaskId', toggleSubtask);

module.exports = router;
