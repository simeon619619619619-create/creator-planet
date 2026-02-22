// ============================================================================
// COMMUNITY PRICING SETTINGS COMPONENT
// Allows creators to configure community pricing (free, one-time, or monthly)
// Self-contained: fetches data internally and saves via service
// Includes just-in-time Stripe Connect setup for paid communities
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DollarSign,
  Users,
  Calendar,
  Lock,
  Loader2,
  AlertCircle,
  Upload,
  Image,
  Wallet,
  ExternalLink,
  CheckCircle,
  Video,
  Trash2,
  FileText,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { supabase } from '../../../core/supabase/client';
import { updateCommunityPricing } from '../communityPaymentService';
import { updateCommunity, uploadCommunityThumbnail, uploadCommunityVSL, deleteCommunityVSL, deleteCommunity, updateCommunityAccessType } from '../communityService';
import type { CommunityAccessType } from '../communityTypes';
import {
  getConnectAccountStatus,
  createConnectAccount,
  getConnectOnboardingLink,
} from '../../billing/stripeService';
import type { ConnectAccountStatus } from '../../billing/stripeTypes';
import { useAuth } from '../../../core/contexts/AuthContext';

export type PricingType = 'free' | 'one_time' | 'monthly' | 'both';

export interface CommunityPricingSettingsProps {
  communityId: string;
  onSaved?: () => void;
  onDeleted?: () => void;
}

interface PricingOption {
  type: PricingType;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
}

