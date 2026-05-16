const mongoose = require('mongoose');

const hobbySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Hobby title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    currentDay: {
      type: Number,
      default: 1, // Progresses from 1 to 21
    },
    timeSpentToday: {
      type: Number,
      default: 0, // in minutes
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    history: [
      {
        day: Number,
        timeSpent: Number,
        date: { type: Date, default: Date.now },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

// Helper to get target time for a specific day
hobbySchema.methods.getTargetTime = function(day = this.currentDay) {
  if (day <= 3) return 60; // 1 hour
  if (day <= 7) return 90; // 1.5 hours
  if (day <= 14) return 120; // 2 hours
  return 150; // 2.5 hours
};

module.exports = mongoose.model('Hobby', hobbySchema);
