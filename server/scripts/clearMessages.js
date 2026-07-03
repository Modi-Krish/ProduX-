const { db } = require('../config/firebase');

async function clearMessages() {
  console.log('Fetching all messages from Firestore...');
  const messagesSnap = await db.collection('messages').get();
  
  if (messagesSnap.empty) {
    console.log('No messages found to delete.');
    process.exit(0);
  }

  console.log(`Found ${messagesSnap.size} messages. Deleting...`);
  const batch = db.batch();
  
  messagesSnap.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log('✅ Successfully deleted all messages.');
  
  // Also clear groups
  console.log('Fetching all groups from Firestore...');
  const groupsSnap = await db.collection('groups').get();
  if (!groupsSnap.empty) {
    console.log(`Found ${groupsSnap.size} groups. Deleting...`);
    const groupBatch = db.batch();
    groupsSnap.forEach((doc) => {
      groupBatch.delete(doc.ref);
    });
    await groupBatch.commit();
    console.log('✅ Successfully deleted all groups.');
  }

  process.exit(0);
}

clearMessages().catch((err) => {
  console.error('Error clearing database:', err);
  process.exit(1);
});
