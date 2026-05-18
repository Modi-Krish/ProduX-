const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    customId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // ── Gamification Fields ──
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    streak: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastCompletedDate: {
      type: Date,
      default: null,
    },
    totalTasksCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    badges: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String },
        icon: { type: String },
        earnedAt: { type: Date, default: Date.now },
      },
    ],
    pushSubscriptions: {
      type: Array,
      default: []
    }
  },
  {
    timestamps: true,
  }
);

// Auto-generate customId if not present
userSchema.pre('save', async function () {
  if (!this.customId) {
    let isUnique = false;
    let generatedId = '';
    const User = this.constructor;
    
    while (!isUnique) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      generatedId = `PRDX-${randomNum}`;
      const existing = await User.findOne({ customId: generatedId });
      if (!existing) {
        isUnique = true;
      }
    }
    this.customId = generatedId;
  }
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
