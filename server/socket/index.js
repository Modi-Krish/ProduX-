const { admin, db } = require('../config/firebase');

/**
 * Initialize Socket.io with auth and room management
 * @param {Object} io - Socket.io server instance
 */
const initializeSocket = (io) => {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication error — no token'));
    }

    try {
      // Verify Firebase ID Token
      const decoded = await admin.auth().verifyIdToken(token);
      socket.userId = decoded.uid;
      next();
    } catch (err) {
      console.error('Socket authentication error:', err.message);
      return next(new Error('Authentication error — invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🔌 Socket connected: ${socket.id} (User: ${userId})`);

    // Join user to their personal room
    socket.join(userId);

    // Auto-join all group rooms the user belongs to
    try {
      // Query group collection where current user's UID is in the members array
      const groupsSnapshot = await db.collection('groups')
        .where('members', 'array-contains', userId)
        .get();

      groupsSnapshot.forEach((doc) => {
        socket.join(`group:${doc.id}`);
      });
      if (!groupsSnapshot.empty) {
        console.log(`📡 User ${userId} joined ${groupsSnapshot.size} group room(s)`);
      }
    } catch (err) {
      console.error('Error joining group rooms:', err.message);
    }

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });

    // Handle reconnection acknowledgment
    socket.on('reconnect_ack', () => {
      socket.join(userId);
      console.log(`🔌 Socket reconnected: ${socket.id} (User: ${userId})`);
    });

    // ── Voice / Walkie-Talkie Signaling ──

    // Join a specific voice session (1-to-1 or group)
    socket.on('join-voice', ({ roomId }) => {
      socket.join(`voice:${roomId}`);
      console.log(`🎤 User ${userId} joined voice room: voice:${roomId}`);
      // Notify others in the room that a user joined
      socket.to(`voice:${roomId}`).emit('voice-user-joined', { userId, socketId: socket.id });
    });

    // Leave a specific voice session
    socket.on('leave-voice', ({ roomId }) => {
      socket.leave(`voice:${roomId}`);
      console.log(`🎤 User ${userId} left voice room: voice:${roomId}`);
      socket.to(`voice:${roomId}`).emit('voice-user-left', { userId, socketId: socket.id });
    });

    // WebRTC Offer
    socket.on('voice-offer', ({ target, caller, sdp, roomId }) => {
      // Send offer only to the target user (could be their personal room or specific socket)
      // If target is a user ID, we emit to their personal room
      io.to(target).emit('voice-offer', { caller, sdp, roomId, socketId: socket.id });
    });

    // WebRTC Answer
    socket.on('voice-answer', ({ target, responder, sdp, roomId }) => {
      io.to(target).emit('voice-answer', { responder, sdp, roomId, socketId: socket.id });
    });

    // WebRTC ICE Candidate
    socket.on('voice-ice-candidate', ({ target, sender, candidate, roomId }) => {
      io.to(target).emit('voice-ice-candidate', { sender, candidate, roomId, socketId: socket.id });
    });

    // Push-to-Talk Status
    socket.on('voice-speaking-start', ({ roomId }) => {
      socket.to(`voice:${roomId}`).emit('voice-speaking-start', { userId, socketId: socket.id });
    });

    socket.on('voice-speaking-stop', ({ roomId }) => {
      socket.to(`voice:${roomId}`).emit('voice-speaking-stop', { userId, socketId: socket.id });
    });
  });
};

module.exports = initializeSocket;
