import { useDispatch } from 'react-redux';
import { removeTask, setSubtaskStatus, editTask } from '../features/tasks/taskSlice';
import { getDashboard } from '../features/dashboard/dashboardSlice';
import { progressHobby } from '../features/hobbies/hobbySlice';
import { 
  HiClock, HiTag, HiTrash, HiPencil, HiCheckCircle, 
  HiChevronDown, HiChevronUp, HiPlay, HiRefresh, HiCheck,
  HiFire
} from 'react-icons/hi';
import { useState } from 'react';
import toast from 'react-hot-toast';

const getTargetTime = (day) => {
  if (day <= 3) return 60;
  if (day <= 7) return 90;
  if (day <= 14) return 120;
  return 150;
};

const TaskCard = ({ task, onEdit }) => {
  const dispatch = useDispatch();
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [minutes, setMinutes] = useState(30);

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

  const handleRecordTime = async () => {
    if (!task.hobbyId?._id) return;
    try {
      await dispatch(progressHobby({ id: task.hobbyId._id, minutes: Number(minutes) })).unwrap();
      toast.success(`Logged ${minutes} minutes!`);
    } catch (err) {
      toast.error(err || 'Failed to log time');
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
    if (task.priorityScore >= 90) return '#EF4444';
    if (task.priorityScore >= 70) return '#F97316';
    if (task.priorityScore >= 50) return '#F59E0B';
    return '#10B981';
  };

  const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const subtaskProgress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  const hobby = task.hobbyId;
  const is21Day = task.is21DayChallenge && hobby;

  return (
    <div className={`task-card ${task.status.toLowerCase().replace(' ', '-')} ${is21Day ? 'challenge-card' : ''}`}>
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
            {is21Day && (
              <span className="task-challenge-badge" onClick={() => setShowBoard(!showBoard)}>
                🏆 Day {hobby.currentDay}/21
              </span>
            )}
            {task.alarmTime && (
              <span className="task-alarm-badge" title={`Alarm: ${new Date(task.alarmTime).toLocaleString()}`}>
                ⏰ {new Date(task.alarmTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

      {task.attachments && task.attachments.length > 0 && (
        <div className="task-attachments" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {task.attachments.map((file, idx) => (
            <a 
              key={idx} 
              href={file.fileUrl || file.publicUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="task-attachment-chip"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.8rem',
                textDecoration: 'none',
                border: '1px solid var(--border)'
              }}
            >
              📎 {file.fileName}
            </a>
          ))}
        </div>
      )}

      {/* 21-Day Board */}
      {is21Day && (
        <div className="challenge-inline">
          <div 
            className="challenge-toggle" 
            onClick={() => setShowBoard(!showBoard)}
          >
            <HiFire style={{ color: '#F97316' }} />
            <span>Day {hobby.currentDay} of 21 — Target: {getTargetTime(hobby.currentDay)} mins</span>
            {showBoard ? <HiChevronUp /> : <HiChevronDown />}
          </div>

          {showBoard && (
            <div className="challenge-board">
              <div className="day-grid">
                {Array.from({ length: 21 }, (_, i) => i + 1).map((day) => {
                  const isCompleted = day < hobby.currentDay;
                  const isCurrent = day === hobby.currentDay;
                  let phase = 'p1';
                  if (day > 3) phase = 'p2';
                  if (day > 7) phase = 'p3';
                  if (day > 14) phase = 'p4';

                  return (
                    <div 
                      key={day} 
                      className={`day-tile ${phase} ${isCompleted ? 'done' : ''} ${isCurrent ? 'now' : ''}`}
                      title={`Day ${day}: ${getTargetTime(day)} mins`}
                    >
                      <span>{day}</span>
                      {isCompleted && <HiCheckCircle className="day-check" />}
                      {day === 7 && <span className="day-decor">🎁</span>}
                      {day === 14 && <span className="day-decor">⭐</span>}
                      {day === 21 && <span className="day-decor">🏆</span>}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar for today */}
              <div className="today-progress">
                <div className="today-bar">
                  <div 
                    className="today-fill" 
                    style={{ width: `${Math.min(100, (hobby.timeSpentToday / getTargetTime(hobby.currentDay)) * 100)}%` }} 
                  />
                </div>
                <span className="today-label">{hobby.timeSpentToday}/{getTargetTime(hobby.currentDay)} mins today</span>
              </div>

              {/* Record time input */}
              {!hobby.isCompleted && (
                <div className="record-time-row">
                  <input
                    type="number"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    min="1"
                    max="300"
                    className="time-input"
                  />
                  <span className="time-label">mins</span>
                  <button className="btn btn-primary btn-sm" onClick={handleRecordTime}>
                    <HiPlay /> Record
                  </button>
                </div>
              )}

              {hobby.isCompleted && (
                <div className="challenge-mastered">
                  🏆 Challenge Mastered! You've built a lifelong habit.
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
