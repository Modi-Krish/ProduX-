import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useWalkie } from '../features/walkie/WalkieContext';
import { HiOutlineMicrophone, HiMicrophone, HiPhoneMissedCall, HiUserGroup, HiOutlineClipboardCopy } from 'react-icons/hi';
import toast from 'react-hot-toast';
import axios from '../api/axios';

const WalkieRoom = ({ roomId }) => {
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);
  
  const {
    isInRoom,
    currentRoomId,
    isTalking,
    activeSpeakers,
    queue,
    isQueued,
    joinWalkieRoom,
    leaveWalkieRoom,
    requestToSpeak,
    releaseSpeak,
  } = useWalkie();

  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch Room Data on Mount
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        setLoading(true);
        // Assuming we have an endpoint or we can fetch from our myRooms Redux.
        // For simplicity, let's just use the join endpoint to get details 
        // OR we can make a GET /api/walkie/:id if we had one. 
        // We'll use Redux state or fetch if missing.
        const res = await axios.get('/walkie/my-rooms');
        const room = res.data.data.find(r => r._id === roomId);
        if (room) {
          setRoomData(room);
          joinWalkieRoom(roomId);
        } else {
          // If not in myRooms, maybe we need to fetch public rooms
          const pubRes = await axios.get('/walkie/public');
          const pubRoom = pubRes.data.data.find(r => r._id === roomId);
          if (pubRoom) {
            setRoomData(pubRoom);
            joinWalkieRoom(roomId);
          } else {
            toast.error("Room not found or you don't have access.");
            navigate('/walkie');
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load room");
        navigate('/walkie');
      } finally {
        setLoading(false);
      }
    };

    if (!isInRoom || currentRoomId !== roomId) {
      fetchRoom();
    }
  }, [roomId, isInRoom, currentRoomId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      leaveWalkieRoom();
    };
  }, []);

  const handleLeave = () => {
    leaveWalkieRoom();
    navigate('/walkie');
  };

  const copyCode = () => {
    if (roomData?.code) {
      navigator.clipboard.writeText(roomData.code);
      toast.success("Room code copied!");
    }
  };

  const handleMicTouchStart = (e) => {
    e.preventDefault();
    requestToSpeak();
  };

  const handleMicTouchEnd = (e) => {
    e.preventDefault();
    releaseSpeak();
  };

  if (loading || !roomData) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <h2>Loading Room...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout walkie-room-layout">
      <Navbar />
      <div className="container walkie-container" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)' }}>
        
        {/* Header */}
        <div className="card glass-card walkie-header" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="live-indicator"></span>
              {roomData.name}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
              <span onClick={copyCode} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Copy Code">
                Code: <strong>{roomData.code}</strong> <HiOutlineClipboardCopy />
              </span>
              <span><HiUserGroup /> {roomData.memberIds?.length || 0} Members</span>
            </div>
          </div>
          <button className="btn btn-danger" onClick={handleLeave} style={{ padding: '0.5rem 1rem' }}>
            <HiPhoneMissedCall size={20} /> Leave
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
          
          {/* Active Speaker Area */}
          <div className="card glass-card" style={{ flex: '0 0 auto', padding: '2rem', textAlign: 'center', background: isTalking ? 'rgba(76, 175, 80, 0.1)' : 'var(--card)' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Current Speaker</h3>
            {activeSpeakers.length > 0 ? (
              <div className="speaker-pulse active">
                <div className="avatar-large">{/* Would map activeSpeaker ID to user profile, using ID for now */} 🔊</div>
                <p>User {activeSpeakers[0].substring(0, 5)}...</p>
              </div>
            ) : (
              <div className="speaker-pulse inactive text-secondary">
                <p>No one is speaking</p>
              </div>
            )}
          </div>

          {/* Queue Area */}
          {queue.length > 0 && (
            <div className="card glass-card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Up Next ({queue.length})</h4>
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {queue.map((qId, idx) => (
                  <div key={qId} style={{ padding: '0.25rem 0.75rem', background: 'var(--bg)', borderRadius: '1rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {idx + 1}. {qId === user._id ? 'You' : `User ${qId.substring(0, 4)}`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members Grid (Simplified for now) */}
          <div className="card glass-card" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Members in Room</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem' }}>
              {/* This would ideally list all online members. We currently just map memberIds. */}
              {roomData.memberIds?.map(mId => (
                <div key={mId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div className={`avatar-ring ${activeSpeakers.includes(mId) ? 'speaking' : ''}`} style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold' }}>
                    {mId.substring(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.75rem' }}>{mId === user._id ? 'You' : 'Member'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PTT Button */}
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)', margin: '0 -1rem -1rem -1rem', borderTop: '1px solid var(--border)' }}>
          <button
            className={`walkie-ptt-btn ${isQueued || isTalking ? 'active' : ''}`}
            onMouseDown={handleMicTouchStart}
            onMouseUp={handleMicTouchEnd}
            onMouseLeave={handleMicTouchEnd}
            onTouchStart={handleMicTouchStart}
            onTouchEnd={handleMicTouchEnd}
          >
            {isTalking ? <HiMicrophone size={40} /> : <HiOutlineMicrophone size={40} />}
          </button>
          <div style={{ position: 'absolute', right: '2rem' }}>
             {isQueued && !isTalking && <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>Waiting...</span>}
             {isTalking && <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Transmitting</span>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default WalkieRoom;
