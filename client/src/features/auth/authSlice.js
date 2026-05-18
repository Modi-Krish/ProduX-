import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { registerUser, loginUser, getMe } from '../../api/authApi';

// Get user from localStorage
const user = JSON.parse(localStorage.getItem('user'));
const token = localStorage.getItem('token');

const initialState = {
  user: user || null,
  token: token || null,
  isLoading: false,
  error: null,
};

// Register
export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const res = await registerUser(userData);
      const { token, ...user } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      return res.data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Registration failed'
      );
    }
  }
);

// Login
export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const res = await loginUser(credentials);
      const { token, ...user } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      return res.data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Login failed'
      );
    }
  }
);

// Fetch Current User
export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const res = await getMe();
      const user = res.data.data;
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch profile'
      );
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = {
          _id: action.payload._id,
          name: action.payload.name,
          email: action.payload.email,
          customId: action.payload.customId,
          xp: action.payload.xp || 0,
          level: action.payload.level || 1,
          streak: action.payload.streak || 0,
          longestStreak: action.payload.longestStreak || 0,
          totalTasksCompleted: action.payload.totalTasksCompleted || 0,
          badges: action.payload.badges || [],
        };
        state.token = action.payload.token;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = {
          _id: action.payload._id,
          name: action.payload.name,
          email: action.payload.email,
          customId: action.payload.customId,
          xp: action.payload.xp || 0,
          level: action.payload.level || 1,
          streak: action.payload.streak || 0,
          longestStreak: action.payload.longestStreak || 0,
          totalTasksCompleted: action.payload.totalTasksCompleted || 0,
          badges: action.payload.badges || [],
        };
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch Current User
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = {
          _id: action.payload._id,
          name: action.payload.name,
          email: action.payload.email,
          customId: action.payload.customId,
          xp: action.payload.xp || 0,
          level: action.payload.level || 1,
          streak: action.payload.streak || 0,
          longestStreak: action.payload.longestStreak || 0,
          totalTasksCompleted: action.payload.totalTasksCompleted || 0,
          badges: action.payload.badges || [],
        };
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
