/**
 * Priority Service
 * Calculates dynamic priority scores for tasks based on deadline proximity.
 * Priority is NEVER stored in the database — always computed at runtime.
 */

/**
 * Calculate priority score for a single task
 * @param {Object} task - Task document
 * @returns {number} Priority score (0-100)
 */
function calculatePriority(task) {
  // Completed tasks always get lowest priority
  if (task.status === 'Completed') return 0;

  // Tasks without deadline get baseline low priority
  if (!task.deadline) return 20;

  const now = new Date();
  const deadline = new Date(task.deadline);
  const hoursLeft = (deadline - now) / (1000 * 60 * 60);

  if (hoursLeft < 0) return 100;       // OVERDUE — highest priority
  if (hoursLeft <= 6) return 90;       // Critical — due within 6 hours
  if (hoursLeft <= 24) return 70;      // High — due within 1 day
  if (hoursLeft <= 72) return 50;      // Medium — due within 3 days
  if (hoursLeft <= 168) return 35;     // Low — due within 1 week
  return 20;                           // Minimal — more than 1 week out
}

/**
 * Get priority label from score
 * @param {number} score - Priority score
 * @returns {string} Priority label
 */
function getPriorityLabel(score) {
  if (score >= 100) return 'Overdue';
  if (score >= 90) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  if (score >= 35) return 'Low';
  return 'Minimal';
}

/**
 * Check if a task is overdue
 * @param {Object} task - Task document
 * @returns {boolean}
 */
function isOverdue(task) {
  if (task.status === 'Completed' || !task.deadline) return false;
  return new Date(task.deadline) < new Date();
}

/**
 * Attach priority metadata to a task object
 * @param {Object} task - Task document (plain object or mongoose doc)
 * @returns {Object} Task with priority fields
 */
function attachPriority(task) {
  const taskObj = task.toObject ? task.toObject() : { ...task };
  const score = calculatePriority(taskObj);
  return {
    ...taskObj,
    priorityScore: score,
    priorityLabel: getPriorityLabel(score),
    isOverdue: isOverdue(taskObj),
  };
}

/**
 * Sort tasks by priority (highest first), then by deadline (earliest first)
 * @param {Array} tasks - Array of task documents
 * @returns {Array} Sorted tasks with priority metadata
 */
function sortByPriority(tasks) {
  return tasks
    .map(attachPriority)
    .sort((a, b) => {
      // Higher priority first
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      // Same priority → earlier deadline first
      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return deadlineA - deadlineB;
    });
}

module.exports = {
  calculatePriority,
  getPriorityLabel,
  isOverdue,
  attachPriority,
  sortByPriority,
};
