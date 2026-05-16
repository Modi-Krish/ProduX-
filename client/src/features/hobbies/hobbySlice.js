import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as hobbyApi from '../../api/hobbyApi';

const initialState = {
  items: [],
  isLoading: false,
  error: null,
};

export const fetchAllHobbies = createAsyncThunk(
  'hobbies/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await hobbyApi.fetchHobbies();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch hobbies');
    }
  }
);

export const addHobby = createAsyncThunk(
  'hobbies/add',
  async (hobbyData, { rejectWithValue }) => {
    try {
      const res = await hobbyApi.createHobby(hobbyData);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create hobby');
    }
  }
);

export const progressHobby = createAsyncThunk(
  'hobbies/progress',
  async ({ id, minutes }, { rejectWithValue }) => {
    try {
      const res = await hobbyApi.updateHobbyProgress(id, minutes);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update progress');
    }
  }
);

const hobbySlice = createSlice({
  name: 'hobbies',
  initialState,
  reducers: {
    socketHobbyUpdated: (state, action) => {
      const idx = state.items.findIndex((h) => h._id === action.payload._id);
      if (idx !== -1) {
        state.items[idx] = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllHobbies.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAllHobbies.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(fetchAllHobbies.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(addHobby.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(progressHobby.fulfilled, (state, action) => {
        const idx = state.items.findIndex((h) => h._id === action.payload._id);
        if (idx !== -1) {
          state.items[idx] = action.payload;
        }
      });
  },
});

export const { socketHobbyUpdated } = hobbySlice.actions;
export default hobbySlice.reducer;
