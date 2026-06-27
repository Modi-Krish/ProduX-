const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
require('dotenv').config();

const provider = (process.env.STORAGE_PROVIDER || 'cloudflare').toLowerCase();

// Initialize Cloudflare R2 Client
let s3Client = null;
if (provider === 'cloudflare') {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

// Initialize Supabase Client
let supabaseClient = null;
if (provider === 'supabase') {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !serviceRoleKey) {
    logger.error('Supabase credentials missing in storage service initialization');
  } else {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      serviceRoleKey
    );
  }
}

// Allowed MIME types and max sizes (bytes)
const FILE_LIMITS = {
  image: { mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], maxSize: 5 * 1024 * 1024 }, // 5MB
  document: { mimes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'], maxSize: 10 * 1024 * 1024 }, // 10MB
  audio: { mimes: ['audio/mpeg', 'audio/wav', 'audio/webm'], maxSize: 10 * 1024 * 1024 }, // 10MB
  video: { mimes: ['video/mp4', 'video/webm', 'video/quicktime'], maxSize: 50 * 1024 * 1024 }, // 50MB
};

/**
 * Validates file type and size
 */
const validateFile = (mimeType, size, category) => {
  const limits = FILE_LIMITS[category] || { mimes: [], maxSize: 0 };
  
  if (!limits.mimes.includes(mimeType)) {
    return `Invalid file type. Allowed: ${limits.mimes.join(', ')}`;
  }
  
  if (size > limits.maxSize) {
    return `File too large. Maximum size for ${category} is ${limits.maxSize / (1024 * 1024)}MB`;
  }
  
  return true;
};

/**
 * Generates a presigned URL for secure upload to either Cloudflare R2 or Supabase Storage.
 */
const generateUploadUrl = async (userId, originalName, mimeType, size, category, folder) => {
  const validationResult = validateFile(mimeType, size, category);
  if (validationResult !== true) {
    throw new Error(validationResult);
  }

  const ext = originalName.split('.').pop().toLowerCase();
  const objectKey = `users/${userId}/${folder}/${uuidv4()}.${ext}`;

  if (provider === 'supabase') {
    try {
      const bucketName = process.env.SUPABASE_BUCKET_NAME || 'produx-storage';
      // Create a signed upload URL from Supabase Storage
      const { data, error } = await supabaseClient.storage
        .from(bucketName)
        .createSignedUploadUrl(objectKey);

      if (error) throw error;

      // Get public URL
      const { data: publicUrlData } = supabaseClient.storage
        .from(bucketName)
        .getPublicUrl(objectKey);

      return {
        signedUrl: data.signedUrl,
        publicUrl: publicUrlData.publicUrl,
        objectKey,
        fileName: originalName,
        mimeType,
        size,
      };
    } catch (error) {
      logger.error('Failed to generate Supabase signed upload URL', { error: error.message, objectKey });
      throw new Error('Could not generate upload URL on Supabase');
    }
  } else {
    // Cloudflare R2 S3-Compatible Upload
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: mimeType,
      ContentLength: size,
      Metadata: {
        userId,
        originalName,
        category,
      },
      CacheControl: 'public, max-age=31536000',
    });

    try {
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${objectKey}`;

      return {
        signedUrl,
        publicUrl,
        objectKey,
        fileName: originalName,
        mimeType,
        size,
      };
    } catch (error) {
      logger.error('Failed to generate Cloudflare R2 presigned URL', { error: error.message, objectKey });
      throw new Error('Could not generate upload URL on R2');
    }
  }
};

/**
 * Deletes a file from the configured storage bucket
 */
const deleteFile = async (objectKey) => {
  if (!objectKey || objectKey.includes('..') || objectKey === '/') {
    throw new Error('Invalid object key');
  }

  if (provider === 'supabase') {
    try {
      const bucketName = process.env.SUPABASE_BUCKET_NAME || 'produx-storage';
      const { error } = await supabaseClient.storage.from(bucketName).remove([objectKey]);
      if (error) throw error;
      logger.info(`Deleted object from Supabase: ${objectKey}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete object from Supabase', { error: error.message, objectKey });
      throw new Error('Could not delete file');
    }
  } else {
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
    });

    try {
      await s3Client.send(command);
      logger.info(`Deleted object from R2: ${objectKey}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete object from R2', { error: error.message, objectKey });
      throw new Error('Could not delete file');
    }
  }
};

/**
 * Helper to recursively delete folders on Supabase Storage
 */
const deleteSupabaseDirectory = async (bucket, prefix) => {
  const { data: files, error } = await supabaseClient.storage.from(bucket).list(prefix, {
    limit: 100,
    offset: 0,
  });

  if (error) throw error;
  if (!files || files.length === 0) return;

  const filesToDelete = [];
  const foldersToTraverse = [];

  for (const file of files) {
    const fullPath = prefix ? `${prefix}/${file.name}` : file.name;
    if (file.id === null) {
      // It's a folder/directory placeholder
      foldersToTraverse.push(fullPath);
    } else {
      filesToDelete.push(fullPath);
    }
  }

  if (filesToDelete.length > 0) {
    const { error: deleteErr } = await supabaseClient.storage.from(bucket).remove(filesToDelete);
    if (deleteErr) throw deleteErr;
  }

  for (const folder of foldersToTraverse) {
    await deleteSupabaseDirectory(bucket, folder);
  }
};

/**
 * Deletes an entire user directory (used during account deletion cascade)
 */
const deleteUserDirectory = async (userId) => {
  if (!userId) throw new Error('User ID is required');
  const prefix = `users/${userId}`;

  if (provider === 'supabase') {
    try {
      const bucketName = process.env.SUPABASE_BUCKET_NAME || 'produx-storage';
      await deleteSupabaseDirectory(bucketName, prefix);
      logger.info(`Deleted Supabase directory for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete user directory from Supabase', { error: error.message, userId });
      throw new Error('Could not delete user files');
    }
  } else {
    // Cloudflare R2 S3 Directory Deletion
    const s3Prefix = `users/${userId}/`;
    try {
      let isTruncated = true;
      let continuationToken = undefined;

      while (isTruncated) {
        const listCommand = new ListObjectsV2Command({
          Bucket: process.env.R2_BUCKET_NAME,
          Prefix: s3Prefix,
          ContinuationToken: continuationToken,
        });

        const { Contents, IsTruncated, NextContinuationToken } = await s3Client.send(listCommand);

        if (Contents && Contents.length > 0) {
          for (const item of Contents) {
            await deleteFile(item.Key);
          }
        }

        isTruncated = IsTruncated;
        continuationToken = NextContinuationToken;
      }
      logger.info(`Deleted R2 directory for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete user directory from R2', { error: error.message, userId });
      throw new Error('Could not delete user files');
    }
  }
};

module.exports = {
  generateUploadUrl,
  deleteFile,
  validateFile,
  deleteUserDirectory,
};
