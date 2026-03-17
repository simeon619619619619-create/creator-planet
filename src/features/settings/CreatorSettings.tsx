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
      setMessage(null); // Clear any stale error messages on load
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
      // Don't show error for connect status - it's optional and the section will show setup prompt
    }
  };

  const handleSetupPayouts = async () => {
    if (!profile?.id || !profile?.email) return;

    setConnectLoading(true);
    setMessage(null);
    try {
      // Create account if doesn't exist
      if (!connectStatus) {
        const result = await createConnectAccount(profile.id, profile.email);
        console.log('createConnectAccount result:', JSON.stringify(result));
        if (!result.success) {
          console.error('createConnectAccount failed:', result.error);
          setMessage({ type: 'error', text: result.error || t('creatorSettings.creator.payouts.error.failed') });
          return;
        }
      }

      // Get onboarding link
      console.log('Getting onboarding link for:', profile.id);
      const onboardingUrl = await getConnectOnboardingLink(profile.id);
      console.log('Onboarding URL:', onboardingUrl);
      if (onboardingUrl) {
        window.location.href = onboardingUrl;
      } else {
        setMessage({ type: 'error', text: t('creatorSettings.creator.payouts.error.onboardingLink') });
      }
    } catch (error) {
      console.error('handleSetupPayouts error:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : t('creatorSettings.creator.payouts.error.setup') });
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
      const errMsg = error instanceof Error ? error.message : '';
      // Show user-friendly message instead of raw Supabase/Edge Function errors
      const isTechnicalError = errMsg.includes('Edge Function') || errMsg.includes('PGRST') || errMsg.includes('non-2xx');
      setMessage({
        type: 'error',
        text: isTechnicalError
          ? t('creatorSettings.creator.save.error')
          : (errMsg || t('creatorSettings.creator.save.error'))
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#A0A0A0]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Name */}
      <div>
        <label htmlFor="brand_name" className="block text-xs font-medium text-[#A0A0A0] mb-2">
          {t('creatorSettings.creator.brandName.label')}
        </label>
        <input
          type="text"
          id="brand_name"
          value={formData.brand_name}
          onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
          className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder:text-[#666666] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10"
          placeholder={t('creatorSettings.creator.brandName.placeholder')}
        />
        <p className="mt-1 text-xs text-[#666666]">
          {t('creatorSettings.creator.brandName.hint')}
        </p>
      </div>

      {/* Biography */}
      <div>
        <label htmlFor="bio" className="block text-xs font-medium text-[#A0A0A0] mb-2">
          {t('creatorSettings.creator.biography.label')}
        </label>
        <textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={4}
          className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder:text-[#666666] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10 resize-none"
          placeholder={t('creatorSettings.creator.biography.placeholder')}
        />
        <p className="mt-1 text-xs text-[#666666]">
          {t('creatorSettings.creator.biography.hint')}
        </p>
        <div className="mt-2 flex items-start gap-2 p-2 bg-[#151515] rounded-lg border border-[#1F1F1F]">
          <Info size={14} className="text-[#A0A0A0] mt-0.5 shrink-0" />
          <p className="text-xs text-[#A0A0A0]">
            {t('creatorSettings.creator.biography.visibilityHint')}
          </p>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label htmlFor="timezone" className="block text-xs font-medium text-[#A0A0A0] mb-2">
          {t('creatorSettings.creator.timezone.label')}
        </label>
        <select
          id="timezone"
          value={formData.timezone}
          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
          className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder:text-[#666666] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[#666666]">
          {t('creatorSettings.creator.timezone.hint')}
        </p>
      </div>

      {/* Payout Status Section */}
      <div className="pt-6 border-t border-[#1F1F1F]">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={20} className="text-[#FAFAFA]" />
          <h3 className="text-lg font-semibold text-[#FAFAFA]">{t('creatorSettings.creator.payouts.section')}</h3>
        </div>

        {!connectStatus ? (
          // No Connect account
          <div className="p-4 bg-[#0A0A0A] rounded-lg border border-[#1F1F1F]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#EAB308]/10 rounded-full flex items-center justify-center shrink-0">
                <Clock size={20} className="text-[#EAB308]" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-[#FAFAFA]">{t('creatorSettings.creator.payouts.notSetup.title')}</h4>
                <p className="text-sm text-[#A0A0A0] mt-1">
                  {t('creatorSettings.creator.payouts.notSetup.description')}
                </p>
                <button
                  onClick={handleSetupPayouts}
                  disabled={connectLoading}
                  className="mt-3 inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E0E0E0] transition-colors disabled:opacity-50"
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
          <div className="p-4 bg-[#22C55E]/10 rounded-lg border border-[#22C55E]/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#22C55E]/10 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle size={20} className="text-[#22C55E]" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-[#FAFAFA]">{t('creatorSettings.creator.payouts.active.title')}</h4>
                <p className="text-sm text-[#22C55E] mt-1">
                  {t('creatorSettings.creator.payouts.active.description')}
                </p>
                <button
                  onClick={() => navigate('/settings/billing')}
                  className="mt-3 text-sm font-medium text-[#A0A0A0] hover:text-[#FAFAFA]"
                >
                  {t('creatorSettings.creator.payouts.active.manageLink')}
                </button>
              </div>
            </div>
          </div>
        ) : connectStatus.status === 'pending' ? (
          // Pending Connect account
          <div className="p-4 bg-[#EAB308]/10 rounded-lg border border-[#EAB308]/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#EAB308]/10 rounded-full flex items-center justify-center shrink-0">
                <Clock size={20} className="text-[#EAB308]" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-[#FAFAFA]">{t('creatorSettings.creator.payouts.pending.title')}</h4>
                <p className="text-sm text-[#EAB308] mt-1">
                  {t('creatorSettings.creator.payouts.pending.description')}
                </p>
                <button
                  onClick={handleSetupPayouts}
                  disabled={connectLoading}
                  className="mt-3 inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E0E0E0] transition-colors disabled:opacity-50"
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
          <div className="p-4 bg-[#EF4444]/10 rounded-lg border border-[#EF4444]/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#EF4444]/10 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-[#EF4444]" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-[#FAFAFA]">{t('creatorSettings.creator.payouts.restricted.title')}</h4>
                <p className="text-sm text-[#EF4444] mt-1">
                  {t('creatorSettings.creator.payouts.restricted.description')}
                </p>
                <button
                  onClick={handleSetupPayouts}
                  disabled={connectLoading}
                  className="mt-3 inline-flex items-center gap-2 bg-[#EF4444] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#EF4444]/80 transition-colors disabled:opacity-50"
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
        <label htmlFor="ai_prompt" className="flex items-center gap-2 text-xs font-medium text-[#A0A0A0] mb-2">
          <Sparkles size={16} className="text-[#FAFAFA]" />
          {t('creatorSettings.creator.aiInstructions.label')}
        </label>
        <textarea
          id="ai_prompt"
          value={formData.ai_prompt}
          onChange={(e) => setFormData({ ...formData, ai_prompt: e.target.value })}
          rows={6}
          className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder:text-[#666666] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10 resize-none font-mono text-sm"
          placeholder={t('creatorSettings.creator.aiInstructions.placeholder')}
        />
        <p className="mt-1 text-xs text-[#666666]">
          {t('creatorSettings.creator.aiInstructions.hint')}
        </p>
      </div>

      {/* Success/Error Message - hide raw technical errors */}
      {message && !message.text.includes('non-2xx') && !message.text.includes('Edge Function') && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
              : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-[#1F1F1F]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
