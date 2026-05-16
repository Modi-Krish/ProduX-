import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import taskReducer from '../features/tasks/taskSlice';
import dashboardReducer from '../features/dashboard/dashboardSlice';
import gamificationReducer from '../features/gamification/gamificationSlice';
import habitReducer from '../features/habits/habitSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: taskReducer,
    dashboard: dashboardReducer,
    gamification: gamificationReducer,
    habits: habitReducer,
  },
});

export default store;
