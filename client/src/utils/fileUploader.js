/**
 * Firebase Storage file uploader for chat attachments.
 * Uploads files to Firebase Storage and returns the download URL.
 */
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isConfigured } from '../api/firebase';

/**
 * Upload a file to Firebase Storage for chat.
 *
 * @param {File} file - The file to upload
 * @param {'dm' | 'group'} chatType - Type of chat
 * @param {string} chatId - The chat partner ID or group ID
 * @param {(progress: number) => void} [onProgress] - Progress callback (0-100)
 * @returns {Promise<{ url: string, fileName: string, fileSize: number, fileType: string }>}
 */
export const uploadChatFile = (file, chatType, chatId, onProgress) => {
  return new Promise((resolve, reject) => {
    if (!isConfigured || !storage) {
      reject(new Error('Firebase Storage is not configured. File uploads are unavailable.'));
      return;
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `chat-files/${chatType}/${chatId}/${timestamp}_${sanitizedName}`;
    const storageRef = ref(storage, storagePath);

    console.log(`[FileUploader] Starting upload: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${file.type}) -> ${storagePath}`);

    const metadata = {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        originalName: file.name,
        chatType,
        chatId,
      },
    };

    // Track whether progress has ever fired (some browsers/WebViews don't support resumable)
    let hasProgressFired = false;
    let progressStallTimer = null;

    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    // If no progress fires within 10 seconds, fall back to simple upload
    progressStallTimer = setTimeout(() => {
      if (!hasProgressFired) {
        console.warn('[FileUploader] Resumable upload progress never fired — falling back to simple upload.');
        uploadTask.cancel();
        
        // Fallback: use simple uploadBytes (non-resumable but more compatible)
        uploadBytes(storageRef, file, metadata)
          .then(async (snapshot) => {
            if (onProgress) onProgress(100);
            try {
              const url = await getDownloadURL(snapshot.ref);
              console.log('[FileUploader] Fallback upload succeeded:', url);
              resolve({
                url,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
              });
            } catch (urlErr) {
              console.error('[FileUploader] Fallback: failed to get download URL:', urlErr);
              reject(new Error('Failed to get file URL after upload.'));
            }
          })
          .catch((fallbackErr) => {
            console.error('[FileUploader] Fallback upload also failed:', fallbackErr);
            reject(new Error(`File upload failed: ${fallbackErr.code || fallbackErr.message}`));
          });
      }
    }, 10000);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        hasProgressFired = true;
        if (progressStallTimer) {
          clearTimeout(progressStallTimer);
          progressStallTimer = null;
        }
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        console.log(`[FileUploader] Progress: ${progress}% (${snapshot.bytesTransferred}/${snapshot.totalBytes})`);
        if (onProgress) onProgress(progress);
      },
      (error) => {
        if (progressStallTimer) {
          clearTimeout(progressStallTimer);
          progressStallTimer = null;
        }
        // Don't reject on cancel if we're falling back
        if (error.code === 'storage/canceled' && !hasProgressFired) {
          return; // fallback will handle it
        }
        console.error('[FileUploader] Upload failed:', error.code, error.message);
        let userMessage = 'File upload failed. Please try again.';
        if (error.code === 'storage/unauthorized') {
          userMessage = 'Upload permission denied. Firebase Storage rules may need to be updated.';
        } else if (error.code === 'storage/quota-exceeded') {
          userMessage = 'Storage quota exceeded.';
        } else if (error.code === 'storage/retry-limit-exceeded') {
          userMessage = 'Upload failed due to network issues. Please check your connection.';
        }
        reject(new Error(userMessage));
      },
      async () => {
        if (progressStallTimer) {
          clearTimeout(progressStallTimer);
          progressStallTimer = null;
        }
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('[FileUploader] Upload complete:', url);
          resolve({
            url,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          });
        } catch (err) {
          console.error('[FileUploader] Failed to get download URL:', err);
          reject(new Error('Failed to get file URL after upload.'));
        }
      }
    );
  });
};
