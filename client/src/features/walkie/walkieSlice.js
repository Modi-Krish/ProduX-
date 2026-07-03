import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../api/axios';

// Thunks
export const createWalkieRoom = createAsyncThunk(
  'walkie/createRoom',
  async (roomData, { rejectWithValue }) => {
    try {
      const response = await axios.post('/walkie/create', roomData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create room');
    }
  }
);

export const joinWalkieRoom = createAsyncThunk(
  'walkie/joinRoom',
  async (code, { rejectWithValue }) => {
    try {
      const response = await axios.post('/walkie/join', { code });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to join room');
    }
  }
);

export const fetchMyRooms = createAsyncThunk(
  'walkie/fetchMyRooms',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/walkie/my-rooms');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch rooms');
    }
  }
);

export const fetchPublicRooms = createAsyncThunk(
  'walkie/fetchPublicRooms',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/walkie/public');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch public rooms');
    }
  }
);

// Slice
const walkieSlice = createSlice({
  name: 'walkie',
  initialState: {
    myRooms: [],
    publicRooms: [],
    activeRoom: null, // The room user is currently looking at
    loading: false,
    error: null,
  },
  reducers: {
    setActiveRoom: (state, action) => {
      state.activeRoom = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // createWalkieRoom
      .addCase(createWalkieRoom.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createWalkieRoom.fulfilled, (state, action) => {
        state.loading = false;
        state.myRooms.unshift(action.payload);
        state.activeRoom = action.payload;
      })
      .addCase(createWalkieRoom.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // joinWalkieRoom
      .addCase(joinWalkieRoom.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(joinWalkieRoom.fulfilled, (state, action) => {
        state.loading = false;
        // avoid duplicates
        if (!state.myRooms.find(r => r._id === action.payload._id)) {
          state.myRooms.unshift(action.payload);
        }
        state.activeRoom = action.payload;
      })
      .addCase(joinWalkieRoom.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchMyRooms
      .addCase(fetchMyRooms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyRooms.fulfilled, (state, action) => {
        state.loading = false;
        state.myRooms = action.payload;
      })
      .addCase(fetchMyRooms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchPublicRooms
      .addCase(fetchPublicRooms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPublicRooms.fulfilled, (state, action) => {
        state.loading = false;
        state.publicRooms = action.payload;
      })
      .addCase(fetchPublicRooms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setActiveRoom, clearError } = walkieSlice.actions;
export default walkieSlice.reducer;
