import API from './axios';

export const generateSubtasks = (title, description) => API.post('/ai/breakdown', { title, description });
