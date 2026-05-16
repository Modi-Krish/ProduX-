const EmptyState = ({ message = 'No tasks yet', sub = 'Create your first task to get started!' }) => {
  return (
    <div className="empty-state">
      <div className="empty-icon">📋</div>
      <h3>{message}</h3>
      <p>{sub}</p>
    </div>
  );
};

export default EmptyState;
