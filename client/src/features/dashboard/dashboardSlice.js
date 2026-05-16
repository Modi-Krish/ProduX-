import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchDashboardSummary } from '../../api/taskApi';

const initialState = {
  summary: null,
  isLoading: false,
  error: null,
};

export const getDashboard = createAsyncThunk(
  'dashboard/getSummary',
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetchDashboardSummary();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load dashboard');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getDashboard.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getDashboard.fulfilled, (state, action) => {
        state.isLoading = false;
        state.summary = action.payload;
      })
      .addCase(getDashboard.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export default dashboardSlice.reducer;
