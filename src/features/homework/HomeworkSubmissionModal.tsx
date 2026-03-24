import React, { useState, useRef, useCallback } from 'react';
import { X, Loader2, Upload, FileText, Image, Film, Trash2, File } from 'lucide-react';
import { DbHomeworkAssignment } from '../../core/supabase/database.types';
import { uploadHomeworkFile } from './homeworkService';

interface HomeworkSubmissionModalProps {
  assignment: DbHomeworkAssignment;
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (textResponse: string, fileUrls: string[]) => Promise<void>;
}

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  url?: string;
  error?: string;
}

const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ACCEPTED_FILE_TYPES = [
  'image/*',
  'video/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
].join(',');

const getFileIcon = (file: File) => {
  if (file.type.startsWith('image/')) {
    return <Image size={24} className="text-[var(--fc-section-muted,#A0A0A0)]" />;
  }
  if (file.type.startsWith('video/')) {
    return <Film size={24} className="text-[var(--fc-section-text,#FAFAFA)]" />;
  }
  if (file.type === 'application/pdf') {
    return <FileText size={24} className="text-[#EF4444]" />;
  }
  return <File size={24} className="text-[var(--fc-section-muted,#666666)]" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const HomeworkSubmissionModal: React.FC<HomeworkSubmissionModalProps> = ({
  assignment,
  studentId,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [textResponse, setTextResponse] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File "${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit`;
    }
    return null;
  };

  const handleFilesSelected = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newFiles: UploadedFile[] = [];

      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          setErrorMessage(error);
          continue;
        }

        // Create preview URL for images
        const preview = file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : '';

        newFiles.push({
          file,
          preview,
          uploading: true,
        });
      }

      if (newFiles.length === 0) return;

      // Add files to state with uploading status
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      setErrorMessage(null);

      // Upload each file
      for (let i = 0; i < newFiles.length; i++) {
        const uploadedFile = newFiles[i];
        try {
          const url = await uploadHomeworkFile(
            assignment.id,
            studentId,
            uploadedFile.file
          );

          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.file === uploadedFile.file
                ? { ...f, uploading: false, url: url || undefined, error: url ? undefined : 'Upload failed' }
                : f
            )
          );
        } catch (error) {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.file === uploadedFile.file
                ? { ...f, uploading: false, error: 'Upload failed' }
                : f
            )
          );
        }
      }
    },
    [assignment.id, studentId]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesSelected(files);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => {
      const fileToRemove = prev[index];
      // Revoke object URL to prevent memory leaks
      if (fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    // Validation: require either text response or files
    const hasText = textResponse.trim().length > 0;
    const hasFiles = uploadedFiles.some((f) => f.url && !f.error);
    const hasUploadingFiles = uploadedFiles.some((f) => f.uploading);

    if (hasUploadingFiles) {
      setErrorMessage('Please wait for all files to finish uploading');
      return;
    }

    if (!hasText && !hasFiles) {
      setErrorMessage('Please provide a text response or upload at least one file');
      return;
    }

    // Get successfully uploaded file URLs
    const fileUrls = uploadedFiles
      .filter((f) => f.url && !f.error)
      .map((f) => f.url!);

    setIsSubmitting(true);
    try {
      await onSubmit(textResponse.trim(), fileUrls);
      // Reset form on success
      setTextResponse('');
      setUploadedFiles([]);
    } catch (error) {
      // Show the actual error message if available, otherwise generic message
      const message = error instanceof Error ? error.message : 'Failed to submit homework. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Clean up preview URLs
    uploadedFiles.forEach((f) => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview);
      }
    });
    onClose();
  };

  if (!isOpen) return null;

  const isUploading = uploadedFiles.some((f) => f.uploading);
  const canSubmit =
    !isSubmitting &&
    !isUploading &&
    (textResponse.trim().length > 0 || uploadedFiles.some((f) => f.url && !f.error));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--fc-section-border,#1F1F1F)]">
          <h3 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)]">Submit Homework</h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg transition-colors"
          >
            <X size={20} className="text-[var(--fc-section-muted,#666666)]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Assignment Info */}
          <div className="bg-[var(--fc-section,#0A0A0A)] rounded-lg p-4">
            <h4 className="font-medium text-[var(--fc-section-text,#FAFAFA)] mb-1">{assignment.title}</h4>
            {assignment.description && (
              <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)] whitespace-pre-wrap">
                {assignment.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-[var(--fc-section-muted,#666666)]">
              <span>Max Points: {assignment.max_points}</span>
              {assignment.due_date && (
                <span>
                  Due: {new Date(assignment.due_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] px-4 py-2 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          {/* Text Response */}
          <div>
            <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
              Your Response
            </label>
            <textarea
              value={textResponse}
              onChange={(e) => setTextResponse(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)] h-32 resize-none"
              placeholder="Write your response here..."
            />
          </div>

          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
              Attachments
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${
                  isDragging
                    ? 'border-[#333333] bg-[var(--fc-section-hover,#151515)]'
                    : 'border-[var(--fc-section-border,#1F1F1F)] hover:border-[#333333] hover:bg-[var(--fc-section,#0A0A0A)]'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileInputChange}
                className="hidden"
              />
              <Upload
                size={32}
                className={`mx-auto mb-2 ${isDragging ? 'text-[var(--fc-section-text,#FAFAFA)]' : 'text-[var(--fc-section-muted,#666666)]'}`}
              />
              <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                Images, videos, PDFs, and documents up to {MAX_FILE_SIZE_MB}MB each
              </p>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {uploadedFiles.map((uploadedFile, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      uploadedFile.error
                        ? 'border-[#EF4444]/20 bg-[#EF4444]/10'
                        : 'border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section,#0A0A0A)]'
                    }`}
                  >
                    {/* File Preview/Icon */}
                    {uploadedFile.preview ? (
                      <img
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center">
                        {getFileIcon(uploadedFile.file)}
                      </div>
                    )}

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] truncate">
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                        {formatFileSize(uploadedFile.file.size)}
                        {uploadedFile.error && (
                          <span className="text-[#EF4444] ml-2">{uploadedFile.error}</span>
                        )}
                      </p>
                    </div>

                    {/* Status/Actions */}
                    {uploadedFile.uploading ? (
                      <Loader2 size={18} className="animate-spin text-[var(--fc-section-text,#FAFAFA)]" />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        className="p-1 hover:bg-[var(--fc-section-hover,#151515)] rounded transition-colors"
                      >
                        <Trash2 size={18} className="text-[var(--fc-section-muted,#666666)] hover:text-[#EF4444]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-[var(--fc-section-border,#1F1F1F)]">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg hover:bg-[var(--fc-section,#0A0A0A)] font-medium text-[var(--fc-section-muted,#A0A0A0)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-2 rounded-lg hover:bg-[#E0E0E0] disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Submitting...
              </>
            ) : isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading...
              </>
            ) : (
              'Submit Homework'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeworkSubmissionModal;
