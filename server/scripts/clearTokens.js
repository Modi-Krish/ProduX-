const { db } = require('../config/firebase');

async function clearAllUserTokens() {
  console.log('Fetching all users from Firestore...');
  const usersSnap = await db.collection('users').get();

  if (usersSnap.empty) {
    console.log('No users found.');
    process.exit(0);
  }

  console.log(`Found ${usersSnap.size} users. Clearing fcmTokens and pushSubscriptions...`);
  const batch = db.batch();

  usersSnap.forEach((doc) => {
    batch.update(doc.ref, {
      fcmTokens: [],
      pushSubscriptions: [],
      updatedAt: new Date()
    });
  });

  await batch.commit();
  console.log('✅ Successfully cleared fcmTokens and pushSubscriptions for all users.');
  process.exit(0);
}

clearAllUserTokens().catch((err) => {
  console.error('Error clearing tokens:', err);
  process.exit(1);
});
