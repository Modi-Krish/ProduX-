const express = require('express');
const router = express.Router();
const { createHobby, getHobbies, updateHobbyProgress } = require('../controllers/hobbyController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getHobbies)
  .post(createHobby);

router.patch('/:id/progress', updateHobbyProgress);

module.exports = router;
