const express = require('express');
const router = express.Router();
const { createHabit, getHabits, completeHabit, deactivateHabit } = require('../controllers/habitController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getHabits)
  .post(createHabit);

router.route('/:id')
  .delete(deactivateHabit);

router.post('/:id/complete', completeHabit);

module.exports = router;
