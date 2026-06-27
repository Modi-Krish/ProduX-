import API from '../api/axios';
import axios from 'axios';

/**
 * Determine the file category based on MIME type
 */
const getFileCategory = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
};

/**
 * Universal file uploader using Cloudflare R2 presigned URLs.
 *
 * @param {File} file - The file to upload
 * @param {string} folder - Target folder in bucket (e.g. 'avatars', 'chat', 'tasks')
 * @param {(progress: number) => void} [onProgress] - Progress callback (0-100)
 * @returns {Promise<{ url: string, objectKey: string, fileName: string, fileSize: number, fileType: string }>}
 */
export const uploadFileToR2 = async (file, folder, onProgress) => {
  try {
    const category = getFileCategory(file.type);
    
    // 1. Get presigned URL from backend
    const presignRes = await API.post('/storage/presign', {
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      category,
      folder,
    });

    const { signedUrl, publicUrl, objectKey } = presignRes.data.data;

    // 2. Upload file directly to Cloudflare R2 using the presigned URL
    // We use a plain axios instance here to prevent attaching our API JWT token
    // to the Cloudflare S3 request (which causes Signature Does Not Match errors)
    await axios.put(signedUrl, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    return {
      url: publicUrl,
      objectKey,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
    };
  } catch (error) {
    console.error('[FileUploader] Upload failed:', error);
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('File upload failed. Please check your connection and try again.');
  }
};

/**
 * Helper specifically for Chat, to replace the old Firebase `uploadChatFile` usage
 * @deprecated Use `uploadFileToR2` directly instead.
 */
export const uploadChatFile = (file, chatType, chatId, onProgress) => {
  return uploadFileToR2(file, 'chat', onProgress);
};
