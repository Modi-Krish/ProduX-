import API from './axios';

export const fetchTasks = () => API.get('/tasks');
export const createTask = (data) => API.post('/tasks', data);
export const updateTask = (id, data) => API.put(`/tasks/${id}`, data);
export const deleteTask = (id) => API.delete(`/tasks/${id}`);
export const toggleSubtask = (taskId, subtaskId) => API.patch(`/tasks/${taskId}/subtasks/${subtaskId}`);
export const fetchDashboardSummary = () => API.get('/dashboard/summary');
