import { HiX, HiUser, HiMail, HiCalendar, HiShieldCheck } from 'react-icons/hi';
import { useSelector } from 'react-redux';

const ProfileModal = ({ onClose }) => {
  const { user } = useSelector((state) => state.auth);
  const { summary } = useSelector((state) => state.dashboard);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Your Profile</h2>
          <button className="btn btn-ghost" onClick={onClose}><HiX /></button>
        </div>

        <div className="profile-info">
          <div className="profile-avatar-large">
            {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="profile-details">
            <h3>{user?.name}</h3>
            <p><HiMail /> {user?.email}</p>
            {user?.customId && (
              <p
                onClick={() => {
                  navigator.clipboard.writeText(user.customId);
                  import('react-hot-toast').then(({ default: toast }) => {
                    toast.success('Unique ID copied to clipboard!');
                  });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '0.5rem',
                  fontSize: '0.85rem',
                  color: 'white',
                  background: 'var(--accent)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1.5px solid var(--fg)',
                  boxShadow: '2px 2px 0px var(--fg)',
                  fontWeight: '800',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Click to copy your unique ID"
              >
                <span>ID: {user.customId} 📋</span>
              </p>
            )}
          </div>
        </div>

        <div className="profile-stats-mini">
          <div className="mini-stat">
            <span className="mini-stat-label">Member Since</span>
            <span className="mini-stat-value">
              <HiCalendar /> {new Date(user?.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-label">Trust Score</span>
            <span className="mini-stat-value">
              <HiShieldCheck /> Verified
            </span>
          </div>
        </div>

        <div className="profile-badges">
          <div className="p-badge pink">Productivity Pro</div>
          <div className="p-badge violet">Early Adopter</div>
          <div className="p-badge yellow">Focus Master</div>
        </div>

        <div className="modal-footer" style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
