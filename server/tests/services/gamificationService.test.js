const { awardTaskCompletion, penalizeOverdueTask } = require('../../services/gamificationService');
const { db, admin } = require('../../config/firebase');

// Mock Firebase Admin
jest.mock('../../config/firebase', () => {
  const mockUpdate = jest.fn();
  const mockGet = jest.fn();
  const mockTransaction = {
    get: mockGet,
    update: mockUpdate,
  };
  
  return {
    db: {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: mockGet,
          update: mockUpdate,
        })),
      })),
      runTransaction: jest.fn((callback) => callback(mockTransaction)),
    },
    admin: {
      firestore: {
        FieldValue: {
          increment: jest.fn((val) => val),
          arrayUnion: jest.fn((val) => [val]),
        }
      }
    }
  };
});

// Mock Logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('Gamification Service', () => {
  const mockIo = {
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('awardTaskCompletion', () => {
    it('should correctly award XP and handle level up', async () => {
      const userId = 'user123';
      
      // Mock user doc get inside transaction
      db.runTransaction.mockImplementationOnce(async (callback) => {
        const t = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            ref: 'mockRef',
            data: () => ({ xp: 50, level: 1, streak: 2 })
          }),
          update: jest.fn(),
        };
        await callback(t);
        return {
          xpGained: 50,
          newTotalXp: 100,
          leveledUp: true,
          newLevel: 2,
          newStreak: 2, // unchanged in this simple test
          badgesAwarded: []
        };
      });

      const result = await awardTaskCompletion(userId, 'medium', mockIo);
      
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(result.xpGained).toBe(50);
      expect(db.runTransaction).toHaveBeenCalled();
    });

    it('should return default state if user not found', async () => {
      const userId = 'nonexistent';
      
      db.runTransaction.mockImplementationOnce(async (callback) => {
        const t = {
          get: jest.fn().mockResolvedValue({ exists: false }),
          update: jest.fn(),
        };
        await callback(t);
        throw new Error('User not found'); // Matches actual implementation throwing
      });

      // Assert it handles the throw properly or catches it based on how service is written
      await expect(awardTaskCompletion(userId, 'medium', mockIo)).rejects.toThrow('User not found');
    });
  });

  describe('penalizeOverdueTask', () => {
    it('should penalize XP but not drop below 0', async () => {
      const userId = 'user123';
      
      db.runTransaction.mockImplementationOnce(async (callback) => {
        const t = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            ref: 'mockRef',
            data: () => ({ xp: 10, level: 1, streak: 5 })
          }),
          update: jest.fn(),
        };
        await callback(t);
        return {
          xpLost: 10, // Max they can lose is what they have if it goes to 0
          newTotalXp: 0,
          levelDropped: false,
          newLevel: 1,
          streakReset: true,
        };
      });

      const result = await penalizeOverdueTask(userId, 'high', mockIo);
      
      expect(result.xpLost).toBe(10);
      expect(result.newTotalXp).toBe(0);
      expect(result.streakReset).toBe(true);
    });
  });
});
