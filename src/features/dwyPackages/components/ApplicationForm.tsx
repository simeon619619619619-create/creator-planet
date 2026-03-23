// =============================================================================
// ApplicationForm Component
// Form for creators to apply for DWY packages
// =============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DwyPackage, DwyApplicationFormData } from '../dwyTypes';
import { BUSINESS_TYPES, REVENUE_RANGES, TIMELINE_OPTIONS } from '../dwyTypes';

interface ApplicationFormProps {
  package: DwyPackage;
  onSubmit: (formData: DwyApplicationFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ApplicationForm({
  package: pkg,
  onSubmit,
  onCancel,
  isSubmitting,
}: ApplicationFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<DwyApplicationFormData>({
    business_name: '',
    business_type: '',
    current_revenue: '',
    goals: '',
    timeline: '',
    website_url: '',
    social_links: {},
    how_heard: '',
    additional_notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.business_name || !formData.business_type || !formData.current_revenue || !formData.goals || !formData.timeline) {
      setError(t('dwyPackages.applicationForm.requiredFieldsError'));
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dwyPackages.applicationForm.submitError'));
    }
  };

  const updateField = <K extends keyof DwyApplicationFormData>(
    field: K,
    value: DwyApplicationFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0A0A0A] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#1F1F1F]">
          <h2 className="text-2xl font-bold text-[#FAFAFA]">{t('dwyPackages.applicationForm.applyFor', { packageName: pkg.name })}</h2>
          <p className="text-[#A0A0A0] mt-1">{pkg.tagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Business Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
                {t('dwyPackages.applicationForm.businessNameLabel')} <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="text"
                value={formData.business_name}
                onChange={e => updateField('business_name', e.target.value)}
                className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                placeholder={t('dwyPackages.applicationForm.businessNamePlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
                {t('dwyPackages.applicationForm.businessTypeLabel')} <span className="text-[#EF4444]">*</span>
              </label>
              <select
                value={formData.business_type}
                onChange={e => updateField('business_type', e.target.value)}
                className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                required
              >
                <option value="">{t('dwyPackages.applicationForm.businessTypeSelectPlaceholder')}</option>
                {BUSINESS_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {t(`dwyPackages.types.businessTypes.${type.value === 'course_creator' ? 'courseCreator' : type.value === 'service_provider' ? 'serviceProvider' : type.value === 'community_builder' ? 'communityBuilder' : type.value}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Revenue */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('dwyPackages.applicationForm.currentRevenueLabel')} <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={formData.current_revenue}
              onChange={e => updateField('current_revenue', e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              required
            >
              <option value="">{t('dwyPackages.applicationForm.revenueSelectPlaceholder')}</option>
              {REVENUE_RANGES.map(range => (
                <option key={range.value} value={range.value}>
                  {t(`dwyPackages.types.revenueRanges.${range.value.replace('-', '_').replace('+', '_plus')}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Goals */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('dwyPackages.applicationForm.goalsLabel')} <span className="text-[#EF4444]">*</span>
            </label>
            <textarea
              value={formData.goals}
              onChange={e => updateField('goals', e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              rows={4}
              placeholder={t('dwyPackages.applicationForm.goalsPlaceholder')}
              required
            />
          </div>

          {/* Timeline */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('dwyPackages.applicationForm.timelineLabel')} <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={formData.timeline}
              onChange={e => updateField('timeline', e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              required
            >
              <option value="">{t('dwyPackages.applicationForm.timelineSelectPlaceholder')}</option>
              {TIMELINE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {t(`dwyPackages.types.timelineOptions.${option.value === '1_month' ? '1Month' : option.value === '1_3_months' ? '1_3Months' : option.value}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('dwyPackages.applicationForm.websiteUrlLabel')}
            </label>
            <input
              type="url"
              value={formData.website_url}
              onChange={e => updateField('website_url', e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              placeholder={t('dwyPackages.applicationForm.websiteUrlPlaceholder')}
            />
          </div>

          {/* How heard */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('dwyPackages.applicationForm.howHeardLabel')}
            </label>
            <input
              type="text"
              value={formData.how_heard}
              onChange={e => updateField('how_heard', e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              placeholder={t('dwyPackages.applicationForm.howHeardPlaceholder')}
            />
          </div>

          {/* Additional notes */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('dwyPackages.applicationForm.additionalNotesLabel')}
            </label>
            <textarea
              value={formData.additional_notes}
              onChange={e => updateField('additional_notes', e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              rows={3}
              placeholder={t('dwyPackages.applicationForm.additionalNotesPlaceholder')}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-[#EF4444]/10 text-[#EF4444] p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 justify-end pt-4 border-t border-[#1F1F1F]">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors"
              disabled={isSubmitting}
            >
              {t('dwyPackages.applicationForm.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg hover:bg-[#E0E0E0] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  {t('dwyPackages.applicationForm.submitting')}
                </>
              ) : (
                t('dwyPackages.applicationForm.submitApplication')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ApplicationForm;
