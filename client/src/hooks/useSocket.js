import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import {
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskDeleted,
} from '../features/tasks/taskSlice';
import { socketHabitUpdated } from '../features/habits/habitSlice';
import { socketHobbyUpdated } from '../features/hobbies/hobbySlice';
import { socketNewMessage, socketFriendRequest } from '../features/social/socialSlice';
import { getDashboard } from '../features/dashboard/dashboardSlice';
import { applyGamificationUpdate } from '../features/gamification/gamificationSlice';

/**
 * Custom hook that manages socket connection lifecycle and
 * dispatches Redux actions on incoming socket events.
 */
const useSocket = () => {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);

    // Listen for task events
    socket.on('task_created', (task) => {
      dispatch(socketTaskCreated(task));
      dispatch(getDashboard());
    });

    socket.on('task_updated', (task) => {
      dispatch(socketTaskUpdated(task));
      dispatch(getDashboard());
    });

    socket.on('task_deleted', (data) => {
      dispatch(socketTaskDeleted(data));
      dispatch(getDashboard());
    });

    // Listen for gamification events
    socket.on('gamification_update', (data) => {
      dispatch(applyGamificationUpdate(data));
    });

    socket.on('habit_updated', (habit) => {
      dispatch(socketHabitUpdated(habit));
    });

    socket.on('hobby_updated', (hobby) => {
      dispatch(socketHobbyUpdated(hobby));
    });

    // Social events
    socket.on('new_message', (msg) => {
      dispatch(socketNewMessage(msg));
    });

    socket.on('friend_request', (data) => {
      dispatch(socketFriendRequest(data));
    });

    return () => {
      socket.off('task_created');
      socket.off('task_updated');
      socket.off('task_deleted');
      socket.off('gamification_update');
      socket.off('habit_updated');
      socket.off('hobby_updated');
      socket.off('new_message');
      socket.off('friend_request');
      disconnectSocket();
    };
  }, [token, dispatch]);

  return getSocket();
};

export default useSocket;

