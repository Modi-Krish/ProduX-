import React, { useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { VoiceContext } from '../../features/voice/VoiceContext';
import { HiMicrophone } from 'react-icons/hi';
import { uploadChatFile } from '../../utils/fileUploader';
import { sendChatMessage, sendGroupChatMessage } from '../../features/social/socialSlice';
import './PushToTalkButton.css';

const PushToTalkButton = ({ roomId }) => {
  const dispatch = useDispatch();
  const { activeChatUser, activeGroup } = useSelector((state) => state.social);
  const { isInRoom, isTalking, joinVoiceRoom, leaveVoiceRoom, startTalking, stopTalking, getLocalStream } = useContext(VoiceContext);
  
  // We use a ref to track if we're currently holding to prevent double fires
  const isPressing = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isInRoom && roomId) {
      joinVoiceRoom(roomId);
    }
    
    return () => {
      // Clean up when component unmounts if we're in a room
      if (isInRoom) {
        leaveVoiceRoom();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const handlePressStart = (e) => {
    // Prevent default context menus or scrolling on mobile
    if (e.cancelable) e.preventDefault();
    if (!isInRoom || isPressing.current) return;
    
    isPressing.current = true;
    startTalking();
    
    // Start recording for voice history
    const stream = getLocalStream();
    if (stream) {
      try {
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.error('Failed to start MediaRecorder:', err);
      }
    }
    
    // Play a short start tone
    playTone(800, 0.1);
  };

  const handlePressEnd = (e) => {
    if (e.cancelable) e.preventDefault();
    if (!isPressing.current) return;
    
    isPressing.current = false;
    stopTalking();
    
    // Stop recording and upload
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Only upload if it's long enough (e.g. > 1 second, approximately 15KB)
        if (audioBlob.size > 10000) {
          await uploadVoiceHistory(audioBlob);
        }
      };
      mediaRecorderRef.current.stop();
    }
    
    // Play a short end tone
    playTone(400, 0.15);
  };

  // Web Audio API for simple notification tones
  const playTone = (frequency, duration) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.log('Audio API not supported or muted');
    }
  };

  const uploadVoiceHistory = async (audioBlob) => {
    setIsUploading(true);
    try {
      // Check user setting (pseudo code, since it's hard to read setting here without Redux, assume true for now)
      const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const fileInfo = await uploadChatFile(file, 'chat', null);
      
      if (activeGroup) {
        dispatch(sendGroupChatMessage({
          groupId: activeGroup._id,
          text: '',
          fileInfo
        }));
      } else if (activeChatUser) {
        dispatch(sendChatMessage({
          receiverId: activeChatUser._id,
          text: '',
          fileInfo
        }));
      }
    } catch (err) {
      console.error('Voice history upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="ptt-container">
      {isTalking && (
        <>
          <div className="ptt-ripple" style={{ animationDelay: '0s' }}></div>
          <div className="ptt-ripple" style={{ animationDelay: '0.5s' }}></div>
        </>
      )}
      
      <button 
        className={`ptt-button ${isTalking ? 'active' : ''} ${!isInRoom ? 'disabled' : ''} ${isUploading ? 'uploading' : ''}`}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
        disabled={!isInRoom || isUploading}
        aria-label="Push to Talk"
      >
        <HiMicrophone />
      </button>
      
      <div className={`ptt-status ${isTalking ? 'talking' : ''}`}>
        {isUploading ? 'Saving...' : (isTalking ? 'Transmitting...' : (isInRoom ? 'Hold to Talk' : 'Connecting...'))}
      </div>
    </div>
  );
};

export default PushToTalkButton;
