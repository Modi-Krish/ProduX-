const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'In Progress', 'Completed'],
        message: '{VALUE} is not a valid status',
      },
      default: 'Pending',
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
    },
    subtasks: [
      {
        title: { type: String, required: true },
        isCompleted: { type: Boolean, default: false },
      },
    ],
    repeat: {
      type: String,
      enum: ['None', 'Daily', 'Weekly'],
      default: 'None',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performance
taskSchema.index({ deadline: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
