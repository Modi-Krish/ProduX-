import API from './axios';

export const fetchLeaderboard = () => API.get('/social/leaderboard');
export const fetchFriends = () => API.get('/social/friends');
export const sendFriendRequest = (recipientId) => API.post('/social/friends/request', { recipientId });
export const respondFriendRequest = (id, status) => API.patch(`/social/friends/${id}`, { status });
export const sendMessage = (receiverId, text) => API.post('/social/messages', { receiverId, text });
export const fetchMessages = (userId) => API.get(`/social/messages/${userId}`);
