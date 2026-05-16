import { useState, useEffect } from 'react';
import { HiX } from 'react-icons/hi';

const CATEGORIES = ['General', 'Work', 'Personal', 'Study', 'Health', 'Finance', 'Other'];

const TaskForm = ({ onSubmit, onClose, initialData = null, isLoading = false }) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    category: initialData?.category || 'General',
    deadline: initialData?.deadline ? new Date(initialData.deadline).toISOString().slice(0, 16) : '',
    status: initialData?.status || 'Pending',
    subtasks: initialData?.subtasks || [],
    repeat: initialData?.repeat || 'None',
  });

  const [newSubtask, setNewSubtask] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setFormData({
      ...formData,
      subtasks: [...formData.subtasks, { title: newSubtask, isCompleted: false }]
    });
    setNewSubtask('');
  };

  const removeSubtask = (index) => {
    setFormData({
      ...formData,
      subtasks: formData.subtasks.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.deadline) return;
    onSubmit({
      ...formData,
      deadline: new Date(formData.deadline).toISOString(),
    });
  };

  const isEditing = !!initialData;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Task' : 'Create New Task'}</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            <HiX size={20} />
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="task-title">Title</label>
            <input
              id="task-title"
              className="form-input"
              type="text"
              name="title"
              placeholder="What needs to be done?"
              value={formData.title}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-description">Description</label>
            <input
              id="task-description"
              className="form-input"
              type="text"
              name="description"
              placeholder="Optional details..."
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="task-category">Category</label>
              <input
                id="task-category"
                className="form-input"
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-deadline">Deadline</label>
              <input
                id="task-deadline"
                className="form-input"
                type="datetime-local"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Subtasks Section */}
          <div className="form-group">
            <label className="form-label">Subtasks (Optional)</label>
            <div className="subtask-add-row" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                className="form-input"
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add subtask..."
                style={{ flex: 1 }}
              />
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={addSubtask}
                style={{ whiteSpace: 'nowrap' }}
              >
                Add
              </button>
            </div>
            <div className="subtasks-preview-list">
              {formData.subtasks.map((sub, index) => (
                <div 
                  key={index} 
                  className="subtask-preview-item"
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--muted)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '6px',
                    border: '1px solid var(--border)'
                  }}
                >
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{sub.title}</span>
                  <button 
                    type="button" 
                    onClick={() => removeSubtask(index)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#EF4444', 
                      cursor: 'pointer',
                      fontSize: '1.1rem'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Repeat as Habit — only on create */}
          {!isEditing && (
            <div className="form-group">
              <label className="form-label">Repeat as Habit</label>
              <div className="repeat-selector">
                {['None', 'Daily', 'Weekly'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`repeat-pill ${formData.repeat === opt ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, repeat: opt })}
                  >
                    {opt === 'None' && '🚫'}
                    {opt === 'Daily' && '📅'}
                    {opt === 'Weekly' && '🗓️'}
                    {' '}{opt}
                  </button>
                ))}
              </div>
              {formData.repeat !== 'None' && (
                <p className="repeat-hint">
                  This task will also be tracked as a <strong>{formData.repeat.toLowerCase()}</strong> habit for streaks & bonus XP.
                </p>
              )}
            </div>
          )}

          {isEditing && (
            <div className="form-group">
              <label className="form-label" htmlFor="task-status">Status</label>
              <select
                id="task-status"
                className="form-select"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? (
                <span className="spinner" />
              ) : isEditing ? (
                'Update Task'
              ) : (
                'Create Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;
