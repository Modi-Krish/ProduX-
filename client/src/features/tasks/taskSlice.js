import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as taskApi from '../../api/taskApi';

const initialState = {
  items: [],
  isLoading: false,
  error: null,
};

// Fetch all tasks
export const fetchAllTasks = createAsyncThunk(
  'tasks/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await taskApi.fetchTasks();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch tasks');
    }
  }
);

// Create task
export const addTask = createAsyncThunk(
  'tasks/add',
  async (taskData, { rejectWithValue }) => {
    try {
      const res = await taskApi.createTask(taskData);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create task');
    }
  }
);

// Update task
export const editTask = createAsyncThunk(
  'tasks/edit',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await taskApi.updateTask(id, data);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update task');
    }
  }
);

// Delete task
export const removeTask = createAsyncThunk(
  'tasks/remove',
  async (id, { rejectWithValue }) => {
    try {
      await taskApi.deleteTask(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete task');
    }
  }
);

export const setSubtaskStatus = createAsyncThunk(
  'tasks/toggleSubtask',
  async ({ taskId, subtaskId }, { rejectWithValue }) => {
    try {
      const res = await taskApi.toggleSubtask(taskId, subtaskId);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to toggle subtask');
    }
  }
);

const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    // Socket event handlers — idempotent (upsert by _id)
    socketTaskCreated: (state, action) => {
      const exists = state.items.find((t) => t._id === action.payload._id);
      if (!exists) {
        state.items.unshift(action.payload);
      }
    },
    socketTaskUpdated: (state, action) => {
      const idx = state.items.findIndex((t) => t._id === action.payload._id);
      if (idx !== -1) {
        state.items[idx] = action.payload;
      } else {
        state.items.unshift(action.payload);
      }
    },
    socketTaskDeleted: (state, action) => {
      state.items = state.items.filter((t) => t._id !== action.payload.taskId);
    },
    clearTaskError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchAllTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(fetchAllTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Add
      .addCase(addTask.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(addTask.fulfilled, (state, action) => {
        state.isLoading = false;
        const exists = state.items.find((t) => t._id === action.payload._id);
        if (!exists) {
          state.items.unshift(action.payload);
        }
      })
      .addCase(addTask.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Edit
      .addCase(editTask.fulfilled, (state, action) => {
        const idx = state.items.findIndex((t) => t._id === action.payload._id);
        if (idx !== -1) {
          state.items[idx] = action.payload;
        }
      })
      .addCase(editTask.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Remove
      .addCase(removeTask.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t._id !== action.payload);
      })
      .addCase(removeTask.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const {
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskDeleted,
  clearTaskError,
} = taskSlice.actions;
export default taskSlice.reducer;
