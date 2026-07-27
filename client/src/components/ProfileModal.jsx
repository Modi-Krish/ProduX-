import { useState } from 'react';
import { HiX, HiUser, HiMail, HiCalendar, HiShieldCheck, HiTrash, HiLockClosed, HiTrendingUp } from 'react-icons/hi';
import { useSelector, useDispatch } from 'react-redux';
import { deleteAccount, updateProfile } from '../features/auth/authSlice';
import { updatePinsUser } from '../api/authApi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploadDropzone from './common/FileUploadDropzone';

const ProfileModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { summary } = useSelector((state) => state.dashboard);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);

  const [pinData, setPinData] = useState({ communityPin: '', walkieTalkiePin: '' });
  const [isSavingPins, setIsSavingPins] = useState(false);
  const [hasSetPin, setHasSetPin] = useState(!!user?.communityPin || !!user?.walkieTalkiePin);

  const handleSavePins = async () => {
    try {
      const payload = {};
      if (pinData.communityPin.trim()) payload.communityPin = pinData.communityPin.trim();
      if (pinData.walkieTalkiePin.trim()) payload.walkieTalkiePin = pinData.walkieTalkiePin.trim();
      
      if (Object.keys(payload).length === 0) {
        toast.error('Please enter a PIN to save');
        return;
      }
      
      setIsSavingPins(true);
      await updatePinsUser(payload);
      toast.success('PINs updated successfully');
      setPinData({ communityPin: '', walkieTalkiePin: '' });
      setHasSetPin(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update PINs');
    } finally {
      setIsSavingPins(false);
    }
  };

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
          <div 
            className="profile-avatar-large" 
            style={{ 
              cursor: 'pointer', 
              backgroundImage: user?.avatar?.publicUrl ? `url(${user.avatar.publicUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            onClick={() => setIsEditingAvatar(!isEditingAvatar)}
            title="Click to change avatar"
          >
            {!user?.avatar?.publicUrl && user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
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

        {isEditingAvatar && (
          <div style={{ marginTop: '1rem', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '10px' }}>Upload New Avatar</h4>
            <FileUploadDropzone
              folder="avatars"
              accept="image/*"
              maxSizeMB={5}
              onUploadSuccess={(fileData) => {
                dispatch(updateProfile({ avatar: fileData }))
                  .unwrap()
                  .then(() => {
                    toast.success('Avatar updated successfully!');
                    setIsEditingAvatar(false);
                  })
                  .catch((err) => toast.error(err));
              }}
            />
          </div>
        )}

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

        <div style={{ marginTop: '1.5rem', padding: '1rem' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: 'var(--fg)', fontSize: '1.1rem' }}><HiLockClosed /> Feature PINs & Access</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>Configure 4-6 digit PINs to secure sensitive features. Leave blank to keep current PIN.</p>
          
          {!hasSetPin && (
            <>
              <div style={{ display: 'flex', width: '100%', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '4px', display: 'block', paddingLeft: '1rem' }}>Community PIN</label>
                  <input 
                    type="password" 
                    placeholder="New PIN" 
                    value={pinData.communityPin}
                    onChange={(e) => setPinData({...pinData, communityPin: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid var(--fg)',
                      borderTopLeftRadius: '16px',
                      borderBottomLeftRadius: '16px',
                      background: 'var(--bg)',
                      color: 'var(--fg)',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '4px', display: 'block', paddingLeft: '1rem' }}>Walkie Talkie PIN</label>
                  <input 
                    type="password" 
                    placeholder="New PIN" 
                    value={pinData.walkieTalkiePin}
                    onChange={(e) => setPinData({...pinData, walkieTalkiePin: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid var(--fg)',
                      borderTopRightRadius: '16px',
                      borderBottomRightRadius: '16px',
                      background: 'var(--bg)',
                      color: 'var(--fg)',
                      outline: 'none',
                      marginLeft: '-2px'
                    }}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleSavePins}
                disabled={isSavingPins}
                style={{ 
                  width: '100%', 
                  marginBottom: '1.5rem',
                  padding: '12px',
                  borderRadius: '24px',
                  border: '2px solid var(--fg)',
                  background: 'var(--bg)',
                  color: 'var(--fg)',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {isSavingPins ? 'Saving...' : 'Update PINs'}
              </button>
            </>
          )}
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button 
              style={{ 
                flex: 1, 
                display: 'flex', 
                gap: '8px', 
                justifyContent: 'center',
                alignItems: 'center',
                padding: '12px',
                borderRadius: '24px',
                border: '2px solid var(--fg)',
                background: 'var(--bg-secondary)',
                color: 'var(--fg)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              onClick={() => { onClose(); navigate('/social'); }}
            >
              <HiTrendingUp /> Community
            </button>
            <button 
              style={{ 
                flex: 1, 
                display: 'flex', 
                gap: '8px', 
                justifyContent: 'center',
                alignItems: 'center',
                padding: '12px',
                borderRadius: '24px',
                border: '2px solid var(--fg)',
                background: 'var(--bg-secondary)',
                color: 'var(--fg)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              onClick={() => { onClose(); navigate('/walkie'); }}
            >
              🎤 Walkie-Talkie
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', padding: '0 1rem 1.5rem 1rem' }}>
          <button 
            onClick={onClose} 
            style={{ 
              width: '100%',
              padding: '14px',
              borderRadius: '24px',
              border: '2px solid var(--fg)',
              background: '#8B5CF6',
              boxShadow: '0 4px 0 var(--fg)',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Done
          </button>
          <button 
            onClick={() => setShowConfirm(true)} 
            style={{ 
              color: '#EF4444',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              fontWeight: 'bold'
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
