import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { VoiceContext } from './VoiceContext';
import toast from 'react-hot-toast';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export const VoiceProvider = ({ children }) => {
  const { user } = useSelector((state) => state.auth);
  // In the existing codebase, socket might be a singleton or from a context.
  // We'll import socket from our global window if useSocket isn't providing a raw socket,
  // or we can expect to receive socket events via props/context. 
  // For this implementation, we assume `window.socket` is set by `useSocket` 
  // or we manage events through a passed ref if needed. 
  // Let's use `window.socket` as a fallback since `useSocket` in ProduX often sets it.
  const getSocket = () => window.socket;

  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isTalking, setIsTalking] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState(new Set());
  
  // Media streams and connections
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const audioContextRef = useRef(null);
  
  // Audio elements for playing remote streams
  const audioElementsRef = useRef({});

  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      
      // Start muted
      stream.getAudioTracks().forEach(track => { track.enabled = false; });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error('Microphone permission denied or not available');
      return null;
    }
  };

  const createPeerConnection = (targetUserId, isInitiator, socket) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice-ice-candidate', {
          target: targetUserId,
          sender: user._id,
          candidate: event.candidate,
          roomId: currentRoom
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      remoteStreamsRef.current[targetUserId] = remoteStream;
      
      // Create audio element if doesn't exist
      if (!audioElementsRef.current[targetUserId]) {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        document.body.appendChild(audio); // Append to DOM for consistent playback (especially on mobile)
        audio.play().catch(e => console.warn('Audio auto-play prevented:', e));
        audioElementsRef.current[targetUserId] = audio;
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('voice-offer', {
            target: targetUserId,
            caller: user._id,
            sdp: pc.localDescription,
            roomId: currentRoom
          });
        })
        .catch(e => console.error(e));
    }

    peerConnectionsRef.current[targetUserId] = pc;
    return pc;
  };

  const joinVoiceRoom = async (roomId) => {
    const stream = await initLocalStream();
    if (!stream) return;

    setCurrentRoom(roomId);
    setIsInRoom(true);
    
    const socket = getSocket();
    if (socket) {
      socket.emit('join-voice', { roomId });
    }
  };

  const leaveVoiceRoom = () => {
    const socket = getSocket();
    if (socket && currentRoom) {
      socket.emit('leave-voice', { roomId: currentRoom });
    }
    
    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    
    // Stop all audio elements
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.pause();
      audio.remove(); // Remove from DOM
      audio.srcObject = null;
    });
    audioElementsRef.current = {};
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    setIsInRoom(false);
    setCurrentRoom(null);
    setIsTalking(false);
    setActiveSpeakers(new Set());
  };

  // Push to Talk Handlers
  const startTalking = () => {
    if (!isInRoom || !localStreamRef.current) return;
    
    localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = true; });
    setIsTalking(true);
    
    const socket = getSocket();
    if (socket) {
      socket.emit('voice-speaking-start', { roomId: currentRoom });
    }
  };

  const stopTalking = () => {
    if (!isInRoom || !localStreamRef.current) return;
    
    localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = false; });
    setIsTalking(false);
    
    const socket = getSocket();
    if (socket) {
      socket.emit('voice-speaking-stop', { roomId: currentRoom });
    }
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUserJoined = ({ userId }) => {
      // Initiator creates connection
      createPeerConnection(userId, true, socket);
    };

    const handleUserLeft = ({ userId }) => {
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].close();
        delete peerConnectionsRef.current[userId];
      }
      if (audioElementsRef.current[userId]) {
        audioElementsRef.current[userId].pause();
        audioElementsRef.current[userId].remove(); // Remove from DOM
        delete audioElementsRef.current[userId];
      }
      setActiveSpeakers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    const handleOffer = async ({ caller, sdp }) => {
      const pc = createPeerConnection(caller, false, socket);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice-answer', {
        target: caller,
        responder: user._id,
        sdp: answer,
        roomId: currentRoom
      });
    };

    const handleAnswer = async ({ responder, sdp }) => {
      const pc = peerConnectionsRef.current[responder];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    };

    const handleIceCandidate = async ({ sender, candidate }) => {
      const pc = peerConnectionsRef.current[sender];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const handleSpeakingStart = ({ userId }) => {
      setActiveSpeakers(prev => new Set(prev).add(userId));
    };

    const handleSpeakingStop = ({ userId }) => {
      setActiveSpeakers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    socket.on('voice-user-joined', handleUserJoined);
    socket.on('voice-user-left', handleUserLeft);
    socket.on('voice-offer', handleOffer);
    socket.on('voice-answer', handleAnswer);
    socket.on('voice-ice-candidate', handleIceCandidate);
    socket.on('voice-speaking-start', handleSpeakingStart);
    socket.on('voice-speaking-stop', handleSpeakingStop);

    return () => {
      socket.off('voice-user-joined', handleUserJoined);
      socket.off('voice-user-left', handleUserLeft);
      socket.off('voice-offer', handleOffer);
      socket.off('voice-answer', handleAnswer);
      socket.off('voice-ice-candidate', handleIceCandidate);
      socket.off('voice-speaking-start', handleSpeakingStart);
      socket.off('voice-speaking-stop', handleSpeakingStop);
    };
  }, [user, currentRoom]);

  const getLocalStream = () => localStreamRef.current;

  const value = {
    isInRoom,
    currentRoom,
    isTalking,
    activeSpeakers: Array.from(activeSpeakers),
    joinVoiceRoom,
    leaveVoiceRoom,
    startTalking,
    stopTalking,
    getLocalStream,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
};
