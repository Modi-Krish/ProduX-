import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';

export const WalkieContext = createContext();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

import { getSocket } from '../../api/socket';

export const WalkieProvider = ({ children }) => {
  const { user } = useSelector((state) => state.auth);

  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [isTalking, setIsTalking] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState(new Set());
  const [queue, setQueue] = useState([]); // List of userIds waiting to speak
  const [isQueued, setIsQueued] = useState(false);
  
  // Media streams and connections
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const remoteStreamsRef = useRef({});
  
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
          roomId: currentRoomId
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      remoteStreamsRef.current[targetUserId] = remoteStream;
      
      if (!audioElementsRef.current[targetUserId]) {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        document.body.appendChild(audio);
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
            roomId: currentRoomId
          });
        })
        .catch(e => console.error(e));
    }

    peerConnectionsRef.current[targetUserId] = pc;
    return pc;
  };

  const joinWalkieRoom = async (roomId) => {
    const stream = await initLocalStream();
    if (!stream) return false;

    setCurrentRoomId(roomId);
    setIsInRoom(true);
    
    const socket = getSocket();
    if (socket) {
      socket.emit('join-voice', { roomId }); // Reusing WebRTC signaling namespaces
    }
    return true;
  };

  const leaveWalkieRoom = () => {
    const socket = getSocket();
    if (socket && currentRoomId) {
      socket.emit('leave-voice', { roomId: currentRoomId });
      socket.emit('walkie-release-speak', { roomId: currentRoomId }); // Drop from queue if present
    }
    
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.pause();
      audio.remove();
      audio.srcObject = null;
    });
    audioElementsRef.current = {};
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    setIsInRoom(false);
    setCurrentRoomId(null);
    setIsTalking(false);
    setIsQueued(false);
    setQueue([]);
    setActiveSpeakers(new Set());
  };

  // Queue logic
  const requestToSpeak = () => {
    if (!isInRoom || !currentRoomId) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('walkie-request-speak', { roomId: currentRoomId });
      setIsQueued(true);
    }
  };

  const releaseSpeak = () => {
    if (!isInRoom || !currentRoomId) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('walkie-release-speak', { roomId: currentRoomId });
      setIsQueued(false);
      
      // Also stop talking if we were talking
      if (isTalking) {
        stopTalking();
      }
    }
  };

  const startTalking = () => {
    if (!isInRoom || !localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = true; });
    setIsTalking(true);
    
    const socket = getSocket();
    if (socket) {
      socket.emit('voice-speaking-start', { roomId: currentRoomId });
    }
  };

  const stopTalking = () => {
    if (!isInRoom || !localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = false; });
    setIsTalking(false);
    
    const socket = getSocket();
    if (socket) {
      socket.emit('voice-speaking-stop', { roomId: currentRoomId });
    }
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    // WebRTC Signaling
    const handleUserJoined = ({ userId }) => createPeerConnection(userId, true, socket);
    const handleUserLeft = ({ userId }) => {
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].close();
        delete peerConnectionsRef.current[userId];
      }
      if (audioElementsRef.current[userId]) {
        audioElementsRef.current[userId].pause();
        audioElementsRef.current[userId].remove();
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
        roomId: currentRoomId
      });
    };
    const handleAnswer = async ({ responder, sdp }) => {
      const pc = peerConnectionsRef.current[responder];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    };
    const handleIceCandidate = async ({ sender, candidate }) => {
      const pc = peerConnectionsRef.current[sender];
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    };
    const handleSpeakingStart = ({ userId }) => setActiveSpeakers(prev => new Set(prev).add(userId));
    const handleSpeakingStop = ({ userId }) => {
      setActiveSpeakers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };
    
    // Queue Handling
    const handleQueueUpdate = ({ queue }) => {
      setQueue(queue);
      // Auto-start talking if I'm first in queue and requested it
      if (queue[0] === user._id && isQueued && !isTalking) {
        startTalking();
      }
      // If I'm no longer first, but I'm talking, I must stop
      if (queue[0] !== user._id && isTalking) {
        stopTalking();
      }
      // If I'm not in queue at all anymore (maybe skipped by admin)
      if (!queue.includes(user._id)) {
        setIsQueued(false);
      }
    };

    socket.on('voice-user-joined', handleUserJoined);
    socket.on('voice-user-left', handleUserLeft);
    socket.on('voice-offer', handleOffer);
    socket.on('voice-answer', handleAnswer);
    socket.on('voice-ice-candidate', handleIceCandidate);
    socket.on('voice-speaking-start', handleSpeakingStart);
    socket.on('voice-speaking-stop', handleSpeakingStop);
    socket.on('walkie-queue-update', handleQueueUpdate);

    return () => {
      socket.off('voice-user-joined', handleUserJoined);
      socket.off('voice-user-left', handleUserLeft);
      socket.off('voice-offer', handleOffer);
      socket.off('voice-answer', handleAnswer);
      socket.off('voice-ice-candidate', handleIceCandidate);
      socket.off('voice-speaking-start', handleSpeakingStart);
      socket.off('voice-speaking-stop', handleSpeakingStop);
      socket.off('walkie-queue-update', handleQueueUpdate);
    };
  }, [user, currentRoomId, isQueued, isTalking]);

  return (
    <WalkieContext.Provider value={{
      isInRoom,
      currentRoomId,
      isTalking,
      activeSpeakers: Array.from(activeSpeakers),
      queue,
      isQueued,
      joinWalkieRoom,
      leaveWalkieRoom,
      requestToSpeak,
      releaseSpeak,
    }}>
      {children}
    </WalkieContext.Provider>
  );
};

export const useWalkie = () => useContext(WalkieContext);
