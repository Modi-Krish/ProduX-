import React, { useState, useRef } from 'react';
import { uploadFileToR2 } from '../../utils/fileUploader';
import toast from 'react-hot-toast';
import './FileUploadDropzone.css';

const FileUploadDropzone = ({ 
  folder, 
  onUploadSuccess, 
  onUploadError, 
  accept = "*", 
  maxSizeMB = 10,
  label = "Drag & Drop a file here, or click to select"
}) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const validateAndSetFile = (f) => {
    if (f.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File is too large. Max size is ${maxSizeMB}MB.`);
      return;
    }
    setFile(f);
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(0);

    try {
      const result = await uploadFileToR2(file, folder, (prog) => {
        setProgress(prog);
      });
      setIsUploading(false);
      setFile(null);
      setPreview(null);
      if (onUploadSuccess) onUploadSuccess(result);
    } catch (err) {
      setIsUploading(false);
      if (onUploadError) onUploadError(err);
      toast.error(err.message || 'Upload failed');
    }
  };

  const cancelUpload = () => {
    setFile(null);
    setPreview(null);
    setProgress(0);
  };

  return (
    <div className="file-upload-dropzone">
      {!file ? (
        <div 
          className="dropzone-area" 
          onDragOver={(e) => e.preventDefault()} 
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <p>{label}</p>
          <span className="dropzone-sub">Max size: {maxSizeMB}MB</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept={accept}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="file-preview-area">
          {preview ? (
            <img src={preview} alt="Preview" className="preview-image" />
          ) : (
            <div className="file-icon">📄 {file.name}</div>
          )}
          
          <div className="file-actions">
            {!isUploading ? (
              <>
                <button onClick={handleUpload} className="btn-upload">Upload</button>
                <button onClick={cancelUpload} className="btn-cancel">Cancel</button>
              </>
            ) : (
              <div className="upload-progress-container">
                <div className="upload-progress-bar" style={{ width: `${progress}%` }}></div>
                <span className="upload-progress-text">{progress}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadDropzone;
