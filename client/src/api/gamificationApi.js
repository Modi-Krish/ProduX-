import API from './axios';

export const fetchGamificationStats = () => API.get('/gamification/stats');
