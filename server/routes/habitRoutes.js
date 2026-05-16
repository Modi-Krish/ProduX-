const express = require('express');
const router = express.Router();
const { createHabit, getHabits, completeHabit, deleteHabit } = require('../controllers/habitController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getHabits)
  .post(createHabit);

router.route('/:id')
  .delete(deleteHabit);

router.post('/:id/complete', completeHabit);

module.exports = router;
