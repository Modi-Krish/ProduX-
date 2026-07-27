import { io } from 'socket.io-client';
import { auth } from './firebase';

let socket = null;

const SOCKET_URL = import.meta.env.VITE_API_URL || '/';

export const connectSocket = (token) => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', async (err) => {
    console.error('🔌 Socket connection error:', err.message);
    if (err.message.includes('Authentication error')) {
      console.log('Attempting to refresh token due to socket auth error...');
      try {
        if (auth && auth.currentUser) {
          await auth.currentUser.getIdToken(true); // Forces a refresh, App.jsx listener will update Redux
        }
      } catch (refreshErr) {
        console.error('Failed to refresh token after socket auth error:', refreshErr);
      }
    }
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
