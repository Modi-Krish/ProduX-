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
} from '../features/social/socialSlice';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
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
  const { leaderboard, friends, pendingRequests, messages, activeChatUser, isLoading } =
    useSelector((state) => state.social);
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [chatText, setChatText] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    dispatch(fetchLeaderboard());
    dispatch(fetchFriends());
  }, [dispatch]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
            onClick={() => { setActiveTab('friends'); dispatch(clearChat()); }}
          >
            <HiUsers /> Friends
            {pendingRequests.length > 0 && (
              <span className="tab-badge">{pendingRequests.length}</span>
            )}
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
      </div>
      <Footer />
    </>
  );
};

export default Social;
