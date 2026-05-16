import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchGamificationStats } from '../../api/gamificationApi';

const initialState = {
  stats: null,
  isLoading: false,
  error: null,
  // Notification queue for level-ups and badges
  notifications: [],
};

export const getGamificationStats = createAsyncThunk(
  'gamification/getStats',
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetchGamificationStats();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to load gamification stats'
      );
    }
  }
);

const gamificationSlice = createSlice({
  name: 'gamification',
  initialState,
  reducers: {
    // Called when a socket gamification_update event fires
    applyGamificationUpdate: (state, action) => {
      const data = action.payload;
      if (state.stats) {
        state.stats.xp = data.newXP;
        state.stats.level = data.newLevel;
        state.stats.streak = data.newStreak;
        state.stats.longestStreak = data.longestStreak;
        state.stats.totalTasksCompleted = data.totalTasksCompleted;
        state.stats.xpForCurrentLevel = data.xpForCurrentLevel;
        state.stats.xpForNextLevel = data.xpForNextLevel;

        // Mark newly earned badges
        if (data.newBadges?.length > 0 && state.stats.allBadges) {
          data.newBadges.forEach((nb) => {
            const idx = state.stats.allBadges.findIndex((b) => b.id === nb.id);
            if (idx !== -1) {
              state.stats.allBadges[idx].earned = true;
              state.stats.allBadges[idx].earnedAt = nb.earnedAt;
            }
          });
          state.stats.badges = [
            ...state.stats.badges,
            ...data.newBadges,
          ];
        }
      }

      // Queue notifications
      if (data.leveledUp) {
        state.notifications.push({
          type: 'level_up',
          level: data.newLevel,
          id: `level_${data.newLevel}_${Date.now()}`,
        });
      }
      if (data.newBadges?.length > 0) {
        data.newBadges.forEach((badge) => {
          state.notifications.push({
            type: 'badge',
            badge,
            id: `badge_${badge.id}_${Date.now()}`,
          });
        });
      }
      // Always push XP notification
      state.notifications.push({
        type: 'xp',
        xpGained: data.xpGained,
        id: `xp_${Date.now()}`,
      });
    },
    dismissNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        (n) => n.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getGamificationStats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getGamificationStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
      })
      .addCase(getGamificationStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  applyGamificationUpdate,
  dismissNotification,
  clearNotifications,
} = gamificationSlice.actions;

export default gamificationSlice.reducer;
