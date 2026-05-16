const jwt = require('jsonwebtoken');

/**
 * Initialize Socket.io with auth and room management
 * @param {Object} io - Socket.io server instance
 */
const initializeSocket = (io) => {
  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication error — no token'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error('Authentication error — invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`🔌 Socket connected: ${socket.id} (User: ${userId})`);

    // Join user to their personal room
    socket.join(userId);

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
