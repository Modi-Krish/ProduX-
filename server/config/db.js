const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Auto-migrate users without customIds
    const User = require('../models/User');
    const usersWithoutId = await User.find({ 
      $or: [
        { customId: { $exists: false } }, 
        { customId: null }, 
        { customId: '' }
      ] 
    });
    
    if (usersWithoutId.length > 0) {
      console.log(`⚡ Found ${usersWithoutId.length} users without customIds. Running auto-migration...`);
      for (const u of usersWithoutId) {
        await u.save();
      }
      console.log('✅ Auto-migration complete! All users now have a unique customId.');
    }
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
