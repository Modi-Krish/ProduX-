import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { verifyPinUser } from '../api/authApi';
import toast from 'react-hot-toast';
import { HiLockClosed, HiArrowLeft } from 'react-icons/hi';
import Navbar from './Navbar';
import Footer from './Footer';

const PinProtection = ({ feature, children }) => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  const pinField = feature === 'community' ? 'communityPin' : 'walkieTalkiePin';
  const hasPinConfigured = !!user?.[pinField];

  useEffect(() => {
    // If the feature PIN is removed/cleared, require re-verification
    setIsVerified(false);
  }, [hasPinConfigured]);

  if (isVerified) {
    return <>{children}</>;
  }

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!pin.trim()) {
      toast.error('Please enter your PIN');
      return;
    }
    
    setIsVerifying(true);
    try {
      await verifyPinUser({ feature, pin });
      setIsVerified(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect PIN');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="auth-page" style={{ minHeight: 'calc(100vh - 140px)' }}>
        <div className="auth-card" style={{ maxWidth: '400px', margin: 'auto' }}>
          <div className="auth-header" style={{ marginBottom: '2rem' }}>
            <HiLockClosed size={48} style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
            <h1>Protected <span className="highlight">Feature</span></h1>
            <p>
              {feature === 'community' ? 'Community Area' : 'Walkie-Talkie'}
            </p>
          </div>
          
          {!hasPinConfigured ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>
                You have not configured a PIN for this feature.
              </p>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginBottom: '1rem' }}
                onClick={() => navigate('/')}
              >
                Go to Dashboard
              </button>
              <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
                Please set up a PIN in your Profile (Top Right Menu) to access this area.
              </p>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="auth-form">
              <div className="form-group">
                <label className="form-label" style={{ textAlign: 'center' }}>Enter your PIN</label>
                <input
                  type="password"
                  className="form-input"
                  style={{ textAlign: 'center', letterSpacing: '0.5rem', fontSize: '1.5rem' }}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  maxLength={6}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary btn-lg" 
                disabled={isVerifying}
                style={{ width: '100%' }}
              >
                {isVerifying ? 'Verifying...' : 'Unlock'}
              </button>
              
              <button 
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate('/')}
                style={{ width: '100%', marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
              >
                <HiArrowLeft /> Back to Dashboard
              </button>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default PinProtection;
