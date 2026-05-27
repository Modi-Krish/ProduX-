const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../..', '.env') });

const { admin } = require('../config/firebase');

async function resetAllPasswords(newPassword = '12345678') {
  console.log(`🚀 Starting password reset for all Firebase Auth users...`);
  console.log(`🔑 Target Password: "${newPassword}"`);

  let count = 0;
  let nextPageToken;

  try {
    do {
      // List users in batches of 1000
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
      
      for (const userRecord of listUsersResult.users) {
        try {
          await admin.auth().updateUser(userRecord.uid, {
            password: newPassword,
          });
          console.log(`✅ Reset password for user: ${userRecord.email || userRecord.uid}`);
          count++;
        } catch (updateError) {
          console.error(`❌ Failed to reset password for user ${userRecord.email || userRecord.uid}:`, updateError.message);
        }
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`\n🎉 Success! Successfully reset passwords to "${newPassword}" for all ${count} users.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Critical Error during listing or resetting users:', error);
    process.exit(1);
  }
}

resetAllPasswords();
