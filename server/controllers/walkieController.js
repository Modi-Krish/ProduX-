const { db, admin } = require('../config/firebase');

// Utility to generate random room codes (e.g., PX-74A9KF)
const generateRoomCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `PX-${randomPart}`;
    
    // Check uniqueness
    const snapshot = await db.collection('walkie_rooms').where('code', '==', code).get();
    if (snapshot.empty) {
      isUnique = true;
    }
  }
  return code;
};

// Create a new walkie-talkie room
exports.createRoom = async (req, res, next) => {
  try {
    const { name, description, maxMembers = 50, isPublic = true } = req.body;
    const userId = req.user._id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Room name is required' });
    }

    const code = await generateRoomCode();
    
    const newRoom = {
      name,
      description: description || '',
      maxMembers: parseInt(maxMembers, 10),
      isPublic: Boolean(isPublic),
      code,
      creatorId: userId,
      memberIds: [userId], // For easy querying
      roles: {
        [userId]: 'creator'
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const roomRef = await db.collection('walkie_rooms').add(newRoom);

    res.status(201).json({
      success: true,
      data: {
        id: roomRef.id,
        _id: roomRef.id,
        ...newRoom,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (err) {
    next(err);
  }
};

// Join a room using its unique code
exports.joinRoomByCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Room code is required' });
    }

    const snapshot = await db.collection('walkie_rooms').where('code', '==', code.toUpperCase()).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ success: false, message: 'Invalid room code' });
    }

    const roomDoc = snapshot.docs[0];
    const roomData = roomDoc.data();
    const roomId = roomDoc.id;

    // Check if room is full
    if (roomData.memberIds.length >= roomData.maxMembers && !roomData.memberIds.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Room is full' });
    }

    // Add user to members if not already there
    if (!roomData.memberIds.includes(userId)) {
      await roomDoc.ref.update({
        memberIds: admin.firestore.FieldValue.arrayUnion(userId),
        [`roles.${userId}`]: 'user',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      roomData.memberIds.push(userId);
      roomData.roles[userId] = 'user';
    }

    res.status(200).json({
      success: true,
      data: {
        id: roomId,
        _id: roomId,
        ...roomData
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get rooms the user is a member of
exports.getMyRooms = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const snapshot = await db.collection('walkie_rooms')
      .where('memberIds', 'array-contains', userId)
      .get();

    const rooms = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        _id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      };
    });

    // Sort in memory to avoid Firestore composite index requirement
    rooms.sort((a, b) => {
      const dateA = a.updatedAt || a.createdAt || new Date(0);
      const dateB = b.updatedAt || b.createdAt || new Date(0);
      return dateB - dateA;
    });

    res.status(200).json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
};

// Get public recent rooms (for discovery)
exports.getPublicRooms = async (req, res, next) => {
  try {
    const snapshot = await db.collection('walkie_rooms')
      .where('isPublic', '==', true)
      .limit(50) // Increased limit to grab more before sorting
      .get();

    const rooms = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        _id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      };
    });

    // Sort in memory to avoid Firestore composite index requirement
    rooms.sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB - dateA;
    });

    res.status(200).json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
};

// Update room settings (creator only)
exports.updateRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, maxMembers, isPublic } = req.body;
    const userId = req.user._id;

    const roomRef = db.collection('walkie_rooms').doc(id);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const roomData = roomDoc.data();

    if (roomData.creatorId !== userId) {
      return res.status(403).json({ success: false, message: 'Only the creator can update room settings' });
    }

    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (maxMembers) updates.maxMembers = parseInt(maxMembers, 10);
    if (isPublic !== undefined) updates.isPublic = Boolean(isPublic);

    await roomRef.update(updates);

    res.status(200).json({ success: true, message: 'Room updated successfully' });
  } catch (err) {
    next(err);
  }
};

// Delete a room
exports.deleteRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const roomRef = db.collection('walkie_rooms').doc(id);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (roomDoc.data().creatorId !== userId) {
      return res.status(403).json({ success: false, message: 'Only the creator can delete the room' });
    }

    await roomRef.delete();

    res.status(200).json({ success: true, message: 'Room deleted successfully' });
  } catch (err) {
    next(err);
  }
};