interface CommunityData {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  pricing_type: PricingType | null;
  price_cents: number | null;
  monthly_price_cents: number | null;
  vsl_url: string | null;
  access_type: CommunityAccessType | null;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB for images
const MAX_VSL_SIZE = 500 * 1024 * 1024; // 500MB for VSL videos
const ALLOWED_VSL_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

const PRICING_OPTIONS: PricingOption[] = [
  {
    type: 'free',
    labelKey: 'communityHub.pricing.options.free.label',
    descriptionKey: 'communityHub.pricing.options.free.description',
    icon: Users,
  },
  {
    type: 'one_time',
    labelKey: 'communityHub.pricing.options.oneTime.label',
    descriptionKey: 'communityHub.pricing.options.oneTime.description',
    icon: Lock,
  },
  {
    type: 'monthly',
    labelKey: 'communityHub.pricing.options.monthly.label',
    descriptionKey: 'communityHub.pricing.options.monthly.description',
    icon: Calendar,
  },
  {
    type: 'both',
    labelKey: 'communityHub.pricing.options.both.label',
    descriptionKey: 'communityHub.pricing.options.both.description',
    icon: CreditCard,
  },
];

const DEFAULT_PLATFORM_FEE_PERCENT = 6.9;

const CommunityPricingSettings: React.FC<CommunityPricingSettingsProps> = ({
  communityId,
  onSaved,
  onDeleted,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFeePercent, setPlatformFeePercent] = useState(DEFAULT_PLATFORM_FEE_PERCENT);
  const [communityName, setCommunityName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [descriptionSaved, setDescriptionSaved] = useState(false);
  const [selectedType, setSelectedType] = useState<PricingType>('free');
  const [priceEuros, setPriceEuros] = useState<string>('');
  const [monthlyPriceEuros, setMonthlyPriceEuros] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // VSL state
  const [vslUrl, setVslUrl] = useState<string>('');
  const [isVslUploading, setIsVslUploading] = useState(false);
  const [vslUploadProgress, setVslUploadProgress] = useState(0);
  const [isDeletingVsl, setIsDeletingVsl] = useState(false);

  // Community deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Gated access state
  const [accessType, setAccessType] = useState<CommunityAccessType>('open');
  const [isSavingAccessType, setIsSavingAccessType] = useState(false);

  // Stripe Connect state
  const [connectStatus, setConnectStatus] = useState<ConnectAccountStatus | null>(null);
  const [isConnectLoading, setIsConnectLoading] = useState(false);
  const [isSettingUpConnect, setIsSettingUpConnect] = useState(false);

  // Fetch community data and Connect status on mount
  useEffect(() => {
    async function fetchData() {
      if (!profile?.id) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch community data, Connect status, and creator's plan fee in parallel
        const [communityResult, connectResult, billingResult] = await Promise.all([
          supabase
            .from('communities')
            .select('id, name, description, thumbnail_url, pricing_type, price_cents, monthly_price_cents, vsl_url, access_type')
            .eq('id', communityId)
            .single(),
          getConnectAccountStatus(profile.id),
          supabase
            .from('creator_billing')
            .select('plan:billing_plans(platform_fee_percent)')
            .eq('creator_id', profile.id)
            .single(),
        ]);

        // Set the creator's actual platform fee from their plan
        if (billingResult.data?.plan) {
          const plan = billingResult.data.plan as unknown as { platform_fee_percent: number };
          setPlatformFeePercent(Number(plan.platform_fee_percent) ?? DEFAULT_PLATFORM_FEE_PERCENT);
        }

        if (communityResult.error) {
          console.error('Error fetching community:', communityResult.error);
          setError(t('communityHub.pricing.errors.loadFailed'));
          return;
        }

        if (!communityResult.data) {
          setError(t('communityHub.pricing.errors.notFound'));
          return;
        }

        const community = communityResult.data as CommunityData;
        setCommunityName(community.name);
        setDescription(community.description || '');
        setSelectedType(community.pricing_type || 'free');
        setThumbnailUrl(community.thumbnail_url || '');
        setVslUrl(community.vsl_url || '');
        setAccessType(community.access_type || 'open');
        if (community.price_cents && community.price_cents > 0) {
          setPriceEuros((community.price_cents / 100).toFixed(2));
        }
        if (community.monthly_price_cents && community.monthly_price_cents > 0) {
          setMonthlyPriceEuros((community.monthly_price_cents / 100).toFixed(2));
        }

        // Set Connect status
        setConnectStatus(connectResult);
      } catch (err) {
        console.error('Exception fetching data:', err);
        setError(t('communityHub.pricing.errors.unexpected'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [communityId, profile?.id]);

  // Reset price when switching to free
  useEffect(() => {
    if (selectedType === 'free') {
      setPriceEuros('');
      setMonthlyPriceEuros('');
    }
  }, [selectedType]);

  const isPaidOption = selectedType !== 'free';
  const priceInCents = priceEuros ? Math.round(parseFloat(priceEuros) * 100) : 0;
  const monthlyPriceInCents = monthlyPriceEuros ? Math.round(parseFloat(monthlyPriceEuros) * 100) : 0;
  const hasValidPrice = !isPaidOption || (priceInCents >= 50); // Min 0.50 EUR
  const hasValidMonthlyPrice = selectedType !== 'both' || (monthlyPriceInCents >= 50);
  const priceExceedsMax = priceInCents > 999900; // Max €9999
  const monthlyPriceExceedsMax = monthlyPriceInCents > 999900;

  // Connect status helpers
  const hasConnectAccount = !!connectStatus;
  const isConnectReady = connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled;
  const connectNeedsSetup = !hasConnectAccount || !isConnectReady;

  // Can save: Free always allowed, or paid with Connect ready and valid price(s)
  const canSavePaidPricing = isPaidOption && isConnectReady && hasValidPrice && hasValidMonthlyPrice && !priceExceedsMax && !monthlyPriceExceedsMax;
  const canSave = selectedType === 'free' || canSavePaidPricing;

  // Calculate estimated earnings after platform fee
  const calculateEarnings = (): string => {
    if (!priceEuros || parseFloat(priceEuros) <= 0) return '0.00';
    const price = parseFloat(priceEuros);
    const fee = price * (platformFeePercent / 100);
    const earnings = price - fee;
    return earnings.toFixed(2);
  };

  // Handle setting up Stripe Connect
  const handleSetupConnect = async () => {
    if (!profile?.id || !profile?.email) {
      setError(t('communityHub.pricing.errors.completeProfile'));
      return;
    }

    setIsSettingUpConnect(true);
    setError(null);

    try {
      // First, create the Connect account if it doesn't exist
      if (!hasConnectAccount) {
        const createResult = await createConnectAccount(profile.id, profile.email);
        if (!createResult.success) {
          setError(createResult.error || t('communityHub.pricing.errors.createPayoutAccount'));
          setIsSettingUpConnect(false);
          return;
        }
      }

      // Get the onboarding link
      const onboardingUrl = await getConnectOnboardingLink(profile.id);
      if (onboardingUrl) {
        window.location.href = onboardingUrl;
      } else {
        setError(t('communityHub.pricing.errors.getOnboardingLink'));
      }
    } catch (err) {
      console.error('Error setting up Connect:', err);
      setError(t('communityHub.pricing.errors.settingUpPayouts'));
    } finally {
      setIsSettingUpConnect(false);
    }
  };

  // Refresh Connect status
  const refreshConnectStatus = async () => {
    if (!profile?.id) return;

    setIsConnectLoading(true);
    try {
      const status = await getConnectAccountStatus(profile.id);
      setConnectStatus(status);
    } catch (err) {
      console.error('Error refreshing Connect status:', err);
    } finally {
      setIsConnectLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canSave || isSaving) return;

    // Additional validation for paid communities
    if (isPaidOption) {
      if (connectNeedsSetup) {
        setError(t('communityHub.pricing.errors.setupPayoutsFirst'));
        return;
      }
      if (priceExceedsMax || monthlyPriceExceedsMax) {
        setError(t('communityHub.pricing.errors.maxPrice'));
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await updateCommunityPricing(communityId, {
        pricing_type: selectedType,
        price: selectedType === 'free' ? 0 : parseFloat(priceEuros) || 0,
        currency: 'EUR',
        monthlyPrice: selectedType === 'both' ? parseFloat(monthlyPriceEuros) || 0 : undefined,
      });

      if (!result.success) {
        setError(result.error || t('communityHub.pricing.errors.saveFailed'));
        return;
      }

      onSaved?.();
    } catch (err) {
      console.error('Exception saving pricing:', err);
      setError(t('communityHub.pricing.errors.unexpected'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string or valid decimal numbers
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setPriceEuros(value);
    }
  };

  const handleMonthlyPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setMonthlyPriceEuros(value);
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t('communityHub.pricing.errors.uploadImage'));
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(t('communityHub.pricing.errors.imageTooLarge'));
      return;
    }

    setIsUploading(true);
    const url = await uploadCommunityThumbnail(communityId, file);
    if (url) {
      setThumbnailUrl(url);
      // Save thumbnail to community immediately
      await updateCommunity(communityId, { thumbnail_url: url });
    } else {
      setError(t('communityHub.pricing.errors.thumbnailUploadFailed'));
    }
    setIsUploading(false);
  };

  const handleVslUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!ALLOWED_VSL_TYPES.includes(file.type)) {
      setError(t('communityHub.pricing.errors.videoFormat'));
      return;
    }

    // Validate file size
    if (file.size > MAX_VSL_SIZE) {
      setError(t('communityHub.pricing.errors.videoTooLarge'));
      return;
    }

    setIsVslUploading(true);
    setVslUploadProgress(0);

    try {
      const url = await uploadCommunityVSL(communityId, file, (progress) => {
        setVslUploadProgress(progress);
      });

      if (url) {
        setVslUrl(url);
      } else {
        setError(t('communityHub.pricing.errors.videoUploadFailed'));
      }
    } catch (err) {
      console.error('VSL upload error:', err);
      setError(t('communityHub.pricing.errors.videoUploadFailed'));
    } finally {
      setIsVslUploading(false);
      setVslUploadProgress(0);
    }
  };

  const handleDeleteVsl = async () => {
    if (!vslUrl) return;

    setIsDeletingVsl(true);
    setError(null);

    try {
      const success = await deleteCommunityVSL(communityId);
      if (success) {
        setVslUrl('');
      } else {
        setError(t('communityHub.pricing.errors.videoDeleteFailed'));
      }
    } catch (err) {
      console.error('VSL delete error:', err);
      setError(t('communityHub.pricing.errors.videoDeleteFailed'));
    } finally {
      setIsDeletingVsl(false);
    }
  };

  const handleSaveDescription = async () => {
    setIsSavingDescription(true);
    setError(null);
    setDescriptionSaved(false);

    try {
      const result = await updateCommunity(communityId, { description: description.trim() || null });
      if (!result) {
        setError(t('communityHub.pricing.errors.descriptionSaveFailed'));
        return;
      }
      setDescriptionSaved(true);
      // Auto-hide success message after 3 seconds
      setTimeout(() => setDescriptionSaved(false), 3000);
    } catch (err) {
      console.error('Description save error:', err);
      setError(t('communityHub.pricing.errors.descriptionSaveFailed'));
    } finally {
      setIsSavingDescription(false);
    }
  };

  // Handle access type toggle
  const handleAccessTypeToggle = async () => {
    const newAccessType: CommunityAccessType = accessType === 'open' ? 'gated' : 'open';
    setIsSavingAccessType(true);
    setError(null);

    try {
      const success = await updateCommunityAccessType(communityId, newAccessType);
      if (success) {
        setAccessType(newAccessType);
      } else {
        setError(t('communityHub.pricing.errors.accessTypeFailed'));
      }
    } catch (err) {
      console.error('Access type update error:', err);
      setError(t('communityHub.pricing.errors.accessTypeFailed'));
    } finally {
      setIsSavingAccessType(false);
    }
  };

  // Handle community deletion
  const handleDeleteCommunity = async () => {
    if (deleteConfirmName.trim().toLowerCase() !== communityName.trim().toLowerCase()) {
      setDeleteError(t('communityHub.pricing.errors.deleteNameMismatch'));
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteCommunity(communityId, deleteConfirmName.trim());

      if (result.success) {
        // Notify parent of successful deletion
        onDeleted?.();
      } else {
        setDeleteError(result.error || t('communityHub.pricing.errors.deleteFailed'));
      }
    } catch (err) {
      console.error('Delete community error:', err);
      setDeleteError(t('communityHub.pricing.errors.deleteUnexpected'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{t('communityHub.pricing.errors.title')}</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-base font-medium text-slate-900 mb-1">{t('communityHub.pricing.sectionTitle')}</h4>
        <p className="text-sm text-slate-500">
          {t('communityHub.pricing.sectionDescription', { communityName })}
        </p>
      </div>

      {/* Community Thumbnail */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('communityHub.pricing.thumbnail.label')}
        </label>
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={t('communityHub.pricing.thumbnail.label')}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image size={32} className="text-slate-400" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t('communityHub.pricing.thumbnail.uploading')}
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    {t('communityHub.pricing.thumbnail.uploadImage')}
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
                onClick={async () => {
                  setThumbnailUrl('');
                  await updateCommunity(communityId, { thumbnail_url: null });
                }}
                className="text-xs text-slate-500 hover:text-red-600 text-left"
              >
                {t('communityHub.pricing.thumbnail.remove')}
              </button>
            )}
            <p className="text-xs text-slate-500">
              {t('communityHub.pricing.thumbnail.hint')}
            </p>
          </div>
        </div>
      </div>

      {/* Community Description (About) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          <span className="flex items-center gap-2">
            <FileText size={16} className="text-indigo-600" />
            {t('communityHub.pricing.description.label')}
          </span>
        </label>
        <p className="text-xs text-slate-500 mb-2">
          {t('communityHub.pricing.description.hint')}
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('communityHub.pricing.description.placeholder')}
          rows={5}
          maxLength={2000}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              {t('communityHub.pricing.description.charCount', { count: description.length })}
            </p>
            {descriptionSaved && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <CheckCircle size={12} />
                {t('communityHub.pricing.description.saved')}
              </span>
            )}
          </div>
          <button
            onClick={handleSaveDescription}
            disabled={isSavingDescription}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isSavingDescription ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t('communityHub.pricing.description.saving')}
              </>
            ) : (
              t('communityHub.pricing.description.saveButton')
            )}
          </button>
        </div>
      </div>

      {/* VSL (Video Sales Letter) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('communityHub.pricing.vsl.label')}
        </label>
        <p className="text-xs text-slate-500 mb-3">
          {t('communityHub.pricing.vsl.hint')}
        </p>

        {vslUrl ? (
          // Video exists - show preview and delete option
          <div className="space-y-3">
            <div className="aspect-video bg-black rounded-lg overflow-hidden max-w-md">
              <video
                controls
                className="w-full h-full"
                preload="metadata"
              >
                <source src={vslUrl} type="video/mp4" />
                <source src={vslUrl} type="video/webm" />
                {t('communityHub.pricing.vsl.browserNotSupported')}
              </video>
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">
                  {isVslUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {vslUploadProgress > 0 ? t('communityHub.pricing.vsl.uploadingWithProgress', { progress: vslUploadProgress }) : t('communityHub.pricing.vsl.uploading')}
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      {t('communityHub.pricing.vsl.replaceVideo')}
                    </>
                  )}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleVslUpload}
                  className="hidden"
                  disabled={isVslUploading || isDeletingVsl}
                />
              </label>
              <button
                onClick={handleDeleteVsl}
                disabled={isDeletingVsl || isVslUploading}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium text-red-600 transition-colors disabled:opacity-50"
              >
                {isDeletingVsl ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t('communityHub.pricing.vsl.deleting')}
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    {t('communityHub.pricing.vsl.deleteVideo')}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          // No video - show upload prompt
          <div className="flex items-start gap-4">
            <div className="w-32 h-20 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200">
              <Video size={32} className="text-slate-400" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">
                  {isVslUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {vslUploadProgress > 0 ? t('communityHub.pricing.vsl.uploadingWithProgress', { progress: vslUploadProgress }) : t('communityHub.pricing.vsl.uploading')}
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      {t('communityHub.pricing.vsl.uploadVideo')}
                    </>
                  )}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleVslUpload}
                  className="hidden"
                  disabled={isVslUploading}
                />
              </label>
              <p className="text-xs text-slate-500">
                {t('communityHub.pricing.vsl.formatHint')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pricing Section Header */}
      <div className="pt-4 border-t border-slate-200">
        <h4 className="text-base font-medium text-slate-900 mb-1">{t('communityHub.pricing.title')}</h4>
        <p className="text-sm text-slate-500">
          {t('communityHub.pricing.subtitle')}
        </p>
      </div>

      {/* Pricing Type Selection */}
      <div className="space-y-3">
        {PRICING_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;

          return (
            <label
              key={option.type}
              className={`
                flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }
              `}
            >
              <input
                type="radio"
                name="pricing_type"
                value={option.type}
                checked={isSelected}
                onChange={() => setSelectedType(option.type)}
                className="sr-only"
              />
              <div
                className={`
                  w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                  ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}
                `}
              >
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <span
                  className={`
                    block font-medium
                    ${isSelected ? 'text-indigo-900' : 'text-slate-900'}
                  `}
                >
                  {t(option.labelKey)}
                </span>
                <span className="text-sm text-slate-500">{t(option.descriptionKey)}</span>
              </div>
              <div
                className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                  ${isSelected ? 'border-indigo-600' : 'border-slate-300'}
                `}
              >
                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
              </div>
            </label>
          );
        })}
      </div>

      {/* Gated Access Toggle (only for free communities) */}
      {selectedType === 'free' && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                <ShieldCheck size={20} className="text-indigo-600" />
              </div>
              <div>
                <h4 className="font-medium text-slate-900">
                  {t('communityHub.pricing.gatedAccess.title')}
                </h4>
                <p className="text-sm text-slate-500 mt-0.5">
                  {t('communityHub.pricing.gatedAccess.description')}
                </p>
              </div>
            </div>
            <button
              onClick={handleAccessTypeToggle}
              disabled={isSavingAccessType}
              className={`
                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                ${accessType === 'gated' ? 'bg-indigo-600' : 'bg-slate-300'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              role="switch"
              aria-checked={accessType === 'gated'}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                  transition duration-200 ease-in-out
                  ${accessType === 'gated' ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
              {isSavingAccessType && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={12} className="animate-spin text-white" />
                </span>
              )}
            </button>
          </div>
          {accessType === 'gated' && (
            <p className="mt-3 text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">
              {t('communityHub.pricing.gatedAccess.enabledHint')}
            </p>
          )}
        </div>
      )}

      {/* Price Input (only for paid options) */}
      {isPaidOption && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {selectedType === 'both'
                ? t('communityHub.pricing.price.oneTimeLabel')
                : t('communityHub.pricing.price.label')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-500 text-lg font-medium">€</span>
              </div>
              <input
                type="number"
                min="0.50"
                step="0.01"
                value={priceEuros}
                onChange={handlePriceChange}
                placeholder="0.00"
                className="
                  w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg
                  text-slate-900 placeholder-slate-400
                  focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                  transition-colors
                "
              />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {selectedType === 'both'
                ? t('communityHub.pricing.price.bothOneTimeHint')
                : selectedType === 'one_time'
                  ? t('communityHub.pricing.price.oneTimeHint')
                  : t('communityHub.pricing.price.monthlyHint')}
            </p>
            {priceEuros && parseFloat(priceEuros) > 0 && parseFloat(priceEuros) < 0.5 && (
              <p className="mt-1 text-sm text-amber-600">
                {t('communityHub.pricing.price.minPrice')}
              </p>
            )}
            {priceExceedsMax && (
              <p className="mt-1 text-sm text-red-600">
                {t('communityHub.pricing.price.maxPrice')}
              </p>
            )}
          </div>

          {/* Monthly price input (only when 'both' is selected) */}
          {selectedType === 'both' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t('communityHub.pricing.price.monthlyLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-slate-500 text-lg font-medium">€</span>
                </div>
                <input
                  type="number"
                  min="0.50"
                  step="0.01"
                  value={monthlyPriceEuros}
                  onChange={handleMonthlyPriceChange}
                  placeholder="0.00"
                  className="
                    w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg
                    text-slate-900 placeholder-slate-400
                    focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                    transition-colors
                  "
                />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {t('communityHub.pricing.price.bothMonthlyHint')}
              </p>
              {monthlyPriceEuros && parseFloat(monthlyPriceEuros) > 0 && parseFloat(monthlyPriceEuros) < 0.5 && (
                <p className="mt-1 text-sm text-amber-600">
                  {t('communityHub.pricing.price.minPrice')}
                </p>
              )}
              {monthlyPriceExceedsMax && (
                <p className="mt-1 text-sm text-red-600">
                  {t('communityHub.pricing.price.maxPrice')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stripe Connect Status (only for paid options) */}
      {isPaidOption && (
        <div className="space-y-3">
          {!hasConnectAccount ? (
            // No Connect account - show setup prompt
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <Wallet size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900">{t('communityHub.pricing.connect.setupTitle')}</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    {t('communityHub.pricing.connect.setupDescription')}
                  </p>
                  <button
                    onClick={handleSetupConnect}
                    disabled={isSettingUpConnect}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {isSettingUpConnect ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {t('communityHub.pricing.connect.settingUp')}
                      </>
                    ) : (
                      <>
                        <ExternalLink size={16} />
                        {t('communityHub.pricing.connect.setupButton')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : !isConnectReady ? (
            // Connect account exists but not fully set up
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <Wallet size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900">{t('communityHub.pricing.connect.completeTitle')}</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    {t('communityHub.pricing.connect.completeDescription')}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={handleSetupConnect}
                      disabled={isSettingUpConnect}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      {isSettingUpConnect ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {t('communityHub.pricing.connect.loading')}
                        </>
                      ) : (
                        <>
                          <ExternalLink size={16} />
                          {t('communityHub.pricing.connect.completeSetupButton')}
                        </>
                      )}
                    </button>
                    <button
                      onClick={refreshConnectStatus}
                      disabled={isConnectLoading}
                      className="text-sm text-amber-700 hover:text-amber-800 disabled:opacity-50"
                    >
                      {isConnectLoading ? t('communityHub.pricing.connect.checking') : t('communityHub.pricing.connect.refreshStatus')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Connect is fully set up
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                  <CheckCircle size={20} className="text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium text-green-900">{t('communityHub.pricing.connect.enabledTitle')}</h4>
                  <p className="text-sm text-green-700">
                    {t('communityHub.pricing.connect.enabledDescription')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Platform Fee Info Box */}
      {isPaidOption && priceEuros && parseFloat(priceEuros) >= 0.5 && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <DollarSign size={16} className="text-indigo-600" />
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {selectedType === 'both' ? t('communityHub.pricing.earnings.perSale') : selectedType === 'monthly' ? t('communityHub.pricing.earnings.perMonth') : t('communityHub.pricing.earnings.perSale')}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {'\u20AC'}{calculateEarnings()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {platformFeePercent > 0
                    ? t('communityHub.pricing.earnings.afterFee', { feePercent: platformFeePercent, feeAmount: (parseFloat(priceEuros) * platformFeePercent / 100).toFixed(2) })
                    : t('communityHub.pricing.earnings.noFee', { defaultValue: 'Без платформена такса' })}
                </p>
              </div>
              {selectedType === 'both' && monthlyPriceEuros && parseFloat(monthlyPriceEuros) >= 0.5 && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-sm font-medium text-slate-900">
                    {t('communityHub.pricing.earnings.perMonth')}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {'\u20AC'}{(() => {
                      const price = parseFloat(monthlyPriceEuros);
                      const fee = price * (platformFeePercent / 100);
                      return (price - fee).toFixed(2);
                    })()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('communityHub.pricing.earnings.afterFee', { feePercent: platformFeePercent, feeAmount: (parseFloat(monthlyPriceEuros) * platformFeePercent / 100).toFixed(2) })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving || !canSave}
        className="
          w-full py-3 px-4 rounded-lg font-medium transition-colors
          bg-indigo-600 text-white hover:bg-indigo-700
          disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed
        "
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('communityHub.pricing.saving')}
          </span>
        ) : (
          t('communityHub.pricing.savePricing')
        )}
      </button>

      {/* Danger Zone - Delete Community */}
      <div className="pt-6 mt-6 border-t border-red-200">
        <div className="space-y-4">
          <div>
            <h4 className="text-base font-medium text-red-900 flex items-center gap-2">
              <AlertCircle size={18} className="text-red-600" />
              {t('communityHub.pricing.dangerZone.title')}
            </h4>
            <p className="text-sm text-red-700 mt-1">
              {t('communityHub.pricing.dangerZone.description')}
            </p>
          </div>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
            >
              <Trash2 size={16} />
              {t('communityHub.pricing.dangerZone.deleteButton')}
            </button>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                  <AlertCircle size={20} className="text-red-600" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-red-900">{t('communityHub.pricing.dangerZone.confirmTitle')}</h5>
                  <p className="text-sm text-red-700 mt-1">
                    {t('communityHub.pricing.dangerZone.confirmWarning', { communityName })}
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-sm text-red-800">
                  {deleteError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-red-800 mb-2">
                  {t('communityHub.pricing.dangerZone.confirmLabel', { communityName })}
                </label>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={communityName}
                  className="w-full px-4 py-2 border border-red-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={isDeleting}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmName('');
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-4 rounded-lg font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  {t('communityHub.pricing.dangerZone.cancel')}
                </button>
                <button
                  onClick={handleDeleteCommunity}
                  disabled={isDeleting || deleteConfirmName.trim().toLowerCase() !== communityName.trim().toLowerCase()}
                  className="flex-1 py-2 px-4 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('communityHub.pricing.dangerZone.deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      {t('communityHub.pricing.dangerZone.deleteForever')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityPricingSettings;
