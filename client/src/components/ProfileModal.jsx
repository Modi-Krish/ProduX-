import { useState } from 'react';
import { HiX, HiUser, HiMail, HiCalendar, HiShieldCheck, HiTrash } from 'react-icons/hi';
import { useSelector, useDispatch } from 'react-redux';
import { deleteAccount } from '../features/auth/authSlice';
import toast from 'react-hot-toast';

const ProfileModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { summary } = useSelector((state) => state.dashboard);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      await dispatch(deleteAccount()).unwrap();
      toast.success('Your account has been permanently deleted.');
      onClose();
    } catch (err) {
      toast.error(err || 'Failed to delete account');
    }
  };

  if (showConfirm) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()} style={{ border: '2.5px solid #EF4444' }}>
          <div className="modal-header">
            <h2 style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HiTrash /> Delete Account
            </h2>
            <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}><HiX /></button>
          </div>

          <div style={{ textAlign: 'center', margin: '2rem 0' }}>
            <div style={{ fontSize: '3.5rem', color: '#EF4444', marginBottom: '1rem' }}>⚠️</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem', color: 'white' }}>Are you absolutely sure?</h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.95rem', lineHeight: '1.5', padding: '0 1rem' }}>
              This action is permanent and cannot be undone. All your tasks, habits, groups, messages, and profile records will be deleted forever.
            </p>
          </div>

          <div className="modal-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
            <button 
              className="btn" 
              onClick={handleDeleteAccount}
              style={{ 
                width: '100%', 
                background: '#EF4444', 
                color: 'white', 
                fontWeight: '800',
                border: '2px solid var(--fg)',
                boxShadow: '3px 3px 0px var(--fg)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
            >
              Yes, Delete My Account
            </button>
            <button 
              className="btn btn-ghost" 
              onClick={() => setShowConfirm(false)} 
              style={{ width: '100%', padding: '12px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                  toast.success('Unique ID copied to clipboard!');
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

        <div className="modal-footer" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
            Done
          </button>
          <button 
            className="btn-ghost delete" 
            onClick={() => setShowConfirm(true)} 
            style={{ 
              width: '100%', 
              color: '#EF4444',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '0.5rem',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              border: '1.5px solid transparent',
              background: 'transparent',
              fontWeight: '600'
            }}
            title="Permanently delete your account"
          >
            <HiTrash /> Delete Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
