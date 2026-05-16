import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllHabits, addHabit } from '../features/habits/habitSlice';
import HabitCard from './HabitCard';
import { HiPlus, HiRefresh } from 'react-icons/hi';
import toast from 'react-hot-toast';

const HabitSection = () => {
  const dispatch = useDispatch();
  const { items: habits, isLoading } = useSelector((state) => state.habits);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState('Daily');

  useEffect(() => {
    dispatch(fetchAllHabits());
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await dispatch(addHabit({ title, frequency })).unwrap();
      setTitle('');
      setShowAdd(false);
      toast.success('Habit added!');
    } catch (err) {
      toast.error(err || 'Failed to add habit');
    }
  };

  return (
    <div className="habit-section">
      <div className="section-header">
        <div className="section-title-group">
          <h2>Daily Habits</h2>
          <span className="badge-count">{habits.length}</span>
        </div>
        <div className="section-actions">
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => dispatch(fetchAllHabits())}
            title="Refresh habits"
          >
            <HiRefresh className={isLoading ? 'spin' : ''} />
          </button>
          <button 
            className={`btn btn-primary btn-sm ${showAdd ? 'btn-danger' : ''}`}
            onClick={() => setShowAdd(!showAdd)}
          >
            {showAdd ? 'Cancel' : <><HiPlus /> Add Habit</>}
          </button>
        </div>
      </div>

      {showAdd && (
        <form className="habit-add-form card-slide" onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="e.g. Morning Meditation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group row">
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
            </select>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      )}

      {isLoading && habits.length === 0 ? (
        <div className="habit-list">
          <div className="skeleton skeleton-card" style={{ height: '70px' }} />
          <div className="skeleton skeleton-card" style={{ height: '70px' }} />
        </div>
      ) : habits.length === 0 ? (
        <div className="empty-habits">
          <p>No habits tracked yet. Start building a routine!</p>
        </div>
      ) : (
        <div className="habit-list">
          {habits.map((habit) => (
            <HabitCard key={habit._id} habit={habit} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HabitSection;
