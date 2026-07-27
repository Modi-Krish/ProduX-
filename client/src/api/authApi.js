import API from './axios';

export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser = (data) => API.post('/auth/login', data);
export const googleLoginUser = (data) => API.post('/auth/google', data);
export const getMe = () => API.get('/auth/me');
export const updateProfileUser = (data) => API.put('/auth/profile', data);
export const updatePinsUser = (data) => API.put('/auth/pins', data);
export const verifyPinUser = (data) => API.post('/auth/verify-pin', data);
export const deleteAccountUser = () => API.delete('/auth/delete-account');
