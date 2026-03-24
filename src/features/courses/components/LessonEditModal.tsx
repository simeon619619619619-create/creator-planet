import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Trash2, AlertTriangle, PlayCircle, FileText, File, HelpCircle, Upload, Link, Video } from 'lucide-react';
import { DbLesson, LessonType } from '../../../core/supabase/database.types';
import { createLesson, updateLesson, deleteLesson, uploadLessonVideo } from '../courseService';
import QuizBuilder from './QuizBuilder';

// Draft persistence for lesson form data
interface LessonDraft {
  title: string;
  description: string;
  type: LessonType;
  contentUrl: string;
  durationMinutes: string;
  videoInputMode: 'url' | 'upload';
  hasSelectedFile: boolean; // Track if there was a file (can't persist actual file)
}

const DRAFT_STORAGE_PREFIX = 'lesson-draft-';

const saveDraft = (moduleId: string, draft: LessonDraft) => {
  try {
    sessionStorage.setItem(`${DRAFT_STORAGE_PREFIX}${moduleId}`, JSON.stringify(draft));
  } catch (e) {
    console.warn('Failed to save lesson draft:', e);
  }
};

const loadDraft = (moduleId: string): LessonDraft | null => {
  try {
    const stored = sessionStorage.getItem(`${DRAFT_STORAGE_PREFIX}${moduleId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to load lesson draft:', e);
    return null;
  }
};

const clearDraft = (moduleId: string) => {
  try {
    sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${moduleId}`);
  } catch (e) {
    console.warn('Failed to clear lesson draft:', e);
  }
};

interface LessonEditModalProps {
  lesson: DbLesson | null; // null for create mode
  moduleId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (lesson: DbLesson) => void;
  onDelete?: () => void;
}

const lessonTypeConfig: { type: LessonType; label: string; icon: React.ReactNode }[] = [
  { type: 'video', label: 'Video', icon: <PlayCircle size={18} /> },
  { type: 'text', label: 'Text', icon: <FileText size={18} /> },
  { type: 'file', label: 'File', icon: <File size={18} /> },
  { type: 'quiz', label: 'Quiz', icon: <HelpCircle size={18} /> },
];

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_DURATION_MINUTES = 1440; // 24 hours

