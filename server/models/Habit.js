const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Habit title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    frequency: {
      type: String,
      enum: ['Daily', 'Weekly'],
      default: 'Daily',
    },
    streak: {
      type: Number,
      default: 0,
    },
    lastCompleted: {
      type: Date,
      default: null,
    },
    history: [
      {
        date: { type: Date, default: Date.now },
        xpGained: { type: Number },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Habit', habitSchema);
