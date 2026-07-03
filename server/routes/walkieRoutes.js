const express = require('express');
const router = express.Router();
const walkieController = require('../controllers/walkieController');
const { protect } = require('../middlewares/auth');

// All walkie-talkie routes require authentication
router.use(protect);

router.post('/create', walkieController.createRoom);
router.post('/join', walkieController.joinRoomByCode);
router.get('/my-rooms', walkieController.getMyRooms);
router.get('/public', walkieController.getPublicRooms);

router.route('/:id')
  .patch(walkieController.updateRoom)
  .delete(walkieController.deleteRoom);

module.exports = router;
