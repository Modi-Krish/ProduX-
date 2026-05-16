import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { dismissNotification } from '../features/gamification/gamificationSlice';

const GamificationNotifications = () => {
  const dispatch = useDispatch();
  const { notifications } = useSelector((state) => state.gamification);
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (notifications.length > 0) {
      // Show new notifications one at a time
      const latest = notifications[0];
      if (!visible.find((v) => v.id === latest.id)) {
        setVisible((prev) => [...prev, { ...latest, show: true }]);

        // Auto dismiss after 4 seconds
        setTimeout(() => {
          setVisible((prev) =>
            prev.map((v) => (v.id === latest.id ? { ...v, show: false } : v))
          );
          setTimeout(() => {
            setVisible((prev) => prev.filter((v) => v.id !== latest.id));
            dispatch(dismissNotification(latest.id));
          }, 500);
        }, 4000);
      }
    }
  }, [notifications, dispatch, visible]);

  if (visible.length === 0) return null;

  return (
    <div className="gn-container">
      {visible.map((notif) => (
        <div
          key={notif.id}
          className={`gn-toast ${notif.show ? 'gn-enter' : 'gn-exit'} gn-${notif.type}`}
        >
          {notif.type === 'xp' && (
            <>
              <span className="gn-icon">⚡</span>
              <span className="gn-text">+{notif.xpGained} XP earned!</span>
            </>
          )}
          {notif.type === 'level_up' && (
            <>
              <span className="gn-icon gn-level-icon">🎉</span>
              <span className="gn-text">Level Up! You're now <strong>Level {notif.level}</strong></span>
            </>
          )}
          {notif.type === 'badge' && (
            <>
              <span className="gn-icon">{notif.badge.icon}</span>
              <span className="gn-text">
                Badge unlocked: <strong>{notif.badge.name}</strong>
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default GamificationNotifications;
