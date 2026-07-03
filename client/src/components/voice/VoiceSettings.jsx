import React, { useState, useEffect } from 'react';
import { HiX, HiMicrophone, HiVolumeUp, HiCog } from 'react-icons/hi';
import toast from 'react-hot-toast';

const VoiceSettings = ({ onClose }) => {
  const [settings, setSettings] = useState({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    autoPlay: true,
  });

  const [devices, setDevices] = useState({ audioinput: [], audiooutput: [] });
  const [selectedInput, setSelectedInput] = useState('default');
  const [selectedOutput, setSelectedOutput] = useState('default');

  useEffect(() => {
    // Fetch user settings from backend (mocked for now, integrate with /api/voice/settings)
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/voice/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setSettings(prev => ({ ...prev, ...data.data }));
        }
      } catch (err) {
        console.error('Failed to load voice settings:', err);
      }
    };
    
    fetchSettings();
    getDevices();
  }, []);

  const getDevices = async () => {
    try {
      // Must request permission first to see device labels in some browsers
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      
      const inputs = deviceList.filter(d => d.kind === 'audioinput');
      const outputs = deviceList.filter(d => d.kind === 'audiooutput');
      
      setDevices({ audioinput: inputs, audiooutput: outputs });
    } catch (err) {
      console.log('Error fetching devices', err);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/voice/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      toast.success('Voice settings saved!');
      onClose();
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HiCog /> Voice Settings
          </h2>
          <button className="btn btn-ghost" onClick={onClose}><HiX /></button>
        </div>

        <div className="settings-body" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="form-group">
            <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HiMicrophone /> Microphone
            </label>
            <select 
              className="form-input" 
              value={selectedInput}
              onChange={(e) => setSelectedInput(e.target.value)}
            >
              {devices.audioinput.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0,5)}...`}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HiVolumeUp /> Speaker
            </label>
            <select 
              className="form-input" 
              value={selectedOutput}
              onChange={(e) => setSelectedOutput(e.target.value)}
              disabled={devices.audiooutput.length === 0}
            >
              {devices.audiooutput.length === 0 && <option>System Default (Cannot change on this browser)</option>}
              {devices.audiooutput.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,5)}...`}</option>
              ))}
            </select>
          </div>

          <div className="settings-toggles" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span>
                <strong>Echo Cancellation</strong>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Prevents audio loopback</span>
              </span>
              <input type="checkbox" checked={settings.echoCancellation} onChange={() => toggleSetting('echoCancellation')} style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span>
                <strong>Noise Suppression</strong>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reduces background noise</span>
              </span>
              <input type="checkbox" checked={settings.noiseSuppression} onChange={() => toggleSetting('noiseSuppression')} style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span>
                <strong>Auto Play Incoming Audio</strong>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Play voice immediately when someone talks</span>
              </span>
              <input type="checkbox" checked={settings.autoPlay} onChange={() => toggleSetting('autoPlay')} style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }} />
            </label>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '2rem' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave}>
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;
