import API from './axios';

export const fetchHabits = () => API.get('/habits');
export const createHabit = (data) => API.post('/habits', data);
export const completeHabit = (id) => API.post(`/habits/${id}/complete`);
export const deleteHabit = (id) => API.delete(`/habits/${id}`);
