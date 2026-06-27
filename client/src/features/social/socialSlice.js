import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as socialApi from '../../api/socialApi';

/**
 * Social Redux Slice
 *
 * BUG-1 FIX: Removed all direct Firestore client-side writes for DMs and group messages.
 * The 'dms' collection that was being written to on the client is gone.
 * All messages now flow through the backend API (/api/social/messages and
 * /api/social/groups/:id/messages) which writes to the single 'messages' collection.
 *
 * This eliminates the dual-storage bug where:
 * - Client wrote to: 'dms' collection (Firestore SDK direct write)
 * - Backend read from: 'messages' collection (GET /api/social/messages/:userId)
 * These were two different collections, so history was invisible through the API.
 */

const initialState = {
  leaderboard: [],
  friends: [],
  pendingRequests: [],
  messages: [],
  activeChatUser: null,
  // Group state
  groups: [],
  activeGroup: null,
  groupMessages: [],
  // Conversations list (DM inbox)
  conversations: [],
  searchedUser: null,
  searchError: null,
  isLoading: false,
  error: null,
};

export const fetchLeaderboard = createAsyncThunk(
  'social/fetchLeaderboard',
  async (_, { rejectWithValue }) => {
    try {
      const res = await socialApi.fetchLeaderboard();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch leaderboard');
    }
  }
);

export const fetchFriends = createAsyncThunk(
  'social/fetchFriends',
  async (_, { rejectWithValue }) => {
    try {
      const res = await socialApi.fetchFriends();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch friends');
    }
  }
);

export const sendFriendReq = createAsyncThunk(
  'social/sendFriendReq',
  async (recipientId, { rejectWithValue }) => {
    try {
      const res = await socialApi.sendFriendRequest(recipientId);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to send request');
    }
  }
);

export const respondFriendReq = createAsyncThunk(
  'social/respondFriendReq',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const res = await socialApi.respondFriendRequest(id, status);
      return { ...res.data.data, respondedStatus: status };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to respond');
    }
  }
);

export const fetchChatMessages = createAsyncThunk(
  'social/fetchMessages',
  async (userId, { rejectWithValue }) => {
    try {
      const res = await socialApi.fetchMessages(userId);
      return { userId, messages: res.data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch messages');
    }
  }
);

/**
 * Send a Direct Message via the backend API.
 *
 * BUG-1 FIX: Previously this thunk had a conditional:
 *   if (isConfigured) { addDoc(collection(db, 'dms'), ...) }
 *   else { API.post('/social/messages', ...) }
 *
 * This caused DMs to go to the 'dms' Firestore collection (client-side), while
 * the backend's GET /api/social/messages/:userId reads from 'messages'.
 * The message history was effectively broken for all production users.
 *
 * FIX: All DMs now ALWAYS go through the backend API, which stores in 'messages'.
 * Web push is handled server-side on send (no separate triggerPushNotification call needed).
 */
export const sendChatMessage = createAsyncThunk(
  'social/sendMessage',
  async ({ receiverId, text, fileUrl, fileType, fileName, fileSize }, { rejectWithValue }) => {
    try {
      const fileData = fileUrl ? { fileUrl, fileType, fileName, fileSize } : {};
      // BUG-1 FIX: Always use backend API — no more direct Firestore 'dms' writes
      const res = await socialApi.sendMessage(receiverId, text, fileData);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.message || err.response?.data?.message || 'Failed to send message');
    }
  }
);

export const markMessagesSeen = createAsyncThunk(
  'social/markMessagesSeen',
  async (senderId, { rejectWithValue }) => {
    try {
      const res = await socialApi.markMessagesSeen(senderId);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark messages as seen');
    }
  }
);

export const fetchConversations = createAsyncThunk(
  'social/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const res = await socialApi.fetchConversations();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch conversations');
    }
  }
);

// ─── GROUP THUNKS ───────────────────────────────────────

export const fetchGroups = createAsyncThunk(
  'social/fetchGroups',
  async (_, { rejectWithValue }) => {
    try {
      const res = await socialApi.fetchGroups();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch groups');
    }
  }
);

