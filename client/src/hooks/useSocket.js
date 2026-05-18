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
import axios from 'axios';

// API base URL for axios requests
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Helper to convert Base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Helper to send native browser push notifications when the app is in the background
 */
const sendNativeNotification = (title, body) => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          body,
          icon: '/favicon.ico',
        });
      });
    } else {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    }
  }
};

/**
 * Custom hook that manages socket connection lifecycle and
 * dispatches Redux actions on incoming socket events.
 */
const useSocket = () => {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!token) return;

    // Web Push Subscription Helper
    const subscribeUserToPush = async (registration) => {
      try {
        const publicVapidKey = import.meta.env.VITE_PUBLIC_VAPID_KEY;
        if (!publicVapidKey) return;
        
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
          });
        }
        
        // Send subscription to our server
        await axios.post(`${API_URL}/api/social/subscribe`, subscription, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Web Push subscription failed:', err);
      }
    };

    // Setup Web Push and Service Worker
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        if (Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') subscribeUserToPush(registration);
          });
        } else if (Notification.permission === 'granted') {
          subscribeUserToPush(registration);
        }
      }).catch(err => console.error('Service Worker Registration Failed:', err));
    }

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
          const title = `New message from ${msg.senderId.name}`;
          toast(title, { icon: '💬' });
          sendNativeNotification(title, msg.text);
        }
      }
    });

    socket.on('friend_request', (data) => {
      dispatch(socketFriendRequest(data));
      
      const state = store.getState();
      const currentUser = state.auth.user;
      if (currentUser && data.senderId !== currentUser._id) {
        const title = `New friend request from ${data.name || 'someone'}`;
        toast(title, { icon: '👋' });
        sendNativeNotification(title, 'You have a new friend request pending!');
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
          const title = `New message in ${groupName}`;
          toast(`${title} from ${msg.senderId.name}`, { icon: '💬' });
          sendNativeNotification(title, `${msg.senderId.name}: ${msg.text}`);
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
