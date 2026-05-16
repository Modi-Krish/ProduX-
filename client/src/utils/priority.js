/**
 * Client-side priority calculation — mirrors server logic.
 * Used as fallback for immediate UI feedback.
 */

export function calculatePriority(task) {
  if (task.status === 'Completed') return 0;
  if (!task.deadline) return 20;

  const now = new Date();
  const deadline = new Date(task.deadline);
  const hoursLeft = (deadline - now) / (1000 * 60 * 60);

  if (hoursLeft < 0) return 100;
  if (hoursLeft <= 6) return 90;
  if (hoursLeft <= 24) return 70;
  if (hoursLeft <= 72) return 50;
  if (hoursLeft <= 168) return 35;
  return 20;
}

export function getPriorityLabel(score) {
  if (score >= 100) return 'Overdue';
  if (score >= 90) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  if (score >= 35) return 'Low';
  return 'Minimal';
}

export function getPriorityColor(score) {
  if (score >= 100) return '#EF4444';
  if (score >= 90) return '#F97316';
  if (score >= 70) return '#FBBF24';
  if (score >= 50) return '#8B5CF6';
  if (score >= 35) return '#34D399';
  return '#94A3B8';
}

export function formatDeadline(deadline) {
  if (!deadline) return 'No deadline';
  const d = new Date(deadline);
  const now = new Date();
  const diff = d - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (diff < 0) {
    const overHours = Math.abs(hours);
    if (overHours < 24) return `${overHours}h overdue`;
    return `${Math.abs(days)}d overdue`;
  }
  if (hours < 1) return 'Due soon';
  if (hours < 24) return `${hours}h left`;
  if (days < 7) return `${days}d left`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