export const createGroup = createAsyncThunk(
  'social/createGroup',
  async ({ name, memberIds }, { rejectWithValue }) => {
    try {
      const res = await socialApi.createGroup(name, memberIds);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create group');
    }
  }
);

export const fetchGroupChatMessages = createAsyncThunk(
  'social/fetchGroupMessages',
  async (groupId, { rejectWithValue }) => {
    try {
      const res = await socialApi.fetchGroupMessages(groupId);
      return { groupId, messages: res.data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch group messages');
    }
  }
);

/**
 * Send a group message via backend API.
 *
 * BUG-1 FIX: Previously conditionally wrote to 'groupMessages' Firestore collection
 * client-side when isConfigured was true. Now always uses backend API, which
 * writes to the 'messages' collection consistently.
 */
export const sendGroupChatMessage = createAsyncThunk(
  'social/sendGroupMessage',
  async ({ groupId, text, fileUrl, fileType, fileName, fileSize }, { rejectWithValue }) => {
    try {
      const fileData = fileUrl ? { fileUrl, fileType, fileName, fileSize } : {};
      // BUG-1 FIX: Always use backend API — no more direct Firestore 'groupMessages' writes
      const res = await socialApi.sendGroupMessage(groupId, text, fileData);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.message || err.response?.data?.message || 'Failed to send group message');
    }
  }
);

export const addGroupMember = createAsyncThunk(
  'social/addGroupMember',
  async ({ groupId, memberId }, { rejectWithValue }) => {
    try {
      const res = await socialApi.addGroupMember(groupId, memberId);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add group member');
    }
  }
);

export const searchUser = createAsyncThunk(
  'social/searchUser',
  async (customId, { rejectWithValue }) => {
    try {
      const res = await socialApi.searchUserById(customId);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'User not found');
    }
  }
);

