/**
 * File compression and validation utilities for chat file sharing.
 * - Files > 5MB get compressed (images via canvas quality reduction)
 * - Max file size: 100MB
 */

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const COMPRESSION_THRESHOLD = 5 * 1024 * 1024; // 5 MB

/**
 * Validate file before upload.
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateFile = (file) => {
  if (!file) return { valid: false, error: 'No file selected' };
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the 100 MB limit`,
    };
  }
  return { valid: true };
};

/**
 * Get file category from MIME type for rendering logic.
 * @param {string} mimeType
 * @returns {'image' | 'video' | 'audio' | 'document' | 'sticker' | 'other'}
 */
export const getFileCategory = (mimeType) => {
  if (!mimeType) return 'other';
  if (mimeType === 'image/gif' || mimeType === 'image/webp') return 'sticker';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('msword') ||
    mimeType.includes('ms-excel') ||
    mimeType.includes('ms-powerpoint') ||
    mimeType === 'text/plain' ||
    mimeType === 'text/csv'
  ) {
    return 'document';
  }
  return 'other';
};

/**
 * Get a friendly icon emoji for a file category.
 * @param {string} category
 * @returns {string}
 */
export const getFileIcon = (category) => {
  switch (category) {
    case 'image': return '🖼️';
    case 'sticker': return '🎨';
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'document': return '📄';
    default: return '📎';
  }
};

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Compress a file if it exceeds the threshold (5MB).
 * - Images: canvas-based quality reduction (resize + lower quality JPEG/WebP)
 * - Others: returned as-is (Firebase handles transfer compression)
 *
 * @param {File} file
 * @returns {Promise<File>} compressed (or original) file
 */
export const compressFile = async (file) => {
  if (file.size <= COMPRESSION_THRESHOLD) {
    return file;
  }

  const category = getFileCategory(file.type);

  // Never compress GIFs or animated WebP — canvas destroys animation
  if (file.type === 'image/gif' || file.type === 'image/webp') {
    console.log(`[FileCompressor] Skipping compression for animated format "${file.type}" to preserve animation.`);
    return file;
  }

  if (category === 'image') {
    return compressImage(file);
  }

  // For video, audio, documents, and other files > 5MB:
  // True re-encoding isn't feasible in-browser, so return as-is.
  // Firebase Storage transfer encoding handles what it can.
  console.log(`[FileCompressor] File "${file.name}" (${formatFileSize(file.size)}) exceeds 5MB but is not an image — uploading original.`);
  return file;
};

/**
 * Compress an image using canvas.
 * Strategy: scale down dimensions if very large, then re-encode at lower quality.
 * Target: ~50% of original size.
 *
 * @param {File} file
 * @returns {Promise<File>}
 */
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down large images (max dimension 2048px for images > 5MB)
      const MAX_DIM = 2048;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Determine output type and quality
      const isWebP = file.type === 'image/webp';
      const isPNG = file.type === 'image/png';
      const outputType = isPNG ? 'image/png' : (isWebP ? 'image/webp' : 'image/jpeg');
      // PNG is lossless so we can't reduce quality, but canvas re-encoding still helps for oversized PNGs
      const quality = isPNG ? undefined : 0.55;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // fallback to original
            return;
          }

          const compressed = new File([blob], file.name, {
            type: outputType,
            lastModified: Date.now(),
          });

          const savings = ((1 - compressed.size / file.size) * 100).toFixed(1);
          console.log(
            `[FileCompressor] Image compressed: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)} (${savings}% reduction)`
          );

          // If compression actually made it bigger (rare), use original
          resolve(compressed.size < file.size ? compressed : file);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.warn('[FileCompressor] Failed to load image for compression, using original.');
      resolve(file);
    };

    img.src = url;
  });
};
