import React, { useContext } from 'react';
import { VoiceContext } from '../../features/voice/VoiceContext';
import { useSelector } from 'react-redux';
import { HiVolumeUp } from 'react-icons/hi';

const VoiceIndicator = () => {
  const { activeSpeakers } = useContext(VoiceContext);
  const { friends, leaderboard } = useSelector((state) => state.social);
  const { user } = useSelector((state) => state.auth);

  if (!activeSpeakers || activeSpeakers.length === 0) {
    return null;
  }

  // Helper to resolve user name from ID
  const getUserName = (userId) => {
    if (userId === user?.uid) return 'You';
    const friend = friends.find(f => f.uid === userId);
    if (friend) return friend.username || friend.displayName;
    const lbUser = leaderboard.find(l => l.uid === userId);
    if (lbUser) return lbUser.username || lbUser.displayName;
    return 'Someone';
  };

  return (
    <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full text-sm font-medium animate-pulse">
      <HiVolumeUp className="w-4 h-4" />
      <span>
        {activeSpeakers.map(id => getUserName(id)).join(', ')} {activeSpeakers.length > 1 ? 'are' : 'is'} speaking...
      </span>
    </div>
  );
};

export default VoiceIndicator;
