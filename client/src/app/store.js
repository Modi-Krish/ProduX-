import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import taskReducer from '../features/tasks/taskSlice';
import dashboardReducer from '../features/dashboard/dashboardSlice';
import gamificationReducer from '../features/gamification/gamificationSlice';
import habitReducer from '../features/habits/habitSlice';
import hobbyReducer from '../features/hobbies/hobbySlice';
import socialReducer from '../features/social/socialSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: taskReducer,
    dashboard: dashboardReducer,
    gamification: gamificationReducer,
    habits: habitReducer,
    hobbies: hobbyReducer,
    social: socialReducer,
  },
});

export default store;
