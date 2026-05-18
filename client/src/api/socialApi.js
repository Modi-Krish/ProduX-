import API from './axios';

export const fetchLeaderboard = () => API.get('/social/leaderboard');
export const fetchFriends = () => API.get('/social/friends');
export const sendFriendRequest = (recipientId) => API.post('/social/friends/request', { recipientId });
export const respondFriendRequest = (id, status) => API.patch(`/social/friends/${id}`, { status });
export const sendMessage = (receiverId, text) => API.post('/social/messages', { receiverId, text });
export const fetchMessages = (userId) => API.get(`/social/messages/${userId}`);

// Group Chat
export const createGroup = (name, memberIds) => API.post('/social/groups', { name, memberIds });
export const fetchGroups = () => API.get('/social/groups');
export const sendGroupMessage = (groupId, text) => API.post(`/social/groups/${groupId}/messages`, { text });
export const fetchGroupMessages = (groupId) => API.get(`/social/groups/${groupId}/messages`);
export const addGroupMember = (groupId, memberId) => API.post(`/social/groups/${groupId}/members`, { memberId });
export const searchUserById = (customId) => API.get(`/social/users/${customId}`);

