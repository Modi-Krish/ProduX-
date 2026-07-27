import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../api/firebase';
import { registerUser, loginUser, getMe, deleteAccountUser, updateProfileUser } from '../../api/authApi';

// Get user from localStorage
const user = JSON.parse(localStorage.getItem('user'));
const token = localStorage.getItem('token');

const initialState = {
  user: user || null,
  token: token || null,
  isInitialized: false,
  isLoading: false,
  error: null,
};


// Register via Firebase and then Backend Firestore initialization
export const register = createAsyncThunk(
  'auth/register',
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      if (!auth) {
        throw new Error('Firebase Authentication is not configured.');
      }
      // 1. Create account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // 2. Fetch the newly created ID token
      const idToken = await userCredential.user.getIdToken(true);
      
      // Save token temporarily so subsequent axios interceptor call succeeds
      localStorage.setItem('token', idToken);

      // 3. Register user profile document in backend Firestore collection
      const res = await registerUser({ name });
      const userProfile = res.data.data;

      localStorage.setItem('user', JSON.stringify(userProfile));
      return { user: userProfile, token: idToken };
    } catch (err) {
      console.error('Registration Thunk Error:', err);
      return rejectWithValue(
        err.response?.data?.message || err.message || 'Registration failed'
      );
    }
  }
);

// Login via Firebase and then Backend Firestore sync
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      if (!auth) {
        throw new Error('Firebase Authentication is not configured.');
      }
      // 1. Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // 2. Retrieve dynamic Firebase ID Token
      const idToken = await userCredential.user.getIdToken(true);

      // Save token temporarily so interceptor works
      localStorage.setItem('token', idToken);

      // 3. Retrieve user profile document from Firestore backend
      const res = await loginUser();
      const userProfile = res.data.data;

      localStorage.setItem('user', JSON.stringify(userProfile));
      return { user: userProfile, token: idToken };
    } catch (err) {
      console.error('Login Thunk Error:', err);
      return rejectWithValue(
        err.response?.data?.message || err.message || 'Login failed'
      );
    }
  }
);

// Deprecated Google Auth placeholder
export const googleAuth = createAsyncThunk(
  'auth/googleAuth',
  async (_, { rejectWithValue }) => {
    return rejectWithValue('Google sign-in is disabled. Please use standard Email/Password authentication.');
  }
);

// Fetch Current User Profile
export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const res = await getMe();
      const userProfile = res.data.data;
      localStorage.setItem('user', JSON.stringify(userProfile));
      return userProfile;
    } catch (err) {
      console.error('Fetch Current User Error:', err);
      return rejectWithValue(
        err.response?.data?.message || err.message || 'Failed to fetch profile'
      );
    }
  }
);

// Update User Profile
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const res = await updateProfileUser(profileData);
      const userProfile = res.data.data;
      localStorage.setItem('user', JSON.stringify(userProfile));
      return userProfile;
    } catch (err) {
      console.error('Update Profile Error:', err);
      return rejectWithValue(
        err.response?.data?.message || err.message || 'Failed to update profile'
      );
    }
  }
);

// Delete Account permanently
export const deleteAccount = createAsyncThunk(
  'auth/deleteAccount',
  async (_, { rejectWithValue }) => {
    try {
      const res = await deleteAccountUser();
      if (auth && auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (firebaseAuthErr) {
          console.warn('Firebase Auth user deletion on client skipped (already handled by backend):', firebaseAuthErr.message);
        }
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return res.data.message;
    } catch (err) {
      console.error('Delete Account Thunk Error:', err);
      return rejectWithValue(
        err.response?.data?.message || err.message || 'Failed to delete account'
      );
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    restoreCredentials: (state, action) => {
      state.token = action.payload.token || null;
      state.user = action.payload.user || null;
      state.isInitialized = true;
      if (state.token) {
        localStorage.setItem('token', state.token);
      } else {
        localStorage.removeItem('token');
      }
      if (state.user) {
        localStorage.setItem('user', JSON.stringify(state.user));
      } else {
        localStorage.removeItem('user');
      }
    },
    logout: (state) => {
      if (auth) {
        signOut(auth).catch((err) => console.error('Firebase sign-out error:', err));
      }
      state.user = null;
      state.token = null;
      state.isInitialized = true;
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
        state.user = action.payload.user;
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
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch Current User
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.user = null;
        state.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      // Update Profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete Account
      .addCase(deleteAccount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteAccount.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.error = null;
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { logout, clearError, restoreCredentials } = authSlice.actions;
export default authSlice.reducer;

