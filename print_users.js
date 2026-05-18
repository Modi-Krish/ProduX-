const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./server/models/User');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}).select('name email customId');
    console.log('--- ALL REGISTERED USERS ---');
    users.forEach(u => {
      console.log(`Name: ${u.name} | Email: ${u.email} | CustomID: ${u.customId}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
