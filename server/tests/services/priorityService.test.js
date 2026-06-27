const { calculatePriority, getPriorityLabel, isOverdue } = require('../../services/priorityService');

describe('Priority Service', () => {
  describe('calculatePriority', () => {
    it('should return 0 for completed tasks', () => {
      const task = { status: 'Completed', deadline: new Date(Date.now() - 1000).toISOString() };
      expect(calculatePriority(task)).toBe(0);
    });

    it('should return 20 for tasks without a deadline', () => {
      const task = { status: 'Pending' };
      expect(calculatePriority(task)).toBe(20);
    });

    it('should return 100 for overdue tasks', () => {
      const task = { status: 'Pending', deadline: new Date(Date.now() - 3600000).toISOString() }; // 1 hour ago
      expect(calculatePriority(task)).toBe(100);
    });

    it('should return 90 for tasks due within 6 hours', () => {
      const task = { status: 'Pending', deadline: new Date(Date.now() + 3 * 3600000).toISOString() }; // in 3 hours
      expect(calculatePriority(task)).toBe(90);
    });

    it('should return 70 for tasks due within 24 hours', () => {
      const task = { status: 'Pending', deadline: new Date(Date.now() + 12 * 3600000).toISOString() }; // in 12 hours
      expect(calculatePriority(task)).toBe(70);
    });
  });

  describe('getPriorityLabel', () => {
    it('should return correct labels', () => {
      expect(getPriorityLabel(100)).toBe('Overdue');
      expect(getPriorityLabel(90)).toBe('Critical');
      expect(getPriorityLabel(70)).toBe('High');
      expect(getPriorityLabel(50)).toBe('Medium');
      expect(getPriorityLabel(35)).toBe('Low');
      expect(getPriorityLabel(20)).toBe('Minimal');
      expect(getPriorityLabel(0)).toBe('Minimal');
    });
  });

  describe('isOverdue', () => {
    it('should return true if deadline is past and not completed', () => {
      const task = { status: 'Pending', deadline: new Date(Date.now() - 3600000).toISOString() };
      expect(isOverdue(task)).toBe(true);
    });

    it('should return false if completed', () => {
      const task = { status: 'Completed', deadline: new Date(Date.now() - 3600000).toISOString() };
      expect(isOverdue(task)).toBe(false);
    });

    it('should return false if deadline is in the future', () => {
      const task = { status: 'Pending', deadline: new Date(Date.now() + 3600000).toISOString() };
      expect(isOverdue(task)).toBe(false);
    });
  });
});
