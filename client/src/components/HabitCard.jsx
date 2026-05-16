import { useDispatch } from 'react-redux';
import { checkHabit, removeHabit } from '../features/habits/habitSlice';
import { HiFire, HiCheckCircle, HiTrash } from 'react-icons/hi';
import toast from 'react-hot-toast';

const HabitCard = ({ habit }) => {
  const dispatch = useDispatch();

  const handleComplete = async () => {
    try {
      const res = await dispatch(checkHabit(habit._id)).unwrap();
      if (res.message === 'Already completed today') {
        toast.error('Habit already completed today!');
      } else {
        toast.success('Habit completed! +20 XP');
      }
    } catch (err) {
      toast.error(err || 'Failed to complete habit');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this habit?')) {
      try {
        await dispatch(removeHabit(habit._id)).unwrap();
        toast.success('Habit deleted');
      } catch (err) {
        toast.error(err || 'Failed to delete habit');
      }
    }
  };

  const isCompletedToday = () => {
    if (!habit.lastCompleted) return false;
    const lastDate = new Date(habit.lastCompleted);
    const today = new Date();
    return (
      lastDate.getDate() === today.getDate() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getFullYear() === today.getFullYear()
    );
  };

  const completed = isCompletedToday();

  return (
    <div className={`habit-card ${completed ? 'completed' : ''}`}>
      <div className="habit-info">
        <h3 className="habit-title">{habit.title}</h3>
        <p className="habit-freq">{habit.frequency}</p>
      </div>
      
      <div className="habit-stats">
        <div className={`habit-streak ${habit.streak > 0 ? 'active' : ''}`}>
          <HiFire />
          <span>{habit.streak}</span>
        </div>
      </div>

      <div className="habit-actions">
        <button 
          className={`btn-check ${completed ? 'checked' : ''}`}
          onClick={handleComplete}
          disabled={completed}
          title={completed ? "Already completed today" : "Mark as done"}
        >
          <HiCheckCircle />
        </button>
        <button 
          className="btn-delete-small"
          onClick={handleDelete}
          title="Delete habit"
        >
          <HiTrash />
        </button>
      </div>
    </div>
  );
};

export default HabitCard;
