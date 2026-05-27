const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let adminApp = null;
let isFCMEnabled = false;
let db = null;

// Attempt environment-based initialization first (recommended for Vercel/Production)
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    // Strip surrounding quotes which Vercel sometimes retains from .env uploads
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      })
    });
    isFCMEnabled = true;
    db = admin.firestore();
    console.log('✅ Firebase Admin SDK Initialized via Environment Variables.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin via Environment Variables:', error.message);
  }
} 
// Fallback to service-account.json (recommended for local development)
else {
  const serviceAccountPath = path.join(__dirname, '../scripts/service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = require(serviceAccountPath);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      isFCMEnabled = true;
      db = admin.firestore();
      console.log('✅ Firebase Admin SDK Initialized via service-account.json.');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin SDK from file:', error.message);
    }
  } else {
    console.warn(
      '⚠️ Warning: Firebase Admin credentials not found (neither Env Variables nor "service-account.json" exist).\n' +
      'Firestore database operations will fail until credentials are provided.'
    );
  }
}

const formatDoc = (docSnap) => {
  if (!docSnap.exists) return null;
  const data = docSnap.data();
  // Standardize timestamp fields if present (e.g. converting Firestore Timestamps to JS Dates)
  Object.keys(data).forEach((key) => {
    if (data[key] && typeof data[key].toDate === 'function') {
      data[key] = data[key].toDate();
    } else if (Array.isArray(data[key])) {
      data[key] = data[key].map(item => {
        if (item && typeof item === 'object') {
          Object.keys(item).forEach(k => {
            if (item[k] && typeof item[k].toDate === 'function') {
              item[k] = item[k].toDate();
            }
          });
        }
        return item;
      });
    }
  });
  return {
    _id: docSnap.id,
    id: docSnap.id,
    ...data
  };
};

const formatDocs = (querySnap) => {
  const items = [];
  querySnap.forEach((doc) => {
    const formatted = formatDoc(doc);
    if (formatted) items.push(formatted);
  });
  return items;
};

module.exports = {
  admin,
  adminApp,
  db,
  isFCMEnabled,
  formatDoc,
  formatDocs
};
