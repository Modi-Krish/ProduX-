import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getGamificationStats } from '../features/gamification/gamificationSlice';
import { HiLightningBolt, HiFire, HiStar, HiTrendingUp } from 'react-icons/hi';

const GamifiedHeader = ({ onBadgesClick }) => {
  const dispatch = useDispatch();
  const { stats, isLoading } = useSelector((state) => state.gamification);

  useEffect(() => {
    dispatch(getGamificationStats());
  }, [dispatch]);

  if (isLoading || !stats) {
    return (
      <div className="gamified-header">
        <div className="gamified-header-inner">
          <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>
    );
  }

  const xpInCurrentLevel = stats.xp - stats.xpForCurrentLevel;
  const xpNeededForLevel = stats.xpForNextLevel - stats.xpForCurrentLevel;
  const progressPercent = xpNeededForLevel > 0
    ? Math.min((xpInCurrentLevel / xpNeededForLevel) * 100, 100)
    : 100;

  const earnedBadges = stats.allBadges?.filter((b) => b.earned) || [];

  return (
    <div className="gamified-header">
      <div className="gamified-header-inner">
        {/* Level Badge */}
        <div className="gh-level-badge">
          <div className="gh-level-ring">
            <svg viewBox="0 0 36 36" className="gh-ring-svg">
              <path
                className="gh-ring-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="gh-ring-fill"
                strokeDasharray={`${progressPercent}, 100`}
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="gh-level-number">{stats.level}</div>
          </div>
          <div className="gh-level-label">LEVEL</div>
        </div>

        {/* XP Bar */}
        <div className="gh-xp-section">
          <div className="gh-xp-info">
            <span className="gh-xp-label">
              <HiLightningBolt className="gh-xp-icon" />
              {stats.xp} XP
            </span>
            <span className="gh-xp-next">
              {xpNeededForLevel - xpInCurrentLevel} XP to Level {stats.level + 1}
            </span>
          </div>
          <div className="gh-xp-bar-track">
            <div
              className="gh-xp-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
            <div className="gh-xp-bar-glow" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="gh-stats-row">
          <div className="gh-stat" title="Current Streak">
            <HiFire className={`gh-stat-icon fire ${stats.streak > 0 ? 'active' : ''}`} />
            <span className="gh-stat-value">{stats.streak}</span>
            <span className="gh-stat-label">Streak</span>
          </div>
          <div className="gh-stat" title="Longest Streak">
            <HiTrendingUp className="gh-stat-icon trend" />
            <span className="gh-stat-value">{stats.longestStreak}</span>
            <span className="gh-stat-label">Best</span>
          </div>
          <div className="gh-stat" title="Tasks Completed">
            <HiStar className="gh-stat-icon star" />
            <span className="gh-stat-value">{stats.totalTasksCompleted}</span>
            <span className="gh-stat-label">Done</span>
          </div>
        </div>

        {/* Badges Preview */}
        {earnedBadges.length > 0 && (
          <div className="gh-badges-preview" onClick={onBadgesClick}>
            <div className="gh-badges-icons">
              {earnedBadges.slice(0, 5).map((b) => (
                <span key={b.id} className="gh-badge-icon" title={b.name}>
                  {b.icon}
                </span>
              ))}
              {earnedBadges.length > 5 && (
                <span className="gh-badge-more">+{earnedBadges.length - 5}</span>
              )}
            </div>
            <span className="gh-badges-label">
              {earnedBadges.length} Badge{earnedBadges.length !== 1 ? 's' : ''} Earned →
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamifiedHeader;
