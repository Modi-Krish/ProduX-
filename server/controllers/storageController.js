const { generateUploadUrl, deleteFile } = require('../services/storageService');
const logger = require('../utils/logger');

/**
 * @desc    Get a presigned upload URL
 * @route   POST /api/storage/presign
 * @access  Private
 */
const getPresignedUrl = async (req, res, next) => {
  try {
    const { originalName, mimeType, size, category, folder } = req.body;

    if (!originalName || !mimeType || !size || !category || !folder) {
      return res.status(400).json({ success: false, message: 'Missing required file details' });
    }

    // Basic folder validation to prevent path traversal
    const allowedFolders = ['avatars', 'chat', 'tasks', 'documents'];
    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({ success: false, message: 'Invalid folder specified' });
    }

    const uploadData = await generateUploadUrl(req.user._id, originalName, mimeType, size, category, folder);

    logger.info('Generated presigned URL', { userId: req.user._id, objectKey: uploadData.objectKey });

    res.status(200).json({
      success: true,
      data: uploadData,
    });
  } catch (error) {
    if (error.message.includes('Invalid file type') || error.message.includes('File too large')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc    Delete an object from storage
 * @route   DELETE /api/storage/delete
 * @access  Private
 */
const removeObject = async (req, res, next) => {
  try {
    const { objectKey } = req.body;

    if (!objectKey) {
      return res.status(400).json({ success: false, message: 'Missing object key' });
    }

    // Security Check: Only allow users to delete files from their own directory
    // objectKey format is always `users/<userId>/<folder>/<uuid.ext>`
    if (!objectKey.startsWith(`users/${req.user._id}/`)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this file' });
    }

    await deleteFile(objectKey);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPresignedUrl,
  removeObject,
};
