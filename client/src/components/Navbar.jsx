import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../features/auth/authSlice';
import { disconnectSocket } from '../api/socket';
import { HiOutlineLogout } from 'react-icons/hi';
import ProfileModal from './ProfileModal';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
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

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="brand-icon">⚡</div>
          <span>Produx</span>
        </div>

        <div className="navbar-actions">
          <div className="navbar-user" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
            <div className="navbar-avatar">{getInitials(user?.name)}</div>
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
