import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Calendar, Trash2, AlertTriangle } from 'lucide-react';
import { DbHomeworkAssignment } from '../../core/supabase/database.types';

interface AssignmentEditModalProps {
  assignment?: DbHomeworkAssignment | null; // null for create mode
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    maxPoints: number;
    dueDate: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MIN_POINTS = 1;
const MAX_POINTS = 10;
const DEFAULT_POINTS = 10;

const AssignmentEditModal: React.FC<AssignmentEditModalProps> = ({
  assignment,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();
  const isEditMode = !!assignment;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxPoints, setMaxPoints] = useState(DEFAULT_POINTS);
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset form when modal opens or assignment changes
  useEffect(() => {
    if (isOpen) {
      if (assignment) {
        setTitle(assignment.title);
        setDescription(assignment.description || '');
        setMaxPoints(assignment.max_points);
        // Convert ISO date to YYYY-MM-DD format for input
        setDueDate(assignment.due_date ? assignment.due_date.split('T')[0] : '');
      } else {
        // Create mode - reset to defaults
        setTitle('');
        setDescription('');
        setMaxPoints(DEFAULT_POINTS);
        setDueDate('');
      }
      setErrorMessage(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, assignment]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setErrorMessage(null);

    // Validation
    if (!title.trim()) {
      setErrorMessage(t('homeworkManagement.assignmentModal.validationTitleRequired'));
      return;
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      setErrorMessage(t('homeworkManagement.assignmentModal.validationTitleTooLong', { max: MAX_TITLE_LENGTH }));
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setErrorMessage(t('homeworkManagement.assignmentModal.validationDescriptionTooLong', { max: MAX_DESCRIPTION_LENGTH }));
      return;
    }
    if (maxPoints < MIN_POINTS || maxPoints > MAX_POINTS) {
      setErrorMessage(t('homeworkManagement.assignmentModal.validationPointsRange', { min: MIN_POINTS, max: MAX_POINTS }));
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        maxPoints,
        dueDate: dueDate || null,
      });
    } catch (error) {
      setErrorMessage(t('homeworkManagement.assignmentModal.errorSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      setErrorMessage(t('homeworkManagement.assignmentModal.errorDeleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setMaxPoints(Math.min(MAX_POINTS, Math.max(MIN_POINTS, value)));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#0A0A0A] rounded-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1F1F1F]">
          <h3 className="text-lg font-semibold text-[#FAFAFA]">
            {isEditMode ? t('homeworkManagement.assignmentModal.titleEdit') : t('homeworkManagement.assignmentModal.titleCreate')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1F1F1F] rounded-lg transition-colors"
          >
            <X size={20} className="text-[#666666]" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] px-4 py-2 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('homeworkManagement.assignmentModal.titleLabel')} <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              placeholder={t('homeworkManagement.assignmentModal.titlePlaceholder')}
              maxLength={MAX_TITLE_LENGTH}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('homeworkManagement.assignmentModal.instructionsLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] h-24 resize-none"
              placeholder={t('homeworkManagement.assignmentModal.instructionsPlaceholder')}
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
            <p className="text-xs text-[#666666] mt-1">
              {t('homeworkManagement.assignmentModal.charactersCount', { count: description.length, max: MAX_DESCRIPTION_LENGTH })}
            </p>
          </div>

          {/* Max Points */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('homeworkManagement.assignmentModal.maxPointsLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={maxPoints}
                onChange={handlePointsChange}
                min={MIN_POINTS}
                max={MAX_POINTS}
                className="w-24 px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              />
              <span className="text-sm text-[#666666]">
                {t('homeworkManagement.assignmentModal.pointsRange', { min: MIN_POINTS, max: MAX_POINTS })}
              </span>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('homeworkManagement.assignmentModal.dueDateLabel')} <span className="text-[#666666]">{t('homeworkManagement.assignmentModal.dueDateOptional')}</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] pl-10"
              />
              <Calendar
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]"
              />
            </div>
            {dueDate && (
              <button
                onClick={() => setDueDate('')}
                className="text-xs text-[#666666] hover:text-[#A0A0A0] mt-1"
              >
                {t('homeworkManagement.assignmentModal.clearDueDate')}
              </button>
            )}
          </div>
        </div>

        {/* Delete Section - Only show in edit mode */}
        {isEditMode && onDelete && (
          <div className="p-4 border-t border-[#1F1F1F] bg-[#0A0A0A]">
            {showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#EF4444]">
                  <AlertTriangle size={18} />
                  <span className="text-sm font-medium">{t('homeworkManagement.assignmentModal.deleteConfirmQuestion')}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm text-[#A0A0A0] hover:bg-[#151515] rounded-lg"
                    disabled={isDeleting}
                  >
                    {t('homeworkManagement.assignmentModal.cancelButton')}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 text-sm bg-[#EF4444] text-white rounded-lg hover:bg-[#EF4444]/80 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {t('homeworkManagement.assignmentModal.deleting')}
                      </>
                    ) : (
                      t('homeworkManagement.assignmentModal.yesDelete')
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
                {t('homeworkManagement.assignmentModal.deleteButton')}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-[#1F1F1F]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[#1F1F1F] rounded-lg hover:bg-[#0A0A0A] font-medium text-[#A0A0A0]"
          >
            {t('homeworkManagement.assignmentModal.cancelButton')}
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="flex-1 bg-white text-black px-4 py-2 rounded-lg hover:bg-[#E0E0E0] disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('homeworkManagement.assignmentModal.saving')}
              </>
            ) : isEditMode ? (
              t('homeworkManagement.assignmentModal.saveChanges')
            ) : (
              t('homeworkManagement.assignmentModal.createAssignment')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentEditModal;
