import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchLeaderboard,
  fetchFriends,
  sendFriendReq,
  respondFriendReq,
  fetchChatMessages,
  sendChatMessage,
  setActiveChatUser,
  clearChat,
  fetchGroups,
  createGroup,
  fetchGroupChatMessages,
  sendGroupChatMessage,
  setActiveGroup,
  clearGroupChat,
} from '../features/social/socialSlice';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import useSocket from '../hooks/useSocket';
import {
  HiUserAdd,
  HiCheck,
  HiX,
  HiChat,
  HiChevronLeft,
  HiTrendingUp,
  HiUsers,
  HiLightningBolt,
  HiFire,
  HiStar,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const Social = () => {
  const dispatch = useDispatch();
  const { leaderboard, friends, pendingRequests, messages, activeChatUser, groups, activeGroup, groupMessages, isLoading } =
    useSelector((state) => state.social);
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [chatText, setChatText] = useState('');
  
  // Group creation modal state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  
  const chatEndRef = useRef(null);

  // Connect socket so real-time messages work on this page
  useSocket();

  useEffect(() => {
    dispatch(fetchLeaderboard());
    dispatch(fetchFriends());
  }, [dispatch]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, groupMessages]);

  const handleAddFriend = async (recipientId) => {
    try {
      await dispatch(sendFriendReq(recipientId)).unwrap();
      toast.success('Friend request sent!');
    } catch (err) {
      toast.error(err || 'Failed to send');
    }
  };

  const handleRespondRequest = async (friendshipId, status) => {
    try {
      await dispatch(respondFriendReq({ id: friendshipId, status })).unwrap();
      dispatch(fetchFriends());
      toast.success(status === 'accepted' ? 'Friend added!' : 'Request declined');
    } catch (err) {
      toast.error(err || 'Failed');
    }
  };

  const openChat = (friendUser) => {
    dispatch(setActiveChatUser(friendUser));
    dispatch(fetchChatMessages(friendUser._id));
  };

  const openGroupChat = (group) => {
    dispatch(setActiveGroup(group));
    dispatch(fetchGroupChatMessages(group._id));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || !activeChatUser) return;
    try {
      await dispatch(sendChatMessage({ receiverId: activeChatUser._id, text: chatText })).unwrap();
      setChatText('');
    } catch (err) {
      toast.error(err || 'Failed to send');
    }
  };

  const handleSendGroupMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || !activeGroup) return;
    try {
      await dispatch(sendGroupChatMessage({ groupId: activeGroup._id, text: chatText })).unwrap();
      setChatText('');
    } catch (err) {
      toast.error(err || 'Failed to send');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      return toast.error('Group name is required');
    }
    if (selectedMembers.length === 0) {
      return toast.error('Select at least one friend');
    }
    try {
      await dispatch(createGroup({ name: groupName, memberIds: selectedMembers })).unwrap();
      toast.success('Group created successfully!');
      setGroupName('');
      setSelectedMembers([]);
      setShowCreateGroup(false);
      dispatch(fetchGroups());
    } catch (err) {
      toast.error(err || 'Failed to create group');
    }
  };

  const toggleMemberSelection = (friendId) => {
    setSelectedMembers((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const isSelf = (id) => user?._id === id;
  const isFriend = (id) => friends.some((f) => f._id === id);

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <>
      <Navbar />
      <div className="social-page">
        <div className="social-header">
          <h1>
            <HiTrendingUp /> Community
          </h1>
          <p>Compete, connect, and collaborate with fellow achievers.</p>
        </div>

        {/* Tab Navigation */}
        <div className="social-tabs">
          <button
            className={`social-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            <HiTrendingUp /> Leaderboard
          </button>
          <button
            className={`social-tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => { setActiveTab('friends'); dispatch(clearChat()); dispatch(clearGroupChat()); }}
          >
            <HiUsers /> Friends
            {pendingRequests.length > 0 && (
              <span className="tab-badge">{pendingRequests.length}</span>
            )}
          </button>
          <button
            className={`social-tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => { 
              setActiveTab('groups'); 
              dispatch(clearChat()); 
              dispatch(clearGroupChat());
              dispatch(fetchGroups());
            }}
          >
            <HiStar /> Groups
          </button>
        </div>

        {/* ── LEADERBOARD TAB ── */}
        {activeTab === 'leaderboard' && (
          <div className="leaderboard-container">
            {/* Top 3 Podium */}
            <div className="podium">
              {leaderboard.slice(0, 3).map((u, i) => (
                <div key={u._id} className={`podium-card rank-${i + 1}`}>
                  <div className="podium-rank">{getRankIcon(i + 1)}</div>
                  <div className="podium-avatar">{u.name.charAt(0).toUpperCase()}</div>
                  <div className="podium-name">{u.name}</div>
                  <div className="podium-xp">
                    <HiLightningBolt /> {u.xp} XP
                  </div>
                  <div className="podium-meta">
                    Lv.{u.level} · <HiFire /> {u.streak}
                  </div>
                  {!isSelf(u._id) && !isFriend(u._id) && (
                    <button className="btn-add-friend" onClick={() => handleAddFriend(u._id)}>
                      <HiUserAdd />
                    </button>
                  )}
                  {isSelf(u._id) && <span className="you-badge">You</span>}
                </div>
              ))}
            </div>

            {/* Rest of the table */}
            <div className="leaderboard-list">
              {leaderboard.slice(3).map((u) => (
                <div key={u._id} className={`lb-row ${isSelf(u._id) ? 'lb-self' : ''}`}>
                  <span className="lb-rank">{getRankIcon(u.rank)}</span>
                  <div className="lb-avatar">{u.name.charAt(0).toUpperCase()}</div>
                  <div className="lb-info">
                    <span className="lb-name">{u.name} {isSelf(u._id) && <span className="you-badge-sm">You</span>}</span>
                    <span className="lb-stats">
                      Lv.{u.level} · {u.totalTasksCompleted} tasks · <HiFire /> {u.streak}
                    </span>
                  </div>
                  <div className="lb-xp">
                    <HiLightningBolt /> {u.xp}
                  </div>
                  {!isSelf(u._id) && !isFriend(u._id) && (
                    <button className="btn-ghost" onClick={() => handleAddFriend(u._id)} title="Add Friend">
                      <HiUserAdd />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FRIENDS TAB ── */}
        {activeTab === 'friends' && !activeChatUser && (
          <div className="friends-container">
            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div className="pending-section">
                <h3>Pending Requests</h3>
                {pendingRequests.map((r) => (
                  <div key={r.friendshipId} className="pending-card">
                    <div className="pending-avatar">{r.name.charAt(0).toUpperCase()}</div>
                    <div className="pending-info">
                      <span className="pending-name">{r.name}</span>
                      <span className="pending-level">Lv.{r.level} · {r.xp} XP</span>
                    </div>
                    <div className="pending-actions">
                      <button
                        className="btn-accept"
                        onClick={() => handleRespondRequest(r.friendshipId, 'accepted')}
                      >
                        <HiCheck /> Accept
                      </button>
                      <button
                        className="btn-decline"
                        onClick={() => handleRespondRequest(r.friendshipId, 'rejected')}
                      >
                        <HiX />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Friend List */}
            <div className="friends-list">
              <h3>Your Friends ({friends.length})</h3>
              {friends.length === 0 && (
                <div className="empty-friends">
                  <HiUsers />
                  <p>No friends yet. Add someone from the leaderboard!</p>
                </div>
              )}
              {friends.map((f) => (
                <div key={f._id} className="friend-card">
                  <div className="friend-avatar">{f.name.charAt(0).toUpperCase()}</div>
                  <div className="friend-info">
                    <span className="friend-name">{f.name}</span>
                    <span className="friend-stats">
                      Lv.{f.level} · {f.xp} XP · <HiFire /> {f.streak}
                    </span>
                  </div>
                  <button className="btn-chat" onClick={() => openChat(f)}>
                    <HiChat /> Chat
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CHAT VIEW ── */}
        {activeTab === 'friends' && activeChatUser && (
          <div className="chat-container">
            <div className="chat-header">
              <button className="btn-ghost" onClick={() => dispatch(clearChat())}>
                <HiChevronLeft />
              </button>
              <div className="chat-user-avatar">{activeChatUser.name.charAt(0).toUpperCase()}</div>
              <div className="chat-user-info">
                <span className="chat-user-name">{activeChatUser.name}</span>
                <span className="chat-user-level">Lv.{activeChatUser.level}</span>
              </div>
            </div>

            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-empty">
                  <HiChat />
                  <p>Start the conversation! Say hello 👋</p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`chat-bubble ${
                    msg.senderId?._id === user?._id ? 'sent' : 'received'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span className="chat-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-input-row" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Type a message..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="chat-input"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Send
              </button>
            </form>
          </div>
        )}

        {/* ── GROUPS TAB ── */}
        {activeTab === 'groups' && !activeGroup && (
          <div className="groups-container">
            <div className="groups-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Your Groups ({groups.length})</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateGroup(true)}>
                + Create Group
              </button>
            </div>

            {groups.length === 0 && (
              <div className="empty-friends" style={{ background: 'var(--bg-card)', padding: '3rem 2rem', textAlign: 'center', borderRadius: 'var(--radius)' }}>
                <HiStar style={{ fontSize: '3rem', color: 'var(--accent)', marginBottom: '1rem', opacity: 0.6 }} />
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>You are not in any groups yet. Build a team and start collaborating!</p>
              </div>
            )}

            <div className="groups-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {groups.map((g) => (
                <div key={g._id} className="friend-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="friend-avatar" style={{ background: 'var(--accent)', color: 'white' }}>{g.name.charAt(0).toUpperCase()}</div>
                    <div className="friend-info">
                      <span className="friend-name" style={{ fontWeight: '600' }}>{g.name}</span>
                      <span className="friend-stats" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {g.members.length} members · Created by {g.creator?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <button className="btn-chat" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }} onClick={() => openGroupChat(g)}>
                    <HiChat /> Enter Group Chat
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CREATE GROUP MODAL ── */}
        {showCreateGroup && (
          <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="modal-content" style={{ maxWidth: '450px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Create a Productivity Team</h3>
                <button className="btn-ghost" onClick={() => { setShowCreateGroup(false); setGroupName(''); setSelectedMembers([]); }}>
                  <HiX style={{ fontSize: '1.25rem' }} />
                </button>
              </div>
              
              <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>Group Name</label>
                  <input
                    className="form-input"
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="E.g., Peak Performers, Study Wizards..."
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="form-label" style={{ fontWeight: '600', margin: 0 }}>Select Members</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Invite your friends to the group:</span>
                  {friends.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0.5rem 0' }}>No friends available. Add friends from the leaderboard first!</p>
                  ) : (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {friends.map((f) => (
                        <label key={f._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '4px' }}>
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(f._id)}
                            onChange={() => toggleMemberSelection(f._id)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{f.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Lv.{f.level} · {f.xp} XP</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
                  Forge Group
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── GROUP CHAT VIEW ── */}
        {activeTab === 'groups' && activeGroup && (
          <div className="chat-container">
            <div className="chat-header">
              <button className="btn-ghost" onClick={() => dispatch(clearGroupChat())}>
                <HiChevronLeft />
              </button>
              <div className="chat-user-avatar" style={{ background: 'var(--accent)', color: 'white' }}>{activeGroup.name.charAt(0).toUpperCase()}</div>
              <div className="chat-user-info">
                <span className="chat-user-name">{activeGroup.name}</span>
                <span className="chat-user-level" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{activeGroup.members.length} members</span>
              </div>
            </div>

            <div className="chat-messages">
              {groupMessages.length === 0 && (
                <div className="chat-empty">
                  <HiChat />
                  <p>Welcome to {activeGroup.name}! Break the ice 👋</p>
                </div>
              )}
              {groupMessages.map((msg) => (
                <div
                  key={msg._id}
                  className={`chat-bubble ${
                    msg.senderId?._id === user?._id ? 'sent' : 'received'
                  }`}
                >
                  {msg.senderId?._id !== user?._id && (
                    <span className="chat-sender-name" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '2px' }}>
                      {msg.senderId?.name || 'Group Member'}
                    </span>
                  )}
                  <p>{msg.text}</p>
                  <span className="chat-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-input-row" onSubmit={handleSendGroupMessage}>
              <input
                type="text"
                placeholder="Message the group..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="chat-input"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Send
              </button>
            </form>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default Social;