const socialSlice = createSlice({
  name: 'social',
  initialState,
  reducers: {
    setActiveChatUser: (state, action) => {
      state.activeChatUser = action.payload;
      state.activeGroup = null;
      state.groupMessages = [];
    },
    clearChat: (state) => {
      state.activeChatUser = null;
      state.messages = [];
    },
    setActiveGroup: (state, action) => {
      state.activeGroup = action.payload;
      state.activeChatUser = null;
      state.messages = [];
    },
    clearGroupChat: (state) => {
      state.activeGroup = null;
      state.groupMessages = [];
    },
    clearSearch: (state) => {
      state.searchedUser = null;
      state.searchError = null;
    },
    socketNewMessage: (state, action) => {
      const msg = action.payload;
      if (
        state.activeChatUser &&
        (msg.senderId?._id === state.activeChatUser._id ||
          msg.receiverId?._id === state.activeChatUser._id)
      ) {
        const exists = state.messages.some((m) => m._id === msg._id);
        if (!exists) state.messages.push(msg);
      }
    },
    socketUpdateConversation: (state, action) => {
      const { partnerId, partnerName, partnerLevel, partnerXp, lastMessage, lastMessageAt, lastSenderId, isFromMe } = action.payload;
      const existingIdx = state.conversations.findIndex(
        (c) => c.partnerId === partnerId || c._id === partnerId
      );

      if (existingIdx !== -1) {
        const conv = { ...state.conversations[existingIdx] };
        conv.lastMessage = lastMessage;
        conv.lastMessageAt = lastMessageAt;
        conv.lastSenderId = lastSenderId;
        if (!isFromMe && (!state.activeChatUser || state.activeChatUser._id !== partnerId)) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }
        state.conversations.splice(existingIdx, 1);
        state.conversations.unshift(conv);
      } else {
        state.conversations.unshift({
          _id: partnerId,
          partnerId,
          partnerName: partnerName || 'Unknown',
          partnerLevel: partnerLevel || 1,
          partnerXp: partnerXp || 0,
          lastMessage,
          lastMessageAt,
          lastSenderId,
          unreadCount: isFromMe ? 0 : 1,
        });
      }
    },
    clearConversationUnread: (state, action) => {
      const partnerId = action.payload;
      const conv = state.conversations.find(
        (c) => c.partnerId === partnerId || c._id === partnerId
      );
      if (conv) conv.unreadCount = 0;
    },
    socketMessagesSeen: (state, action) => {
      const { messageIds, seenAt } = action.payload;
      state.messages.forEach((msg) => {
        if (messageIds.includes(msg._id)) {
          msg.status = 'seen';
          msg.seenAt = seenAt;
          msg.read = true;
        }
      });
    },
    socketGroupMessage: (state, action) => {
      const msg = action.payload;
      if (state.activeGroup && msg.groupId === state.activeGroup._id) {
        const exists = state.groupMessages.some((m) => m._id === msg._id);
        if (!exists) state.groupMessages.push(msg);
      }
    },
    socketFriendRequest: (state, action) => {
      state.pendingRequests.push(action.payload.from);
    },
    socketGroupCreated: (state, action) => {
      const exists = state.groups.some((g) => g._id === action.payload._id);
      if (!exists) state.groups.unshift(action.payload);
    },
    socketGroupMemberAdded: (state, action) => {
      const { groupId, group } = action.payload;
      state.groups = state.groups.map((g) => (g._id === groupId ? group : g));
      if (state.activeGroup && state.activeGroup._id === groupId) {
        state.activeGroup = group;
      }
    },
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    setGroupMessages: (state, action) => {
      state.groupMessages = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeaderboard.pending, (state) => { state.isLoading = true; })
      .addCase(fetchLeaderboard.fulfilled, (state, action) => {
        state.isLoading = false;
        state.leaderboard = action.payload;
      })
      .addCase(fetchLeaderboard.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchFriends.fulfilled, (state, action) => {
        state.friends = action.payload.friends;
        state.pendingRequests = action.payload.pending;
      })
      .addCase(respondFriendReq.fulfilled, (state, action) => {
        state.pendingRequests = state.pendingRequests.filter(
          (r) => r.friendshipId !== action.payload._id
        );
      })
      .addCase(fetchChatMessages.fulfilled, (state, action) => {
        state.messages = action.payload.messages;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        const exists = state.messages.some((m) => m._id === action.payload._id);
        if (!exists) state.messages.push(action.payload);
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
      })
      .addCase(fetchGroups.fulfilled, (state, action) => {
        state.groups = action.payload;
      })
      .addCase(createGroup.fulfilled, (state, action) => {
        state.groups.unshift(action.payload);
      })
      .addCase(fetchGroupChatMessages.fulfilled, (state, action) => {
        state.groupMessages = action.payload.messages;
      })
      .addCase(sendGroupChatMessage.fulfilled, (state, action) => {
        const exists = state.groupMessages.some((m) => m._id === action.payload._id);
        if (!exists) state.groupMessages.push(action.payload);
      })
      .addCase(addGroupMember.fulfilled, (state, action) => {
        const updatedGroup = action.payload;
        state.groups = state.groups.map((g) => (g._id === updatedGroup._id ? updatedGroup : g));
        if (state.activeGroup && state.activeGroup._id === updatedGroup._id) {
          state.activeGroup = updatedGroup;
        }
      })
      .addCase(searchUser.fulfilled, (state, action) => {
        state.searchedUser = action.payload;
        state.searchError = null;
      })
      .addCase(searchUser.rejected, (state, action) => {
        state.searchedUser = null;
        state.searchError = action.payload;
      });
  },
});

export const {
  setActiveChatUser,
  clearChat,
  setActiveGroup,
  clearGroupChat,
  clearSearch,
  socketNewMessage,
  socketUpdateConversation,
  clearConversationUnread,
  socketMessagesSeen,
  socketGroupMessage,
  socketFriendRequest,
  socketGroupCreated,
  socketGroupMemberAdded,
  setMessages,
  setGroupMessages,
} = socialSlice.actions;

export default socialSlice.reducer;
