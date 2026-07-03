import React, { useState } from 'react';
import { HiStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi';
import PushToTalkButton from './PushToTalkButton';
import VoiceIndicator from './VoiceIndicator';
import './WalkieTalkieWidget.css';

const WalkieTalkieWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const toggleWidget = () => {
    // If we're connected and try to close the widget, we might want to stay connected.
    // But for a walkie talkie, let's keep it simple: if you close the widget, you disconnect.
    if (isOpen && isConnected) {
      setIsConnected(false);
    }
    setIsOpen(!isOpen);
  };

  const toggleConnection = () => {
    setIsConnected(!isConnected);
  };

  return (
    <div className="walkie-talkie-widget">
      <button 
        className={`walkie-talkie-toggle ${isConnected ? 'active' : ''}`}
        onClick={toggleWidget}
        title="Walkie Talkie Zone"
      >
        {isConnected ? <HiStatusOnline /> : <HiOutlineStatusOffline />}
      </button>

      {isOpen && (
        <div className="walkie-talkie-panel">
          <div className="wt-panel-header">
            <span className="wt-status-dot" style={{ backgroundColor: isConnected ? '#2ed573' : '#ff4757' }}></span>
            Global Zone
          </div>
          
          <div className="wt-panel-body">
            <button 
              className={`btn ${isConnected ? 'btn-danger' : 'btn-primary'} btn-sm`}
              onClick={toggleConnection}
              style={{ width: '100%' }}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>

            {isConnected && (
              <>
                <div className="wt-indicator-wrapper">
                  <VoiceIndicator />
                </div>
                {/* We use a specific global room ID */}
                <PushToTalkButton roomId="global_walkie_talkie_zone" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WalkieTalkieWidget;
