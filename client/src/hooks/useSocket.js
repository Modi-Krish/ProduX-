import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import store from '../app/store';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import {
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskDeleted,
} from '../features/tasks/taskSlice';
import { socketHabitUpdated } from '../features/habits/habitSlice';
import { socketHobbyUpdated } from '../features/hobbies/hobbySlice';
import {
  socketNewMessage,
  socketGroupMessage,
  socketFriendRequest,
  socketGroupCreated,
  socketGroupMemberAdded,
} from '../features/social/socialSlice';
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

    // Social events — DM
    socket.on('new_message', (msg) => {
      dispatch(socketNewMessage(msg));
      
      const state = store.getState();
      const currentUser = state.auth.user;
      const { activeChatUser } = state.social;
      
      // Notify if message is not from current user and we aren't currently viewing this chat
      if (currentUser && msg.senderId._id !== currentUser._id) {
        if (!activeChatUser || activeChatUser._id !== msg.senderId._id) {
          toast(`New message from ${msg.senderId.name}`, { icon: '💬' });
        }
      }
    });

    socket.on('friend_request', (data) => {
      dispatch(socketFriendRequest(data));
      
      const state = store.getState();
      const currentUser = state.auth.user;
      if (currentUser && data.senderId !== currentUser._id) {
        toast(`New friend request from ${data.name || 'someone'}`, { icon: '👋' });
      }
    });

    // Social events — Group
    socket.on('group_message', (msg) => {
      dispatch(socketGroupMessage(msg));
      
      const state = store.getState();
      const currentUser = state.auth.user;
      const { groups, activeGroup } = state.social;
      
      // Notify if message is not from current user and we aren't currently viewing this group
      if (currentUser && msg.senderId._id !== currentUser._id) {
        if (!activeGroup || activeGroup._id !== msg.groupId) {
          const group = groups.find(g => g._id === msg.groupId);
          const groupName = group ? group.name : 'a group';
          toast(`New message in ${groupName} from ${msg.senderId.name}`, { icon: '💬' });
        }
      }
    });

    socket.on('group_created', (group) => {
      dispatch(socketGroupCreated(group));
    });

    socket.on('group_member_added', (data) => {
      dispatch(socketGroupMemberAdded(data));
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
      socket.off('group_message');
      socket.off('group_created');
      socket.off('group_member_added');
      disconnectSocket();
    };
  }, [token, dispatch]);

  return getSocket();
};

export default useSocket;
