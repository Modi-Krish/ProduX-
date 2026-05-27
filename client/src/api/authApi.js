import API from './axios';

export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser = (data) => API.post('/auth/login', data);
export const googleLoginUser = (data) => API.post('/auth/google', data);
export const getMe = () => API.get('/auth/me');
export const deleteAccountUser = () => API.delete('/auth/delete-account');
