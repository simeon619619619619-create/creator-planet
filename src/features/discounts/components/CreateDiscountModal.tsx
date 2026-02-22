/**
 * Create Discount Modal
 *
 * Modal for creating and editing discount codes.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Percent, Calendar, Users, Tag, Shuffle } from 'lucide-react';
import type { CreateDiscountCodeInput, DiscountCodeWithDetails } from '../discountTypes';
import { generateDiscountCode, DURATION_OPTIONS, durationOptionToMonths } from '../discountTypes';
import { createDiscountCode, updateDiscountCode, getCreatorCommunities, getCreatorCourses, isCodeAvailable } from '../discountService';

interface CreateDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorId: string;
  editingCode?: DiscountCodeWithDetails | null;
  onSuccess: () => void;
}

export function CreateDiscountModal({
  isOpen,
  onClose,
  creatorId,
  editingCode,
  onSuccess,
}: CreateDiscountModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(10);
  const [durationIndex, setDurationIndex] = useState(0); // Index into DURATION_OPTIONS
  const [targetType, setTargetType] = useState<'all' | 'community' | 'course' | 'student'>('all');
  const [targetCommunityId, setTargetCommunityId] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [targetStudentEmail, setTargetStudentEmail] = useState('');
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [validUntil, setValidUntil] = useState('');

  const [communities, setCommunities] = useState<Array<{ id: string; name: string }>>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const isEditing = !!editingCode;

  // Load communities and courses for targeting
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        getCreatorCommunities(creatorId),
        getCreatorCourses(creatorId),
      ]).then(([comms, crs]) => {
        setCommunities(comms);
        setCourses(crs);
      });
    }
  }, [isOpen, creatorId]);

  // Populate form when editing
  useEffect(() => {
    if (editingCode) {
      setCode(editingCode.code);
      setDiscountPercent(editingCode.discount_percent);

      // Find matching duration option
      const durationMonths = editingCode.duration_months;
      const matchingIndex = DURATION_OPTIONS.findIndex((opt) => {
        if (opt.type === 'forever' && durationMonths === null) return true;
        if (opt.type === 'once' && durationMonths === 1) return true;
        if (opt.type === 'repeating' && opt.months === durationMonths) return true;
        return false;
      });
      setDurationIndex(matchingIndex >= 0 ? matchingIndex : 0);

      // Set target type
      if (editingCode.target_student_id) {
        setTargetType('student');
        setTargetStudentEmail(editingCode.target_student?.email || '');
      } else if (editingCode.target_community_id) {
        setTargetType('community');
        setTargetCommunityId(editingCode.target_community_id);
      } else if (editingCode.target_course_id) {
        setTargetType('course');
        setTargetCourseId(editingCode.target_course_id);
      } else {
        setTargetType('all');
      }

      setMaxUses(editingCode.max_uses || '');
      setValidUntil(editingCode.valid_until ? editingCode.valid_until.split('T')[0] : '');
    } else {
      resetForm();
    }
  }, [editingCode]);

  const resetForm = () => {
    setCode('');
    setDiscountPercent(10);
    setDurationIndex(0);
    setTargetType('all');
    setTargetCommunityId('');
    setTargetCourseId('');
    setTargetStudentEmail('');
    setMaxUses('');
    setValidUntil('');
    setError(null);
    setCodeError(null);
  };

  const handleGenerateCode = () => {
    setCode(generateDiscountCode());
    setCodeError(null);
  };

  const handleCodeChange = async (value: string) => {
    const upperValue = value.toUpperCase().replace(/[^A-Z0-9-_]/g, '');
    setCode(upperValue);
    setCodeError(null);

    if (upperValue.length >= 3) {
      const available = await isCodeAvailable(creatorId, upperValue, editingCode?.id);
      if (!available) {
        setCodeError(t('discounts.form.code.error'));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError(t('discounts.form.code.required'));
      return;
    }

    if (codeError) {
      setError(codeError);
      return;
    }

    if (targetType === 'student' && !targetStudentEmail.trim()) {
      setError(t('discounts.form.target.studentRequired'));
      return;
    }

    setIsLoading(true);

    try {
      const input: CreateDiscountCodeInput = {
        code: code.trim(),
        discount_percent: discountPercent,
        duration_months: durationOptionToMonths(DURATION_OPTIONS[durationIndex]),
        target_student_email: targetType === 'student' ? targetStudentEmail.trim() : undefined,
        target_community_id: targetType === 'community' ? targetCommunityId : undefined,
        target_course_id: targetType === 'course' ? targetCourseId : undefined,
        max_uses: maxUses ? Number(maxUses) : undefined,
        valid_until: validUntil || undefined,
      };

      if (isEditing && editingCode) {
        await updateDiscountCode(editingCode.id, {
          code: input.code,
          discount_percent: input.discount_percent,
          duration_months: input.duration_months,
          target_community_id: input.target_community_id || null,
          target_course_id: input.target_course_id || null,
          max_uses: input.max_uses || null,
          valid_until: input.valid_until || null,
        });
      } else {
        await createDiscountCode(creatorId, input);
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('discounts.errors.saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? t('discounts.modal.editTitle') : t('discounts.modal.createTitle')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Code Input */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('discounts.form.code.label')}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder={t('discounts.form.code.placeholder')}
                  className={`w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm uppercase ${
                    codeError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                  maxLength={20}
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateCode}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Shuffle className="h-4 w-4" />
                {t('discounts.form.code.generateButton')}
              </button>
            </div>
            {codeError && <p className="mt-1 text-sm text-red-600">{codeError}</p>}
          </div>

          {/* Discount Percent */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('discounts.form.discount.label')}
            </label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(1, Number(e.target.value))))}
                min={1}
                max={100}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t('discounts.form.discount.hint', { percentage: 100 - discountPercent })}
            </p>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('discounts.form.duration.label')}
            </label>
            <select
              value={durationIndex}
              onChange={(e) => setDurationIndex(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {DURATION_OPTIONS.map((option, index) => (
                <option key={index} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('discounts.form.target.label')}
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as typeof targetType)}
              className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">{t('discounts.form.target.all')}</option>
              <option value="community">{t('discounts.form.target.community')}</option>
              <option value="course">{t('discounts.form.target.course')}</option>
              <option value="student">{t('discounts.form.target.student')}</option>
            </select>
          </div>

          {/* Conditional Target Inputs */}
          {targetType === 'community' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('discounts.form.target.communitySelect')}
              </label>
              <select
                value={targetCommunityId}
                onChange={(e) => setTargetCommunityId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              >
                <option value="">{t('discounts.form.target.communityPlaceholder')}</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'course' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('discounts.form.target.courseSelect')}
              </label>
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              >
                <option value="">{t('discounts.form.target.coursePlaceholder')}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'student' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('discounts.form.target.studentEmail')}
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={targetStudentEmail}
                  onChange={(e) => setTargetStudentEmail(e.target.value)}
                  placeholder={t('discounts.form.target.studentPlaceholder')}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {t('discounts.form.target.studentHint')}
              </p>
            </div>
          )}

          {/* Max Uses */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('discounts.form.limits.maxUsesLabel')}
            </label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : '')}
              min={1}
              placeholder={t('discounts.form.limits.maxUsesPlaceholder')}
              className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          {/* Expiry Date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('discounts.form.expiry.label')}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('discounts.modal.cancelButton')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !!codeError}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? t('discounts.modal.savingButton') : isEditing ? t('discounts.modal.saveButton') : t('discounts.modal.createButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
