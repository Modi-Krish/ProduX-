import { useDispatch } from 'react-redux';
import { removeTask, setSubtaskStatus, editTask } from '../features/tasks/taskSlice';
import { getDashboard } from '../features/dashboard/dashboardSlice';
import { 
  HiClock, HiTag, HiTrash, HiPencil, HiCheckCircle, 
  HiChevronDown, HiChevronUp, HiPlay, HiRefresh, HiCheck 
} from 'react-icons/hi';
import { useState } from 'react';
import toast from 'react-hot-toast';

const TaskCard = ({ task, onEdit }) => {
  const dispatch = useDispatch();
  const [showSubtasks, setShowSubtasks] = useState(false);

  const handleDelete = async () => {
    if (window.confirm('Delete this task?')) {
      try {
        await dispatch(removeTask(task._id)).unwrap();
        toast.success('Task deleted');
        dispatch(getDashboard());
      } catch (err) {
        toast.error(err || 'Failed to delete task');
      }
    }
  };

  const handleStatusChange = async (nextStatus) => {
    try {
      await dispatch(editTask({ id: task._id, data: { status: nextStatus } })).unwrap();
      toast.success(`Task moved to ${nextStatus}`);
      dispatch(getDashboard());
    } catch (err) {
      toast.error(err || 'Failed to update status');
    }
  };

  const handleToggleSubtask = async (subtaskId) => {
    try {
      await dispatch(setSubtaskStatus({ taskId: task._id, subtaskId })).unwrap();
    } catch (err) {
      toast.error(err || 'Failed to update subtask');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityColor = () => {
    if (task.priorityScore >= 90) return '#EF4444'; // Red
    if (task.priorityScore >= 70) return '#F97316'; // Orange
    if (task.priorityScore >= 50) return '#F59E0B'; // Yellow
    return '#10B981'; // Green
  };

  const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const subtaskProgress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  return (
    <div className={`task-card ${task.status.toLowerCase().replace(' ', '-')}`}>
      <div className="task-header">
        <div className="task-main">
          <h3 className="task-title">{task.title}</h3>
          <div className="task-meta">
            <span className="task-deadline">
              <HiClock /> {formatDate(task.deadline)}
            </span>
            <span className="task-category">
              <HiTag /> {task.category}
            </span>
            {task.repeat && task.repeat !== 'None' && (
              <span className="task-habit-badge">
                {task.repeat === 'Daily' ? '📅' : '🗓️'} {task.repeat}
              </span>
            )}
          </div>
        </div>
        <div 
          className="priority-indicator" 
          style={{ backgroundColor: getPriorityColor() }}
          title={`Priority Score: ${task.priorityScore}`}
        />
      </div>

      <p className="task-desc">{task.description}</p>

      {/* Subtasks Progress */}
      {totalSubtasks > 0 && (
        <div className="task-subtasks-preview" onClick={() => setShowSubtasks(!showSubtasks)}>
          <div className="subtask-progress-info">
            <span>Subtasks: {completedSubtasks}/{totalSubtasks}</span>
            {showSubtasks ? <HiChevronUp /> : <HiChevronDown />}
          </div>
          <div className="subtask-progress-bar">
            <div className="subtask-progress-fill" style={{ width: `${subtaskProgress}%` }} />
          </div>
        </div>
      )}

      {/* Expanded Subtasks */}
      {showSubtasks && totalSubtasks > 0 && (
        <div className="subtasks-list">
          {task.subtasks.map((sub) => (
            <div 
              key={sub._id} 
              className={`subtask-item ${sub.isCompleted ? 'completed' : ''}`}
              onClick={() => handleToggleSubtask(sub._id)}
            >
              <HiCheckCircle className="subtask-check" />
              <span>{sub.title}</span>
            </div>
          ))}
        </div>
      )}

      <div className="task-footer">
        <div className={`status-badge ${task.status.toLowerCase().replace(' ', '-')}`}>
          {task.status}
        </div>
        <div className="task-actions">
          {/* Status Controls */}
          {task.status === 'Pending' && (
            <button className="btn-ghost start" onClick={() => handleStatusChange('In Progress')} title="Start Task">
              <HiPlay />
            </button>
          )}
          {task.status === 'In Progress' && (
            <>
              <button className="btn-ghost reverse" onClick={() => handleStatusChange('Pending')} title="Reverse to Pending">
                <HiRefresh />
              </button>
              <button className="btn-ghost complete" onClick={() => handleStatusChange('Completed')} title="Complete Task">
                <HiCheck />
              </button>
            </>
          )}
          {task.status === 'Completed' && (
            <button className="btn-ghost reverse" onClick={() => handleStatusChange('In Progress')} title="Reverse to In Progress">
              <HiRefresh />
            </button>
          )}

          <div className="action-divider" />

          <button className="btn-ghost" onClick={() => onEdit(task)} title="Edit Task">
            <HiPencil />
          </button>
          <button className="btn-ghost delete" onClick={handleDelete} title="Delete Task">
            <HiTrash />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
