import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import {
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskDeleted,
} from '../features/tasks/taskSlice';
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

    return () => {
      socket.off('task_created');
      socket.off('task_updated');
      socket.off('task_deleted');
      socket.off('gamification_update');
      socket.off('habit_updated');
      disconnectSocket();
    };
  }, [token, dispatch]);

  return getSocket();
};

export default useSocket;

