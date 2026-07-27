import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../features/auth/authSlice';
import { disconnectSocket } from '../api/socket';
import { HiOutlineLogout, HiTrendingUp, HiHome } from 'react-icons/hi';
import ProfileModal from './ProfileModal';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = () => {
    disconnectSocket();
    dispatch(logout());
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isOnSocial = location.pathname === '/social';
  const isOnWalkie = location.pathname === '/walkie';

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon">⚡</div>
          <span>Produx</span>
        </div>

        <div className="navbar-actions">
          <button
            className={`btn-nav ${(!isOnSocial && !isOnWalkie) ? 'active' : ''}`}
            onClick={() => navigate('/')}
            title="Dashboard"
          >
            <HiHome /> <span className="nav-label">Dashboard</span>
          </button>

          <div className="nav-divider" />

          <div className="navbar-user" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
            <div 
              className="navbar-avatar"
              style={{
                backgroundImage: user?.avatar?.publicUrl ? `url(${user.avatar.publicUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: user?.avatar?.publicUrl ? 'transparent' : undefined,
              }}
            >
              {!user?.avatar?.publicUrl && getInitials(user?.name)}
            </div>
            <span className="user-name">{user?.name}</span>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout} title="Logout">
            <HiOutlineLogout size={20} />
          </button>
        </div>
      </nav>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
};

export default Navbar;
