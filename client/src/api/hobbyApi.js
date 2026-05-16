import API from './axios';

export const fetchHobbies = () => API.get('/hobbies');
export const createHobby = (data) => API.post('/hobbies', data);
export const updateHobbyProgress = (id, minutes) => API.patch(`/hobbies/${id}/progress`, { minutes });
