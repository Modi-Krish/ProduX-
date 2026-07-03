const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Initialize S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Fetch voice history for a room
 * @route GET /api/voice/history/:roomId
 */
exports.getVoiceHistory = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const snapshot = await db.collection('voice_history')
      .where('roomId', '==', roomId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const history = [];
    snapshot.forEach(doc => {
      history.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json({
      success: true,
      data: history.reverse()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save voice history metadata
 * @route POST /api/voice/history
 */
exports.saveVoiceHistory = async (req, res, next) => {
  try {
    const { roomId, senderId, duration, audioUrl } = req.body;
    
    if (!roomId || !senderId || !audioUrl) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const docRef = await db.collection('voice_history').add({
      roomId,
      senderId,
      duration: duration || 0,
      audioUrl,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      data: { id: docRef.id }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get presigned URL for uploading audio to S3
 * @route GET /api/voice/upload-url
 */
exports.getUploadUrl = async (req, res, next) => {
  try {
    const { fileType, roomId } = req.query;
    if (!fileType || !roomId) {
      return res.status(400).json({ success: false, message: 'fileType and roomId are required' });
    }

    const key = `voice/${roomId}/${uuidv4()}.${fileType.split('/')[1] || 'webm'}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    res.status(200).json({
      success: true,
      data: { signedUrl, publicUrl, key }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Voice Settings
 * @route PUT /api/voice/settings
 */
exports.updateSettings = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const settings = req.body;

    await db.collection('voice_settings').doc(userId).set(settings, { merge: true });

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Voice Settings
 * @route GET /api/voice/settings
 */
exports.getSettings = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    const doc = await db.collection('voice_settings').doc(userId).get();
    
    if (!doc.exists) {
      return res.status(200).json({
        success: true,
        data: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          autoPlay: true,
        }
      });
    }

    res.status(200).json({
      success: true,
      data: doc.data()
    });
  } catch (error) {
    next(error);
  }
};
