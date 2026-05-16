import { useSelector } from 'react-redux';

const BadgeModal = ({ onClose }) => {
  const { stats } = useSelector((state) => state.gamification);

  if (!stats) return null;

  const allBadges = stats.allBadges || [];
  const earned = allBadges.filter((b) => b.earned);
  const locked = allBadges.filter((b) => !b.earned);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content badge-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>🏆 Achievements</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="badge-progress-summary">
          <div className="badge-progress-ring">
            <span className="badge-earned-count">{earned.length}</span>
            <span className="badge-total-count">/ {allBadges.length}</span>
          </div>
          <p className="badge-progress-text">
            {earned.length === allBadges.length
              ? '🎉 All badges unlocked!'
              : `${allBadges.length - earned.length} more to unlock`}
          </p>
        </div>

        {earned.length > 0 && (
          <div className="badge-section">
            <h3 className="badge-section-title">Unlocked</h3>
            <div className="badge-grid">
              {earned.map((badge) => (
                <div key={badge.id} className="badge-card earned">
                  <div className="badge-card-icon">{badge.icon}</div>
                  <div className="badge-card-info">
                    <div className="badge-card-name">{badge.name}</div>
                    <div className="badge-card-desc">{badge.description}</div>
                    {badge.earnedAt && (
                      <div className="badge-card-date">
                        {new Date(badge.earnedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {locked.length > 0 && (
          <div className="badge-section">
            <h3 className="badge-section-title">Locked</h3>
            <div className="badge-grid">
              {locked.map((badge) => (
                <div key={badge.id} className="badge-card locked">
                  <div className="badge-card-icon locked-icon">🔒</div>
                  <div className="badge-card-info">
                    <div className="badge-card-name">{badge.name}</div>
                    <div className="badge-card-desc">{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BadgeModal;
