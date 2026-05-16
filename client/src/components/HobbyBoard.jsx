import { motion } from 'framer-motion';
import { HiFire, HiClock, HiCheckCircle } from 'react-icons/hi';

const getTargetTime = (day) => {
  if (day <= 3) return 60;
  if (day <= 7) return 90;
  if (day <= 14) return 120;
  return 150;
};

const HobbyBoard = ({ hobby }) => {
  const currentDay = hobby.currentDay;
  const days = Array.from({ length: 21 }, (_, i) => i + 1);

  return (
    <div className="hobby-board-container">
      <div className="hobby-board-header">
        <h3>{hobby.title}</h3>
        <div className="hobby-meta">
          <span className="badge-day">Day {currentDay}/21</span>
          <span className="badge-target">
            <HiClock /> {getTargetTime(currentDay)}m Today
          </span>
        </div>
      </div>

      <div className="isometric-scene">
        <div className="isometric-map">
          {days.map((day) => {
            const isCompleted = day < currentDay;
            const isCurrent = day === currentDay;
            const target = getTargetTime(day);
            
            // Define colors based on phase
            let phaseColor = 'phase-1';
            if (day > 3) phaseColor = 'phase-2';
            if (day > 7) phaseColor = 'phase-3';
            if (day > 14) phaseColor = 'phase-4';

            return (
              <motion.div
                key={day}
                className={`iso-tile ${phaseColor} ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: day * 0.03 }}
              >
                <div className="tile-content">
                  <span className="tile-day">{day}</span>
                  {isCompleted && <HiCheckCircle className="tile-check" />}
                  {isCurrent && <div className="tile-glow" />}
                </div>
                
                {/* Decorative elements for specific days (like in the image) */}
                {day === 1 && <div className="iso-decor tree" />}
                {day === 7 && <div className="iso-decor gift" />}
                {day === 14 && <div className="iso-decor star" />}
                {day === 21 && <div className="iso-decor trophy" />}
                
                {/* Floating tooltips on hover */}
                <div className="tile-tooltip">
                  Target: {target} mins
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="hobby-progress-footer">
        <div className="progress-bar-container">
          <div 
            className="progress-fill" 
            style={{ width: `${(hobby.timeSpentToday / getTargetTime(currentDay)) * 100}%` }}
          />
        </div>
        <div className="progress-text">
          {hobby.timeSpentToday} / {getTargetTime(currentDay)} mins recorded today
        </div>
      </div>
    </div>
  );
};

export default HobbyBoard;
