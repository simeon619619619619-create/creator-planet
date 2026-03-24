import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DbCourse, ContentCategory } from '../../../core/supabase/database.types';
import { updateCourse, deleteCourse, uploadCourseThumbnail } from '../courseService';
import { CONTENT_CATEGORIES } from '../../../shared/constants/categories';

// Draft persistence for course form data
interface CourseDraft {
  title: string;
  description: string;
  thumbnailUrl: string;
  isPublished: boolean;
  category: ContentCategory | null;
}

const DRAFT_STORAGE_PREFIX = 'course-draft-';

const saveDraft = (courseId: string, draft: CourseDraft) => {
  try {
    sessionStorage.setItem(`${DRAFT_STORAGE_PREFIX}${courseId}`, JSON.stringify(draft));
  } catch (e) {
    console.warn('Failed to save course draft:', e);
  }
};

const loadDraft = (courseId: string): CourseDraft | null => {
  try {
    const stored = sessionStorage.getItem(`${DRAFT_STORAGE_PREFIX}${courseId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to load course draft:', e);
    return null;
  }
};

const clearDraft = (courseId: string) => {
  try {
    sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${courseId}`);
  } catch (e) {
    console.warn('Failed to clear course draft:', e);
  }
};

interface CourseEditModalProps {
  course: DbCourse;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCourse: DbCourse) => void;
  onDelete: () => void;
}

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const CourseEditModal: React.FC<CourseEditModalProps> = ({
  course,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();

  // Load draft or use course values
  const getInitialValue = useCallback(<T,>(field: keyof CourseDraft, defaultValue: T): T => {
    const draft = loadDraft(course.id);
    if (draft && field in draft) {
      return draft[field] as T;
    }
    return defaultValue;
  }, [course.id]);

  const [title, setTitle] = useState(() => getInitialValue('title', course.title));
  const [description, setDescription] = useState(() => getInitialValue('description', course.description || ''));
  const [thumbnailUrl, setThumbnailUrl] = useState(() => getInitialValue('thumbnailUrl', course.thumbnail_url || ''));
  const [isPublished, setIsPublished] = useState(() => getInitialValue('isPublished', course.is_published));
  const [category, setCategory] = useState<ContentCategory | null>(() => getInitialValue('category', course.category ?? null));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Save draft when form changes
  useEffect(() => {
    if (!isOpen) return;

    const draft: CourseDraft = {
      title,
      description,
      thumbnailUrl,
      isPublished,
      category,
    };
    saveDraft(course.id, draft);
  }, [isOpen, course.id, title, description, thumbnailUrl, isPublished, category]);

  if (!isOpen) return null;

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

    setIsSaving(true);

    const updated = await updateCourse(course.id, {
      title: title.trim(),
      description: description.trim() || null,
      thumbnail_url: thumbnailUrl || null,
      is_published: isPublished,
      category: category || null,
    });

    if (updated) {
      clearDraft(course.id);
      onSave(updated);
    } else {
      setErrorMessage('Failed to save course. Please try again.');
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await deleteCourse(course.id);
    if (success) {
      clearDraft(course.id);
      onDelete();
    }
    setIsDeleting(false);
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);
    const url = await uploadCourseThumbnail(course.id, file);
    if (url) {
      setThumbnailUrl(url);
    } else {
      setErrorMessage('Failed to upload thumbnail. Please try again.');
    }
    setIsUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--fc-section-border,#1F1F1F)]">
          <h3 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)]">Edit Course</h3>
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

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
              Course Thumbnail
            </label>
            <div className="flex items-start gap-4">
              <div className="w-40 h-24 bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg overflow-hidden flex items-center justify-center border border-[var(--fc-section-border,#1F1F1F)]">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt="Course thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[var(--fc-section-muted,#666666)] text-xs">No thumbnail</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--fc-section-hover,#1F1F1F)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] transition-colors">
                    {isUploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload
                      </>
                    )}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
                {thumbnailUrl && (
                  <button
                    onClick={() => setThumbnailUrl('')}
                    className="text-xs text-[var(--fc-section-muted,#666666)] hover:text-[#EF4444]"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

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
              placeholder="Course title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)] h-24 resize-none"
              placeholder="Course description"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
              {t('categories.label', 'Category')}
            </label>
            <select
              value={category ?? ''}
              onChange={(e) => setCategory((e.target.value || null) as ContentCategory | null)}
              className="w-full px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)] bg-transparent text-[var(--fc-section-text,#FAFAFA)]"
            >
              <option value="">{t('categories.selectPlaceholder', 'Select a category...')}</option>
              {CONTENT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {t(cat.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Published Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)]">Published</span>
              <p className="text-xs text-[var(--fc-section-muted,#666666)]">Students can see and enroll in this course</p>
            </div>
            <button
              onClick={() => setIsPublished(!isPublished)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isPublished ? 'bg-[#22C55E]' : 'bg-[#333333]'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-[var(--fc-section,#0A0A0A)] rounded-full transition-transform ${
                  isPublished ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Delete Section */}
        <div className="p-4 border-t border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section,#0A0A0A)]">
          {showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#EF4444]">
                <AlertTriangle size={18} />
                <span className="text-sm font-medium">Delete this course?</span>
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
              Delete Course
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-[var(--fc-section-border,#1F1F1F)]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg hover:bg-[var(--fc-section,#0A0A0A)] font-medium text-[var(--fc-section-muted,#A0A0A0)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-2 rounded-lg hover:bg-[#E0E0E0] disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseEditModal;
