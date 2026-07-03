import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { fetchMyRooms, fetchPublicRooms, createWalkieRoom, joinWalkieRoom, clearError } from '../features/walkie/walkieSlice';
import WalkieRoom from './WalkieRoom'; // We'll create this next
import toast from 'react-hot-toast';

const WalkieDashboard = () => {
  const { roomId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { myRooms, publicRooms, loading, error } = useSelector(state => state.walkie);
  
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  
  // Create Room State
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (!roomId) {
      dispatch(fetchMyRooms());
      dispatch(fetchPublicRooms());
    }
  }, [dispatch, roomId]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    
    const result = await dispatch(createWalkieRoom({
      name: roomName,
      description: roomDesc,
      isPublic
    }));
    
    if (!result.error) {
      setShowCreate(false);
      navigate(`/walkie/${result.payload._id}`);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    
    const result = await dispatch(joinWalkieRoom(joinCode.trim()));
    if (!result.error) {
      navigate(`/walkie/${result.payload._id}`);
    }
  };

  // If URL has a roomId, render the active room instead of the dashboard
  if (roomId) {
    return <WalkieRoom roomId={roomId} />;
  }

  return (
    <>
      <Navbar />
      <main className="dashboard">
        {/* Background Decorations */}
        <div className="bg-decor circle-1" />
        <div className="bg-decor square-1" />
        <div className="bg-decor dots-1" />

        <div className="dashboard-header walkie-header">
          <div>
            <h1><span className="highlight">Walkie-Talkie</span> Rooms</h1>
            <p className="dashboard-greeting">
              Drop in, listen, or request to speak.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Create Walkie Room
          </button>
        </div>

        <div className="walkie-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginTop: '2rem' }}>
          {/* Join Sidebar */}
          <div className="walkie-card" style={{ padding: '1.5rem', height: 'fit-content' }}>
            <h3>Join a Room</h3>
            <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <input
                type="text"
                placeholder="Enter Room Code (e.g. PX-XXXXXX)"
                className="input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Join Room
              </button>
            </form>
          </div>

          {/* Rooms List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <h3>My Rooms</h3>
              {myRooms.length === 0 ? (
                <p className="text-secondary" style={{ marginTop: '1rem' }}>You haven't joined any rooms yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {myRooms.map(room => (
                    <div key={room._id} className="walkie-card" style={{ padding: '1.25rem', cursor: 'pointer' }} onClick={() => navigate(`/walkie/${room._id}`)}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)' }}>{room.name}</h4>
                      <p className="text-secondary" style={{ fontSize: '0.85rem', margin: '0 0 1rem 0' }}>{room.description || 'No description'}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <span>Code: <strong>{room.code}</strong></span>
                        <span style={{ color: 'var(--success)' }}>{room.memberIds?.length || 0} Members</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3>Recent Public Rooms</h3>
              {publicRooms.length === 0 ? (
                <p className="text-secondary" style={{ marginTop: '1rem' }}>No public rooms available right now.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {publicRooms.map(room => (
                    <div key={room._id} className="walkie-card" style={{ padding: '1.25rem', cursor: 'pointer' }} onClick={() => navigate(`/walkie/${room._id}`)}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)' }}>{room.name}</h4>
                      <p className="text-secondary" style={{ fontSize: '0.85rem', margin: '0 0 1rem 0' }}>{room.description || 'No description'}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <span>Code: <strong>{room.code}</strong></span>
                        <span style={{ color: 'var(--success)' }}>{room.memberIds?.length || 0} Members</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Walkie Room</h2>
              <button className="btn-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleCreateRoom} className="modal-body">
              <div className="form-group">
                <label>Room Name</label>
                <input type="text" className="input" value={roomName} onChange={e => setRoomName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea className="input" value={roomDesc} onChange={e => setRoomDesc(e.target.value)} rows="3" />
              </div>
              <div className="form-group" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input type="checkbox" id="public-check" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
                <label htmlFor="public-check">Make room public</label>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </form>
          </div>
        </div>
      )}
      </main>
    </>
  );
};

export default WalkieDashboard;
