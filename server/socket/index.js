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
  });
};

module.exports = initializeSocket;