const isValidUrl = (url: string): boolean => {
  if (!url.trim()) return true; // Empty is valid
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const LessonEditModal: React.FC<LessonEditModalProps> = ({
  lesson,
  moduleId,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const isEditMode = lesson !== null;

  // Load draft for new lessons (not edit mode)
  const getInitialValue = useCallback(<T,>(field: keyof LessonDraft, defaultValue: T): T => {
    if (isEditMode) return defaultValue;
    const draft = loadDraft(moduleId);
    if (draft && field in draft) {
      return draft[field] as T;
    }
    return defaultValue;
  }, [isEditMode, moduleId]);

  const [title, setTitle] = useState(() =>
    lesson?.title || getInitialValue('title', '')
  );
  const [description, setDescription] = useState(() =>
    lesson?.description || getInitialValue('description', '')
  );
  const [type, setType] = useState<LessonType>(() =>
    lesson?.type || getInitialValue('type', 'video')
  );
  const [contentUrl, setContentUrl] = useState(() =>
    lesson?.content_url || getInitialValue('contentUrl', '')
  );
  const [durationMinutes, setDurationMinutes] = useState<string>(() =>
    lesson?.duration_minutes?.toString() || getInitialValue('durationMinutes', '')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Video upload state
  const [videoInputMode, setVideoInputMode] = useState<'url' | 'upload'>(() => {
    if (lesson?.content_url?.includes('lesson-videos')) return 'upload';
    if (isEditMode) return 'url';
    return getInitialValue('videoInputMode', 'url');
  });
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track if draft had a file (show reminder to re-select)
  const [hadPreviousFile, setHadPreviousFile] = useState(() => {
    if (isEditMode) return false;
    const draft = loadDraft(moduleId);
    return draft?.hasSelectedFile || false;
  });

  // Max file size: 500MB
  const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
  const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

  // Save draft when form changes (only for new lessons)
  useEffect(() => {
    if (isEditMode || !isOpen) return;

    const draft: LessonDraft = {
      title,
      description,
      type,
      contentUrl,
      durationMinutes,
      videoInputMode,
      hasSelectedFile: selectedVideoFile !== null,
    };
    saveDraft(moduleId, draft);
  }, [isEditMode, isOpen, moduleId, title, description, type, contentUrl, durationMinutes, videoInputMode, selectedVideoFile]);

  // Clear the hadPreviousFile reminder once user selects a new file
  useEffect(() => {
    if (selectedVideoFile) {
      setHadPreviousFile(false);
    }
  }, [selectedVideoFile]);

  if (!isOpen) return null;

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setErrorMessage('Please select a valid video file (MP4, WebM, OGG, or MOV)');
      return;
    }

    // Validate file size
    if (file.size > MAX_VIDEO_SIZE) {
      setErrorMessage(`Video file must be less than ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`);
      return;
    }

    setSelectedVideoFile(file);
    setErrorMessage(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSave = async () => {
    setErrorMessage(null);

    // Validation
    if (!title.trim()) {
      setErrorMessage('Title is required');
      return;
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      setErrorMessage(`Title must be less than ${MAX_TITLE_LENGTH} characters`);
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setErrorMessage(`Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`);
      return;
    }

    // URL validation only for URL mode
    if (type === 'video' && videoInputMode === 'url' && contentUrl && !isValidUrl(contentUrl.trim())) {
      setErrorMessage('Please enter a valid URL');
      return;
    }

    // For non-video types, validate URL as before
    if (type !== 'video' && contentUrl && !isValidUrl(contentUrl.trim())) {
      setErrorMessage('Please enter a valid URL');
      return;
    }

    const duration = durationMinutes ? parseInt(durationMinutes, 10) : undefined;
    if (duration !== undefined && (duration < 0 || duration > MAX_DURATION_MINUTES)) {
      setErrorMessage(`Duration must be between 0 and ${MAX_DURATION_MINUTES} minutes`);
      return;
    }

    setIsSaving(true);

    // Determine the final content URL
    let finalContentUrl = contentUrl.trim() || null;

    // Handle video file upload
    if (type === 'video' && videoInputMode === 'upload' && selectedVideoFile) {
      setIsUploading(true);
      setUploadProgress(0);

      // Progress callback for upload tracking
      const handleProgress = (progress: number) => {
        setUploadProgress(progress);
      };

      // For new lessons, we need to create first to get the lesson ID
      if (!isEditMode) {
        const created = await createLesson(
          moduleId,
          title.trim(),
          type,
          description.trim() || undefined,
          undefined, // No URL yet
          undefined,
          duration
        );

        if (!created) {
          setErrorMessage('Failed to create lesson. Please try again.');
          setIsSaving(false);
          setIsUploading(false);
          return;
        }

        // Now upload the video using the new lesson ID with progress tracking
        const videoUrl = await uploadLessonVideo(created.id, selectedVideoFile, handleProgress);
        if (!videoUrl) {
          setErrorMessage('Failed to upload video. The lesson was created but without the video. Please try again with a smaller file or check your connection.');
          setIsSaving(false);
          setIsUploading(false);
          // Still call onSave so the UI updates
          clearDraft(moduleId);
          onSave(created);
          return;
        }

        // Update the lesson with the video URL
        const updated = await updateLesson(created.id, { content_url: videoUrl });
        setIsUploading(false);
        setIsSaving(false);
        clearDraft(moduleId);
        onSave(updated || { ...created, content_url: videoUrl });
        return;
      } else if (lesson) {
        // Edit mode: upload video using existing lesson ID with progress tracking
        const videoUrl = await uploadLessonVideo(lesson.id, selectedVideoFile, handleProgress);
        if (!videoUrl) {
          setErrorMessage('Failed to upload video. Please try again with a smaller file or check your connection.');
          setIsSaving(false);
          setIsUploading(false);
          return;
        }
        finalContentUrl = videoUrl;
      }
      setIsUploading(false);
    }

    if (isEditMode && lesson) {
      const updated = await updateLesson(lesson.id, {
        title: title.trim(),
        description: description.trim() || null,
        type,
        content_url: finalContentUrl,
        duration_minutes: duration || null,
      });
      if (updated) {
        clearDraft(moduleId);
        onSave(updated);
      } else {
        setErrorMessage('Failed to save lesson. Please try again.');
      }
    } else {
      const created = await createLesson(
        moduleId,
        title.trim(),
        type,
        description.trim() || undefined,
        finalContentUrl || undefined,
        undefined, // position - auto-calculated
        duration
      );
      if (created) {
        clearDraft(moduleId);
        onSave(created);
      } else {
        setErrorMessage('Failed to create lesson. Please try again.');
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!lesson || !onDelete) return;
    setIsDeleting(true);
    const success = await deleteLesson(lesson.id);
    if (success) {
      onDelete();
    }
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--fc-section-border,#1F1F1F)] sticky top-0 bg-[var(--fc-section,#0A0A0A)]">
          <h3 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)]">
            {isEditMode ? 'Edit Lesson' : 'Add Lesson'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg transition-colors"
          >
            <X size={20} className="text-[var(--fc-section-muted,#666666)]" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] px-4 py-2 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
              Title <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
              placeholder="Lesson title"
              autoFocus
            />
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
              Lesson Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {lessonTypeConfig.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setType(item.type)}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border transition-colors ${
                    type === item.type
                      ? 'bg-[var(--fc-section-hover,#1F1F1F)] border-[#555555] text-[var(--fc-section-text,#FAFAFA)]'
                      : 'border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section,#0A0A0A)]'
                  }`}
                >
                  {item.icon}
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Type-specific fields */}
          {type === 'video' && (
            <>
              {/* Video Source Toggle */}
              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
                  Video Source
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoInputMode('url');
                      setSelectedVideoFile(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      videoInputMode === 'url'
                        ? 'bg-[var(--fc-section-hover,#1F1F1F)] border-[#555555] text-[var(--fc-section-text,#FAFAFA)]'
                        : 'border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section,#0A0A0A)]'
                    }`}
                  >
                    <Link size={16} />
                    <span className="text-sm font-medium">URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoInputMode('upload');
                      setContentUrl('');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      videoInputMode === 'upload'
                        ? 'bg-[var(--fc-section-hover,#1F1F1F)] border-[#555555] text-[var(--fc-section-text,#FAFAFA)]'
                        : 'border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section,#0A0A0A)]'
                    }`}
                  >
                    <Upload size={16} />
                    <span className="text-sm font-medium">Upload</span>
                  </button>
                </div>
              </div>

              {/* URL Input Mode */}
              {videoInputMode === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    Video URL
                  </label>
                  <input
                    type="url"
                    value={contentUrl}
                    onChange={(e) => setContentUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
                    placeholder="https://youtube.com/watch?v=... or direct video URL"
                  />
                  <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-1">
                    Supports YouTube, Vimeo, Loom, or direct video file URLs
                  </p>
                </div>
              )}

              {/* File Upload Mode */}
              {videoInputMode === 'upload' && (
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    Upload Video File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
                    onChange={handleVideoFileSelect}
                    className="hidden"
                  />

                  {!selectedVideoFile && !contentUrl?.includes('lesson-videos') ? (
                    <div>
                      {/* Reminder if user had previously selected a file */}
                      {hadPreviousFile && (
                        <div className="mb-2 px-3 py-2 bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-lg">
                          <p className="text-xs text-[#EAB308]">
                            <strong>Note:</strong> You previously selected a video file. Please re-select it below.
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          hadPreviousFile
                            ? 'border-[#EAB308]/40 bg-[#EAB308]/10/50 hover:border-[#EAB308]/50 hover:bg-[#EAB308]/10'
                            : 'border-[#333333] hover:border-[#555555] hover:bg-[var(--fc-section-hover,#1F1F1F)]/50'
                        }`}
                      >
                        <Video size={32} className={`mx-auto mb-2 ${hadPreviousFile ? 'text-[#EAB308]' : 'text-[var(--fc-section-muted,#666666)]'}`} />
                        <p className="text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)]">
                          {hadPreviousFile ? 'Re-select your video file' : 'Click to select video file'}
                        </p>
                        <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-1">
                          MP4, WebM, OGG, or MOV (max 500MB)
                        </p>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-[var(--fc-section-border,#1F1F1F)] rounded-lg p-4 bg-[var(--fc-section,#0A0A0A)]">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg flex items-center justify-center">
                          <Video size={20} className="text-[var(--fc-section-text,#FAFAFA)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)] truncate">
                            {selectedVideoFile?.name || 'Previously uploaded video'}
                          </p>
                          {selectedVideoFile && (
                            <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                              {formatFileSize(selectedVideoFile.size)}
                            </p>
                          )}
                          {!selectedVideoFile && contentUrl?.includes('lesson-videos') && (
                            <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                              Video already uploaded
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVideoFile(null);
                            setContentUrl('');
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {!isUploading && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-3 text-xs text-[var(--fc-section-text,#FAFAFA)] hover:text-[var(--fc-section-text,#FAFAFA)] font-medium"
                        >
                          Change video
                        </button>
                      )}
                      {/* Progress bar during upload */}
                      {isUploading && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                            <span>Uploading...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-[var(--fc-section-hover,#1F1F1F)] rounded-full h-2">
                            <div
                              className="bg-white h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-2">
                            Large files are uploaded in chunks. Do not close this window.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Duration input (for both modes) */}
              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-32 px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
                  placeholder="15"
                />
              </div>
            </>
          )}

          {type === 'text' && (
            <div>
              <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                Content URL or Embed
              </label>
              <input
                type="url"
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
                placeholder="URL to text content or Google Doc"
              />
              <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-1">
                Link to a document, Google Doc, or Notion page
              </p>
            </div>
          )}

          {type === 'file' && (
            <div>
              <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                File URL
              </label>
              <input
                type="url"
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
                placeholder="https://example.com/file.pdf"
              />
              <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-1">
                Link to a downloadable file (PDF, ZIP, etc.)
              </p>
            </div>
          )}

          {type === 'quiz' && (
            isEditMode && lesson ? (
              <div className="border border-[var(--fc-section-border,#1F1F1F)] rounded-lg p-4">
                <QuizBuilder lessonId={lesson.id} />
              </div>
            ) : (
              <div className="bg-[var(--fc-section-hover,#1F1F1F)] border border-[#333333] rounded-lg p-3">
                <p className="text-sm text-[var(--fc-section-text,#FAFAFA)]">
                  Save this lesson first, then you can add quiz questions.
                </p>
              </div>
            )
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
              Description / Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)] h-24 resize-none"
              placeholder="Brief description or notes for this lesson (shown to students)"
            />
          </div>
        </div>

        {/* Delete Section (edit mode only) */}
        {isEditMode && onDelete && (
          <div className="p-4 border-t border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section,#0A0A0A)]">
            {showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#EF4444]">
                  <AlertTriangle size={18} />
                  <span className="text-sm font-medium">Delete this lesson?</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 text-sm bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] disabled:opacity-50 flex items-center gap-1"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Yes, Delete'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-[#EF4444] hover:text-[#EF4444] flex items-center gap-1"
              >
                <Trash2 size={14} />
                Delete Lesson
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-[var(--fc-section-border,#1F1F1F)] sticky bottom-0 bg-[var(--fc-section,#0A0A0A)]">
          <button
            onClick={onClose}
            disabled={isSaving || isUploading}
            className="flex-1 px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg hover:bg-[var(--fc-section,#0A0A0A)] font-medium text-[var(--fc-section-muted,#A0A0A0)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSaving || isUploading}
            className="flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-2 rounded-lg hover:bg-[var(--fc-button-hover,#E0E0E0)] disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading video... {uploadProgress}%
              </>
            ) : isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : isEditMode ? (
              'Save Changes'
            ) : (
              'Add Lesson'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonEditModal;
