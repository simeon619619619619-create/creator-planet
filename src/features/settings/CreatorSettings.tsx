import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, Sparkles, Wallet, CheckCircle, Clock, AlertTriangle, ArrowRight, Info } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { getCreatorProfile, updateCreatorProfile, CreatorProfile } from './profileService';
import { getConnectAccountStatus, createConnectAccount, getConnectOnboardingLink } from '../billing';
import type { ConnectAccountStatus } from '../billing';

// Common timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
  { value: 'UTC', label: 'UTC' },
];

const CreatorSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    brand_name: '',
    bio: '',
    timezone: 'America/New_York',
    ai_prompt: '',
  });
  const [connectStatus, setConnectStatus] = useState<ConnectAccountStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadCreatorProfile();
      loadConnectStatus();
    }
  }, [profile?.id]);

  const loadCreatorProfile = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      // Use profile.id because creator_profiles.creator_id references profiles.id
      const creatorProfile = await getCreatorProfile(profile.id);
      if (creatorProfile) {
        setFormData({
          brand_name: creatorProfile.brand_name || '',
          bio: creatorProfile.bio || '',
          timezone: creatorProfile.timezone || 'America/New_York',
          ai_prompt: creatorProfile.ai_prompt || '',
        });
      }
    } catch (error) {
      console.error('Error loading creator profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConnectStatus = async () => {
    if (!profile?.id) return;
    try {
      // Use profile.id for Stripe Connect account lookup
      const status = await getConnectAccountStatus(profile.id);
      setConnectStatus(status);
    } catch (error) {
      console.error('Error loading connect status:', error);
    }
  };

  const handleSetupPayouts = async () => {
    if (!profile?.id || !profile?.email) return;

    setConnectLoading(true);
    try {
      // Create account if doesn't exist
      if (!connectStatus) {
        // Use profile.id for Stripe Connect account creation
        const result = await createConnectAccount(profile.id, profile.email);
        if (!result.success) {
          setMessage({ type: 'error', text: result.error || t('creatorSettings.creator.payouts.error.failed') });
          return;
        }
      }

      // Get onboarding link
      const onboardingUrl = await getConnectOnboardingLink(profile.id);
      if (onboardingUrl) {
        window.location.href = onboardingUrl;
      } else {
        setMessage({ type: 'error', text: t('creatorSettings.creator.payouts.error.onboardingLink') });
      }
    } catch (error) {
      console.error('Error setting up payouts:', error);
      setMessage({ type: 'error', text: t('creatorSettings.creator.payouts.error.setup') });
    } finally {
      setConnectLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    setSaving(true);
    setMessage(null);

    try {
      // Use profile.id because creator_profiles.creator_id references profiles.id
      await updateCreatorProfile(profile.id, {
        brand_name: formData.brand_name || null,
        bio: formData.bio || null,
        timezone: formData.timezone,
        ai_prompt: formData.ai_prompt || null,
      });

      setMessage({ type: 'success', text: t('creatorSettings.creator.save.success') });
    } catch (error) {
      console.error('Error saving creator settings:', error);
      setMessage({ type: 'error', text: t('creatorSettings.creator.save.error') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Name */}
      <div>
        <label htmlFor="brand_name" className="block text-sm font-medium text-slate-700 mb-2">
          {t('creatorSettings.creator.brandName.label')}
        </label>
        <input
          type="text"
          id="brand_name"
          value={formData.brand_name}
          onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder={t('creatorSettings.creator.brandName.placeholder')}
        />
        <p className="mt-1 text-xs text-slate-500">
          {t('creatorSettings.creator.brandName.hint')}
        </p>
      </div>

      {/* Biography */}
      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-slate-700 mb-2">
          {t('creatorSettings.creator.biography.label')}
        </label>
        <textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={4}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          placeholder={t('creatorSettings.creator.biography.placeholder')}
        />
        <p className="mt-1 text-xs text-slate-500">
          {t('creatorSettings.creator.biography.hint')}
        </p>
        <div className="mt-2 flex items-start gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
          <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            {t('creatorSettings.creator.biography.visibilityHint')}
          </p>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label htmlFor="timezone" className="block text-sm font-medium text-slate-700 mb-2">
          {t('creatorSettings.creator.timezone.label')}
        </label>
        <select
          id="timezone"
          value={formData.timezone}
          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {t('creatorSettings.creator.timezone.hint')}
        </p>
      </div>

      {/* Payout Status Section */}
      <div className="pt-6 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={20} className="text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900">{t('creatorSettings.creator.payouts.section')}</h3>
        </div>

        {!connectStatus ? (
          // No Connect account
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <Clock size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">{t('creatorSettings.creator.payouts.notSetup.title')}</h4>
                <p className="text-sm text-slate-600 mt-1">
                  {t('creatorSettings.creator.payouts.notSetup.description')}
                </p>
                <button
                  onClick={handleSetupPayouts}
                  disabled={connectLoading}
                  className="mt-3 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {connectLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('creatorSettings.creator.payouts.notSetup.loading')}
                    </>
                  ) : (
                    <>
                      {t('creatorSettings.creator.payouts.notSetup.button')}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : connectStatus.status === 'active' ? (
          // Active Connect account
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-green-900">{t('creatorSettings.creator.payouts.active.title')}</h4>
                <p className="text-sm text-green-700 mt-1">
                  {t('creatorSettings.creator.payouts.active.description')}
                </p>
                <button
                  onClick={() => navigate('/settings/billing')}
                  className="mt-3 text-sm font-medium text-green-700 hover:text-green-800"
                >
                  {t('creatorSettings.creator.payouts.active.manageLink')}
                </button>
              </div>
            </div>
          </div>
        ) : connectStatus.status === 'pending' ? (
          // Pending Connect account
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <Clock size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-amber-900">{t('creatorSettings.creator.payouts.pending.title')}</h4>
                <p className="text-sm text-amber-700 mt-1">
                  {t('creatorSettings.creator.payouts.pending.description')}
                </p>
                <button
                  onClick={handleSetupPayouts}
                  disabled={connectLoading}
                  className="mt-3 inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {connectLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('creatorSettings.creator.payouts.pending.loading')}
                    </>
                  ) : (
                    <>
                      {t('creatorSettings.creator.payouts.pending.button')}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Restricted Connect account
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-red-900">{t('creatorSettings.creator.payouts.restricted.title')}</h4>
                <p className="text-sm text-red-700 mt-1">
                  {t('creatorSettings.creator.payouts.restricted.description')}
                </p>
                <button
                  onClick={handleSetupPayouts}
                  disabled={connectLoading}
                  className="mt-3 inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {connectLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('creatorSettings.creator.payouts.restricted.loading')}
                    </>
                  ) : (
                    <>
                      {t('creatorSettings.creator.payouts.restricted.button')}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Prompt */}
      <div>
        <label htmlFor="ai_prompt" className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
          <Sparkles size={16} className="text-indigo-600" />
          {t('creatorSettings.creator.aiInstructions.label')}
        </label>
        <textarea
          id="ai_prompt"
          value={formData.ai_prompt}
          onChange={(e) => setFormData({ ...formData, ai_prompt: e.target.value })}
          rows={6}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
          placeholder={t('creatorSettings.creator.aiInstructions.placeholder')}
        />
        <p className="mt-1 text-xs text-slate-500">
          {t('creatorSettings.creator.aiInstructions.hint')}
        </p>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {t('creatorSettings.creator.save.saving')}
            </>
          ) : (
            <>
              <Save size={18} />
              {t('creatorSettings.creator.save.button')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CreatorSettings;
