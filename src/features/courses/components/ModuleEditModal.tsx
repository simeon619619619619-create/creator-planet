import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Trash2, AlertTriangle, Upload, HelpCircle } from 'lucide-react';
import { DbModule, UnlockType } from '../../../core/supabase/database.types';
import { createModule, updateModule, deleteModule, uploadModuleThumbnail } from '../courseService';
import { getQuizLessonsInModule } from '../quizService';

// Draft persistence for module form data
interface ModuleDraft {
  title: string;
  description: string;
  unlockType: UnlockType;
  unlockValue: string;
}

const DRAFT_STORAGE_PREFIX = 'module-draft-';

const saveDraft = (moduleId: string, draft: ModuleDraft) => {
  try {
    sessionStorage.setItem(`${DRAFT_STORAGE_PREFIX}${moduleId}`, JSON.stringify(draft));
  } catch (e) {
    console.warn('Failed to save module draft:', e);
  }
};

const loadDraft = (moduleId: string): ModuleDraft | null => {
  try {
    const stored = sessionStorage.getItem(`${DRAFT_STORAGE_PREFIX}${moduleId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to load module draft:', e);
    return null;
  }
};

const clearDraft = (moduleId: string) => {
  try {
    sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${moduleId}`);
  } catch (e) {
    console.warn('Failed to clear module draft:', e);
  }
};

interface QuizLesson {
  id: string;
  title: string;
}

interface ModuleEditModalProps {
  module: DbModule | null; // null for create mode
  courseId: string;
  previousModuleId?: string; // ID of the previous module (for quiz unlock)
  isFirstModule?: boolean; // True if this is the first module
  isOpen: boolean;
  onClose: () => void;
  onSave: (module: DbModule) => void;
  onDelete?: () => void;
}

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const ModuleEditModal: React.FC<ModuleEditModalProps> = ({
  module,
  courseId,
  previousModuleId,
  isFirstModule = false,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const isEditMode = module !== null;
  const draftKey = module?.id || `new-${courseId}`;

  // Load draft or use module values
  const getInitialValue = useCallback(<T,>(field: keyof ModuleDraft, defaultValue: T): T => {
    const draft = loadDraft(draftKey);
    if (draft && field in draft) {
      return draft[field] as T;
    }
    return defaultValue;
  }, [draftKey]);

  const [title, setTitle] = useState(() =>
    module?.title || getInitialValue('title', '')
  );
  const [description, setDescription] = useState(() =>
    module?.description || getInitialValue('description', '')
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(module?.thumbnail_url || '');
  const [unlockType, setUnlockType] = useState<UnlockType>(() =>
    module?.unlock_type || getInitialValue('unlockType', 'immediate')
  );
  const [unlockValue, setUnlockValue] = useState(() =>
    module?.unlock_value || getInitialValue('unlockValue', '')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quizLessons, setQuizLessons] = useState<QuizLesson[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);

  // Save draft when form changes
  useEffect(() => {
    if (!isOpen) return;
    const draft: ModuleDraft = {
      title,
      description,
      unlockType,
      unlockValue,
    };
    saveDraft(draftKey, draft);
  }, [isOpen, draftKey, title, description, unlockType, unlockValue]);

  // Load quiz lessons from previous module when Quiz unlock type is available
  useEffect(() => {
    async function loadQuizLessons() {
      if (!previousModuleId || isFirstModule) {
        setQuizLessons([]);
        return;
      }
      setIsLoadingQuizzes(true);
      const lessons = await getQuizLessonsInModule(previousModuleId);
      setQuizLessons(lessons);
      setIsLoadingQuizzes(false);
    }
    if (isOpen) {
      loadQuizLessons();
    }
  }, [previousModuleId, isFirstModule, isOpen]);

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

    if (isEditMode && module) {
      const updated = await updateModule(module.id, {
        title: title.trim(),
        description: description.trim() || null,
        thumbnail_url: thumbnailUrl || null,
        unlock_type: unlockType,
        unlock_value: unlockType !== 'immediate' ? unlockValue : null,
      });
      if (updated) {
        clearDraft(draftKey);
        onSave(updated);
      } else {
        setErrorMessage('Failed to save module. Please try again.');
      }
    } else {
      const created = await createModule(
        courseId,
        title.trim(),
        description.trim() || undefined
      );
      if (created) {
        clearDraft(draftKey);
        onSave(created);
      } else {
        setErrorMessage('Failed to create module. Please try again.');
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!module || !onDelete) return;
    setIsDeleting(true);
    const success = await deleteModule(module.id);
    if (success) {
      onDelete();
    }
    setIsDeleting(false);
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !module) return;

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
    const url = await uploadModuleThumbnail(module.id, file);
    if (url) {
      setThumbnailUrl(url);
    } else {
      setErrorMessage('Failed to upload thumbnail. Please try again.');
    }
    setIsUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">
            {isEditMode ? 'Edit Module' : 'Add Module'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Module title"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-20 resize-none"
              placeholder="Brief description of this module"
            />
          </div>

          {/* Thumbnail (only in edit mode - need module ID for upload path) */}
          {isEditMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Module Thumbnail
              </label>
              <div className="flex items-start gap-4">
                <div className="w-24 h-16 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Module thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs">No image</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">
                      {isUploading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
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
                      className="text-xs text-slate-500 hover:text-red-600 text-left"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Unlock Settings */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Unlock Condition
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setUnlockType('immediate')}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  unlockType === 'immediate'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Immediate
              </button>
              <button
                type="button"
                onClick={() => setUnlockType('date')}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  unlockType === 'date'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                On Date
              </button>
              <button
                type="button"
                onClick={() => setUnlockType('progress')}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  unlockType === 'progress'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                After %
              </button>
              <button
                type="button"
                onClick={() => setUnlockType('quiz')}
                disabled={isFirstModule}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors flex items-center justify-center gap-1 ${
                  unlockType === 'quiz'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : isFirstModule
                    ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title={isFirstModule ? 'Quiz unlock not available for first module' : 'Require quiz completion'}
              >
                <HelpCircle size={14} />
                Quiz
              </button>
            </div>

            {/* Unlock Value Input */}
            {unlockType === 'date' && (
              <div className="mt-2">
                <input
                  type="date"
                  value={unlockValue}
                  onChange={(e) => setUnlockValue(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            )}
            {unlockType === 'progress' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={unlockValue}
                  onChange={(e) => setUnlockValue(e.target.value)}
                  className="w-24 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="50"
                />
                <span className="text-sm text-slate-500">% completion of previous module</span>
              </div>
            )}
            {unlockType === 'quiz' && (
              <div className="mt-2">
                {isLoadingQuizzes ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    Loading quizzes...
                  </div>
                ) : quizLessons.length > 0 ? (
                  <>
                    <select
                      value={unlockValue}
                      onChange={(e) => setUnlockValue(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select a quiz...</option>
                      {quizLessons.map((quiz) => (
                        <option key={quiz.id} value={quiz.id}>
                          {quiz.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Students must pass this quiz to unlock this module
                    </p>
                  </>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-700">
                      No quiz lessons found in the previous module. Add a quiz lesson first.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Delete Section (edit mode only) */}
        {isEditMode && onDelete && (
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            {showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle size={18} />
                  <span className="text-sm font-medium">Delete this module?</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
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
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={14} />
                Delete Module
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : isEditMode ? (
              'Save Changes'
            ) : (
              'Add Module'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModuleEditModal;
