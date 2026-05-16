import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as habitApi from '../../api/habitApi';

const initialState = {
  items: [],
  isLoading: false,
  error: null,
};

export const fetchAllHabits = createAsyncThunk(
  'habits/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await habitApi.fetchHabits();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch habits');
    }
  }
);

export const addHabit = createAsyncThunk(
  'habits/add',
  async (habitData, { rejectWithValue }) => {
    try {
      const res = await habitApi.createHabit(habitData);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create habit');
    }
  }
);

export const checkHabit = createAsyncThunk(
  'habits/check',
  async (id, { rejectWithValue }) => {
    try {
      const res = await habitApi.completeHabit(id);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to complete habit');
    }
  }
);

export const removeHabit = createAsyncThunk(
  'habits/remove',
  async (id, { rejectWithValue }) => {
    try {
      await habitApi.deleteHabit(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete habit');
    }
  }
);

const habitSlice = createSlice({
  name: 'habits',
  initialState,
  reducers: {
    socketHabitUpdated: (state, action) => {
      const idx = state.items.findIndex((h) => h._id === action.payload._id);
      if (idx !== -1) {
        state.items[idx] = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllHabits.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAllHabits.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(fetchAllHabits.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(addHabit.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(checkHabit.fulfilled, (state, action) => {
        const idx = state.items.findIndex((h) => h._id === action.payload._id);
        if (idx !== -1) {
          state.items[idx] = action.payload;
        }
      })
      .addCase(removeHabit.fulfilled, (state, action) => {
        state.items = state.items.filter((h) => h._id !== action.payload);
      });
  },
});

export const { socketHabitUpdated } = habitSlice.actions;
export default habitSlice.reducer;
