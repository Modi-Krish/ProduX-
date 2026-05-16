import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllHobbies, addHobby, progressHobby } from '../features/hobbies/hobbySlice';
import HobbyBoard from './HobbyBoard';
import { HiPlus, HiClock, HiArrowCircleRight } from 'react-icons/hi';
import toast from 'react-hot-toast';

const HobbySection = () => {
  const dispatch = useDispatch();
  const { items: hobbies, isLoading } = useSelector((state) => state.hobbies);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [minutesToAdd, setMinutesToAdd] = useState(30);

  useEffect(() => {
    dispatch(fetchAllHobbies());
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await dispatch(addHobby({ title })).unwrap();
      setTitle('');
      setShowAdd(false);
      toast.success('Hobby challenge started! 21 days to go.');
    } catch (err) {
      toast.error(err || 'Failed to start hobby');
    }
  };

  const handleProgress = async (id) => {
    try {
      const res = await dispatch(progressHobby({ id, minutes: Number(minutesToAdd) })).unwrap();
      if (res.leveledUpForDay) {
        toast.success('Day completed! Bonus XP awarded!');
      } else {
        toast.success(`Logged ${minutesToAdd} minutes. Keep going!`);
      }
    } catch (err) {
      toast.error(err || 'Failed to update progress');
    }
  };

  return (
    <div className="hobby-section-main">
      <div className="section-header">
        <h2>21-Day Hobby Challenges</h2>
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? 'Cancel' : <><HiPlus /> New Hobby</>}
        </button>
      </div>

      {showAdd && (
        <form className="hobby-add-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="e.g. Guitar Practice, Learning Spanish"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
          />
          <button type="submit" className="btn btn-primary">Start Challenge</button>
        </form>
      )}

      <div className="hobbies-grid">
        {hobbies.map((hobby) => (
          <div key={hobby._id} className="hobby-item">
            <HobbyBoard hobby={hobby} />
            
            {!hobby.isCompleted && (
              <div className="hobby-log-time">
                <div className="log-input-group">
                  <label>Log Time (mins)</label>
                  <input
                    type="number"
                    value={minutesToAdd}
                    onChange={(e) => setMinutesToAdd(e.target.value)}
                    min="1"
                    max="300"
                  />
                </div>
                <button 
                  className="btn btn-secondary btn-full"
                  onClick={() => handleProgress(hobby._id)}
                >
                  <HiClock /> Record Session
                </button>
              </div>
            )}
            
            {hobby.isCompleted && (
              <div className="hobby-completed-banner">
                🏆 Challenge Mastered! You've built a lifelong habit.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HobbySection;
