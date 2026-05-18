import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as socialApi from '../../api/socialApi';

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

export const sendChatMessage = createAsyncThunk(
  'social/sendMessage',
  async ({ receiverId, text }, { rejectWithValue }) => {
    try {
      const res = await socialApi.sendMessage(receiverId, text);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to send message');
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

export const sendGroupChatMessage = createAsyncThunk(
  'social/sendGroupMessage',
  async ({ groupId, text }, { rejectWithValue }) => {
    try {
      const res = await socialApi.sendGroupMessage(groupId, text);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to send group message');
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
    socketNewMessage: (state, action) => {
      const msg = action.payload;
      // Only add if relevant to current DM chat
      if (
        state.activeChatUser &&
        (msg.senderId?._id === state.activeChatUser._id ||
          msg.receiverId?._id === state.activeChatUser._id)
      ) {
        const exists = state.messages.some((m) => m._id === msg._id);
        if (!exists) state.messages.push(msg);
      }
    },
    socketGroupMessage: (state, action) => {
      const msg = action.payload;
      // Only add if relevant to the currently open group chat
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
      // Groups
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
      });
  },
});

export const {
  setActiveChatUser,
  clearChat,
  setActiveGroup,
  clearGroupChat,
  socketNewMessage,
  socketGroupMessage,
  socketFriendRequest,
  socketGroupCreated,
} = socialSlice.actions;
export default socialSlice.reducer;
