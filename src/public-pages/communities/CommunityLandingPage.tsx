import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicLayout } from './PublicLayout';
import { JoinButton } from './JoinButton';
import { useAuth } from '../../core/contexts/AuthContext';
import { getCommunityPublicData, joinCommunity, getMembership, getCommunityAccessCode } from '../../features/community/communityService';
import { DiscountCodeInput } from '../../features/discounts/components/DiscountCodeInput';
import { TBIButton } from '../../features/billing/components/TBIButton';
import { TBIApplicationModal } from '../../features/billing/components/TBIApplicationModal';
import { getCommunityIntakeSurvey, hasCompletedSurvey } from '../../features/surveys/surveyService';
import type { Survey } from '../../features/surveys/surveyTypes';
import SurveyPlayer from '../../features/surveys/components/SurveyPlayer';
import type { CommunityPublicData } from '../../core/types';
import {
  Users,
  MessageSquare,
  Hash,
  Heart,
  Calendar,
  Loader2,
  AlertCircle,
  ArrowLeft,
  CreditCard,
  Repeat,
  Gift,
  FileText,
  Play,
  X,
  ChevronRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// Creator Bio Modal Component
interface CreatorBioModalProps {
  creator: {
    full_name: string;
    avatar_url: string | null;
    bio: string | null;
    brand_name: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
}

const CreatorBioModal: React.FC<CreatorBioModalProps> = ({ creator, isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] rounded-xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient and avatar */}
        <div className="relative flex-shrink-0">
          {/* Gradient background */}
          <div className="h-28 bg-[var(--fc-section-hover,#1F1F1F)] rounded-t-xl" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-[var(--fc-surface,#0A0A0A)] transition-colors duration-150 z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Avatar - positioned to overlap */}
          <div className="absolute left-6 -bottom-14">
            <img
              src={creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.full_name)}&background=1F1F1F&color=FAFAFA&size=128`}
              alt={creator.full_name}
              className="w-28 h-28 rounded-full object-contain border-4 border-[#0A0A0A] bg-white p-1.5"
            />
          </div>
        </div>

        {/* Content area with scroll */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Spacer for avatar overlap */}
          <div className="h-16" />

          <div className="px-6 pb-6">
            {/* Creator info */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--fc-text,#FAFAFA)]">
                  {creator.brand_name || creator.full_name}
                </h2>
                {creator.brand_name && (
                  <p className="text-[var(--fc-muted,#666666)]">{creator.full_name}</p>
                )}
              </div>

              {creator.bio ? (
                <div className="prose max-w-none">
                  <p className="text-[var(--fc-muted,#A0A0A0)] whitespace-pre-wrap leading-relaxed">
                    {creator.bio}
                  </p>
                </div>
              ) : (
                <p className="text-[var(--fc-muted,#666666)] italic">
                  {t('publicCommunities.landing.creator.noBio')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CommunityLandingPage: React.FC = () => {
  const { t } = useTranslation();
  const { communityId } = useParams<{ communityId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [communityData, setCommunityData] = useState<CommunityPublicData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoJoining, setIsAutoJoining] = useState(false);
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | null>(null);
  const [discountedPriceCents, setDiscountedPriceCents] = useState<number | undefined>(undefined);
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showCancelMessage, setShowCancelMessage] = useState(false);
  const [joinButtonRefresh, setJoinButtonRefresh] = useState(0);
  // Dual pricing checkout mode (for 'both' pricing type)
  const [selectedCheckoutMode, setSelectedCheckoutMode] = useState<'one_time' | 'monthly'>('one_time');
  // TBI modal state
  const [showTBIModal, setShowTBIModal] = useState(false);
  // Survey modal state for post-payment intake
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [intakeSurvey, setIntakeSurvey] = useState<Survey | null>(null);

  // Load community data
  useEffect(() => {
    const loadCommunity = async () => {
      if (!communityId) {
        setError(t('publicCommunities.landing.error.notFound'));
        setIsLoading(false);
        return;
      }

      try {
        const data = await getCommunityPublicData(communityId);
        if (!data) {
          setError(t('publicCommunities.landing.error.privateOrNotExist'));
        } else {
          setCommunityData(data);
          // Replace UUID URL with slug if available
          if (data.community.slug && communityId !== data.community.slug) {
            window.history.replaceState({}, '', `/community/${data.community.slug}`);
          }
        }
      } catch (err) {
        setError(t('publicCommunities.landing.error.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    loadCommunity();
  }, [communityId]);

  // Handle auto-join after authentication
  useEffect(() => {
    const handleAutoJoin = async () => {
      const action = searchParams.get('action');
      if (user && action === 'join' && communityId && communityData) {
        setIsAutoJoining(true);

        // Check if already a member
        const membership = await getMembership(user.id, communityId);
        if (membership) {
          navigate('/app/community');
          return;
        }

        // Check access code
        const requiredCode = await getCommunityAccessCode(communityId);
        if (requiredCode) {
          const enteredCode = prompt('Въведете код за достъп:');
          if (!enteredCode || enteredCode !== requiredCode) {
            alert('Невалиден код за достъп');
            setIsAutoJoining(false);
            return;
          }
        }

        // Join the community
        const result = await joinCommunity(user.id, communityId, 'member', requiredCode || undefined);
        if (result) {
          navigate('/app/community');
        } else {
          setIsAutoJoining(false);
        }
      }
    };

    handleAutoJoin();
  }, [user, searchParams, communityId, communityData, navigate]);

  // Handle payment success/cancel URL params
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      setShowSuccessMessage(true);
      // Clear URL params without reload
      window.history.replaceState({}, '', `/community/${communityData?.community.slug || communityId}`);

      // Check for intake survey before redirecting
      const checkSurveyAndRedirect = async () => {
        if (communityId && profile?.id) {
          try {
            const survey = await getCommunityIntakeSurvey(communityId);
            if (survey && survey.is_required) {
              // Check if student has already completed it
              const completed = await hasCompletedSurvey(survey.id, profile.id);
              if (!completed) {
                // Show survey modal instead of auto-redirecting
                setIntakeSurvey(survey);
                setShowSurveyModal(true);
                setShowSuccessMessage(false);
                return;
              }
            }
          } catch (surveyErr) {
            console.error('Error checking intake survey:', surveyErr);
            // Continue with redirect even if survey check fails
          }
        }

        // No survey needed, auto-redirect after delay
        setTimeout(() => {
          navigate('/app/community');
        }, 2500);
      };

      checkSurveyAndRedirect();
    }

    if (canceled === 'true') {
      setShowCancelMessage(true);
      window.history.replaceState({}, '', `/community/${communityData?.community.slug || communityId}`);
      setTimeout(() => setShowCancelMessage(false), 8000);

      // Clean up pending membership, then signal JoinButtons to re-fetch
      if (user && communityId) {
        getMembership(user.id, communityId).then(async (membership) => {
          if (membership) {
            const paymentStatus = (membership as { payment_status?: string | null }).payment_status;
            if (paymentStatus === 'pending') {
              const { supabase } = await import('../../core/supabase/client');
              const { error: deleteError } = await supabase
                .from('memberships')
                .delete()
                .eq('id', (membership as { id: string }).id)
                .eq('payment_status', 'pending');
              if (deleteError) {
                console.error('Failed to clean up pending membership:', deleteError);
              }
            }
          }
          // Signal all JoinButton instances to re-fetch membership state
          setJoinButtonRefresh((prev) => prev + 1);
        });
      }
    }
  }, [searchParams, communityId, navigate, profile?.id]);

  // Loading state
  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-white animate-spin mx-auto" />
            <p className="mt-4 text-[var(--fc-muted,#A0A0A0)]">{t('publicCommunities.landing.loading')}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Error state
  if (error || !communityData) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <AlertCircle className="w-16 h-16 text-[var(--fc-muted,#666666)] mx-auto" />
            <h1 className="mt-4 text-2xl font-bold text-[var(--fc-text,#FAFAFA)]">{t('publicCommunities.landing.error.title')}</h1>
            <p className="mt-2 text-[var(--fc-muted,#A0A0A0)]">
              {error || t('publicCommunities.landing.error.defaultMessage')}
            </p>
            <button
              onClick={() => navigate('/communities')}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[var(--fc-surface,#0A0A0A)] text-black rounded-lg hover:bg-[#E0E0E0] transition-colors duration-150"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('publicCommunities.landing.error.browseCommunities')}
            </button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Auto-joining state
  if (isAutoJoining) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-white animate-spin mx-auto" />
            <p className="mt-4 text-lg font-medium text-[var(--fc-text,#FAFAFA)]">
              {t('publicCommunities.landing.joining.title', { name: communityData.community.name })}
            </p>
            <p className="mt-1 text-[var(--fc-muted,#A0A0A0)]">{t('publicCommunities.landing.joining.subtitle')}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const { community, memberCount, channelPreviews, recentPosts, creator } = communityData;
  const placeholderImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(community.name)}&background=1F1F1F&color=FAFAFA&size=800`;

  return (
    <PublicLayout themeColor={community.theme_color} textColor={community.text_color} accentColor={community.accent_color} secondaryColor={community.secondary_color} sectionColor={community.section_color} backgroundElements={community.background_elements}>
      {/* Payment Success Notification */}
      {showSuccessMessage && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-md rounded-2xl bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] overflow-hidden"
            style={{
              animation: 'successSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {/* Progress bar */}
            <div className="h-1 bg-[var(--fc-section-hover,#1F1F1F)]">
              <div
                className="h-full bg-[#22C55E] rounded-full"
                style={{
                  animation: 'successProgress 2.5s linear forwards',
                }}
              />
            </div>

            <div className="px-5 py-4 flex items-center gap-4">
              {/* Animated checkmark circle */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-11 h-11 rounded-full bg-[#22C55E] flex items-center justify-center"
                  style={{
                    animation: 'successPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both',
                  }}
                >
                  <CheckCircle className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                {/* Pulse ring */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-[#22C55E]"
                  style={{
                    animation: 'successRing 0.8s ease-out 0.3s both',
                  }}
                />
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--fc-text,#FAFAFA)] text-[15px]">
                  {t('publicCommunities.landing.paymentSuccess.title')}
                </p>
                <p className="text-sm text-[var(--fc-muted,#666666)] mt-0.5">
                  {t('publicCommunities.landing.paymentSuccess.message', { name: community.name })}
                </p>
              </div>

              {/* Spinner for redirect */}
              <div className="flex-shrink-0">
                <Loader2 className="w-4 h-4 text-[#22C55E] animate-spin" />
              </div>
            </div>
          </div>

          {/* Inline keyframes */}
          <style>{`
            @keyframes successSlideIn {
              from { opacity: 0; transform: translateY(-16px) scale(0.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes successPop {
              from { transform: scale(0); }
              to { transform: scale(1); }
            }
            @keyframes successRing {
              from { transform: scale(1); opacity: 0.6; }
              to { transform: scale(1.8); opacity: 0; }
            }
            @keyframes successProgress {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>
      )}

      {/* Payment Canceled Notification */}
      {showCancelMessage && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-md rounded-2xl bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] overflow-hidden"
            style={{
              animation: 'successSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div className="px-5 py-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#EAB308] flex items-center justify-center">
                <XCircle className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--fc-text,#FAFAFA)] text-[15px]">
                  {t('publicCommunities.landing.paymentCanceled.title')}
                </p>
                <p className="text-sm text-[var(--fc-muted,#666666)] mt-0.5">
                  {t('publicCommunities.landing.paymentCanceled.message')}
                </p>
              </div>
              <button
                onClick={() => setShowCancelMessage(false)}
                className="flex-shrink-0 p-1.5 rounded-full text-[var(--fc-muted,#666666)] hover:text-[var(--fc-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] transition-colors duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative">
        {/* Background Image */}
        <div className="h-80 md:h-96 relative overflow-hidden">
          <img
            src={community.thumbnail_url || placeholderImage}
            alt={community.name}
            className="w-full h-full object-cover"
            style={{ objectPosition: `${community.thumbnail_focal_x != null ? community.thumbnail_focal_x * 100 : 50}% ${community.thumbnail_focal_y != null ? community.thumbnail_focal_y * 100 : 50}%` }}
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        {/* Hero Content */}
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 md:pb-12 w-full">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                  {community.name}
                </h1>
                <div className="mt-4 flex items-center gap-4 text-white/70">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {t('publicCommunities.landing.stats.member', { count: memberCount })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="w-4 h-4" />
                    {t('publicCommunities.landing.stats.channel', { count: channelPreviews.length })}
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0">
                <JoinButton
                  communityId={community.id}
                  communityName={community.name}
                  communitySlug={community.slug}
                  pricingType={community.pricing_type}
                  priceCents={community.price_cents}
                  currency={community.currency}
                  accessType={community.access_type}
                  discountCode={appliedDiscountCode || undefined}
                  discountedPriceCents={discountedPriceCents}
                  refreshTrigger={joinButtonRefresh}
                  checkoutMode={community.pricing_type === 'both' ? selectedCheckoutMode : undefined}
                  monthlyPriceCents={community.monthly_price_cents}
                  size="lg"
                  variant="primary"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About / Description */}
            <section className="bg-[var(--fc-surface,#0A0A0A)] rounded-xl border border-[var(--fc-border,#1F1F1F)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--fc-border,#1F1F1F)]">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[var(--fc-text,#FAFAFA)]" />
                  <h2 className="text-lg font-semibold text-[var(--fc-text,#FAFAFA)]">{t('publicCommunities.landing.about.title')}</h2>
                </div>
              </div>
              <div className="p-6">
                {community.description ? (
                  <div className="prose max-w-none">
                    <p className="text-[var(--fc-muted,#A0A0A0)] whitespace-pre-wrap leading-relaxed">
                      {community.description}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-[#333333] mx-auto" />
                    <p className="mt-3 text-[var(--fc-muted,#666666)]">{t('publicCommunities.landing.about.noDescription')}</p>
                  </div>
                )}
              </div>
            </section>

            {/* VSL Video Player - Only shown if VSL exists */}
            {community.vsl_url && (
              <section className="bg-[var(--fc-surface,#0A0A0A)] rounded-xl border border-[var(--fc-border,#1F1F1F)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--fc-border,#1F1F1F)]">
                  <div className="flex items-center gap-2">
                    <Play className="w-5 h-5 text-[var(--fc-text,#FAFAFA)]" />
                    <h2 className="text-lg font-semibold text-[var(--fc-text,#FAFAFA)]">{t('publicCommunities.landing.video.title')}</h2>
                  </div>
                </div>
                <div className="p-0">
                  <div className="aspect-video bg-black">
                    <video
                      controls
                      className="w-full h-full"
                      poster={community.thumbnail_url || undefined}
                      preload="metadata"
                    >
                      <source src={community.vsl_url} type="video/mp4" />
                      <source src={community.vsl_url} type="video/webm" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              </section>
            )}

            {/* Join CTA Banner */}
            <div className="bg-[var(--fc-surface,#0A0A0A)] rounded-xl border border-[var(--fc-border,#1F1F1F)] p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--fc-text,#FAFAFA)]">{t('publicCommunities.landing.joinCta.title', { name: community.name })}</h3>
                  <p className="text-sm text-[var(--fc-muted,#A0A0A0)] mt-1">
                    {t('publicCommunities.landing.joinCta.subtitle')}
                  </p>
                </div>
                <JoinButton
                  communityId={community.id}
                  communityName={community.name}
                  communitySlug={community.slug}
                  pricingType={community.pricing_type}
                  priceCents={community.price_cents}
                  currency={community.currency}
                  accessType={community.access_type}
                  discountCode={appliedDiscountCode || undefined}
                  discountedPriceCents={discountedPriceCents}
                  refreshTrigger={joinButtonRefresh}
                  checkoutMode={community.pricing_type === 'both' ? selectedCheckoutMode : undefined}
                  monthlyPriceCents={community.monthly_price_cents}
                  size="md"
                  className="flex-shrink-0"
                />
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Creator Card - Clickable */}
            <button
              onClick={() => setIsCreatorModalOpen(true)}
              className="bg-[var(--fc-surface,#0A0A0A)] rounded-xl border border-[var(--fc-border,#1F1F1F)] p-6 w-full text-left hover:border-[#333333] hover:bg-[var(--fc-section-hover,#151515)] transition-all duration-150 group"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[var(--fc-muted,#666666)] uppercase tracking-wide">
                  {t('publicCommunities.landing.creator.createdBy')}
                </h3>
                <ChevronRight className="w-4 h-4 text-[var(--fc-muted,#666666)] group-hover:text-[var(--fc-text,#FAFAFA)] group-hover:translate-x-0.5 transition-all duration-150" />
              </div>
              <div className="flex items-center gap-4">
                <img
                  src={creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.full_name)}&background=1F1F1F&color=FAFAFA&size=64`}
                  alt={creator.full_name}
                  className="w-16 h-16 rounded-full object-contain bg-white p-1 ring-2 ring-transparent group-hover:ring-[#333333] transition-all duration-150"
                />
                <div>
                  <h4 className="font-semibold text-[var(--fc-text,#FAFAFA)] group-hover:text-white transition-colors duration-150">
                    {creator.brand_name || creator.full_name}
                  </h4>
                  {creator.brand_name && (
                    <p className="text-sm text-[var(--fc-muted,#666666)]">{creator.full_name}</p>
                  )}
                </div>
              </div>
              {creator.bio && (
                <p className="mt-4 text-sm text-[var(--fc-muted,#A0A0A0)] line-clamp-2">
                  {creator.bio}
                </p>
              )}
              <p className="mt-3 text-xs text-[var(--fc-muted,#A0A0A0)] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {t('publicCommunities.landing.creator.learnMore')}
              </p>
            </button>

            {/* Pricing Card */}
            {community.pricing_type !== 'free' && community.price_cents > 0 && (
              <div className="bg-[var(--fc-surface,#0A0A0A)] rounded-xl border border-[var(--fc-border,#1F1F1F)] p-6">
                {/* Dual pricing toggle tabs */}
                {community.pricing_type === 'both' && community.monthly_price_cents && community.monthly_price_cents > 0 ? (
                  <>
                    <div className="flex rounded-lg bg-[var(--fc-section-hover,#1F1F1F)] p-1 mb-4">
                      <button
                        onClick={() => setSelectedCheckoutMode('one_time')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                          selectedCheckoutMode === 'one_time'
                            ? 'bg-[var(--fc-surface,#0A0A0A)] text-[var(--fc-muted,#A0A0A0)] '
                            : 'text-[var(--fc-text,#FAFAFA)] hover:text-[var(--fc-muted,#A0A0A0)]'
                        }`}
                      >
                        {t('publicCommunities.landing.pricing.oneTimeTab')}
                      </button>
                      <button
                        onClick={() => setSelectedCheckoutMode('monthly')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                          selectedCheckoutMode === 'monthly'
                            ? 'bg-[var(--fc-surface,#0A0A0A)] text-[var(--fc-muted,#A0A0A0)] '
                            : 'text-[var(--fc-text,#FAFAFA)] hover:text-[var(--fc-muted,#A0A0A0)]'
                        }`}
                      >
                        {t('publicCommunities.landing.pricing.monthlyTab')}
                      </button>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-[var(--fc-text,#FAFAFA)]">
                        €{selectedCheckoutMode === 'monthly'
                          ? (community.monthly_price_cents / 100).toFixed(2)
                          : (community.price_cents / 100).toFixed(2)}
                      </span>
                      {selectedCheckoutMode === 'monthly' && (
                        <span className="text-[var(--fc-muted,#A0A0A0)]">{t('publicCommunities.landing.pricing.perMonth')}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[var(--fc-muted,#A0A0A0)]">
                      {selectedCheckoutMode === 'monthly'
                        ? t('publicCommunities.landing.pricing.subscriptionDescription')
                        : t('publicCommunities.landing.pricing.oneTimeDescription')}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      {community.pricing_type === 'monthly' ? (
                        <Repeat className="w-5 h-5 text-[var(--fc-text,#FAFAFA)]" />
                      ) : (
                        <CreditCard className="w-5 h-5 text-[var(--fc-text,#FAFAFA)]" />
                      )}
                      <h3 className="text-sm font-medium text-[var(--fc-muted,#A0A0A0)] uppercase tracking-wide">
                        {community.pricing_type === 'monthly' ? t('publicCommunities.landing.pricing.subscription') : t('publicCommunities.landing.pricing.oneTime')}
                      </h3>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-[var(--fc-text,#FAFAFA)]">
                        €{(community.price_cents / 100).toFixed(2)}
                      </span>
                      {community.pricing_type === 'monthly' && (
                        <span className="text-[var(--fc-muted,#A0A0A0)]">{t('publicCommunities.landing.pricing.perMonth')}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[var(--fc-muted,#A0A0A0)]">
                      {community.pricing_type === 'monthly'
                        ? t('publicCommunities.landing.pricing.subscriptionDescription')
                        : t('publicCommunities.landing.pricing.oneTimeDescription')}
                    </p>
                  </>
                )}

                {/* Discount Code Input */}
                <div className="mt-4">
                  <DiscountCodeInput
                    communityId={community.id}
                    originalPriceCents={community.pricing_type === 'both' && selectedCheckoutMode === 'monthly'
                      ? (community.monthly_price_cents || community.price_cents)
                      : community.price_cents}
                    currency={community.currency}
                    onValidCode={(code, discount) => {
                      setAppliedDiscountCode(code);
                      setDiscountedPriceCents(discount.finalPriceCents ?? undefined);
                    }}
                    onClear={() => {
                      setAppliedDiscountCode(null);
                      setDiscountedPriceCents(undefined);
                    }}
                  />
                </div>

                <div className="mt-4">
                  <JoinButton
                    communityId={community.id}
                    communityName={community.name}
                    pricingType={community.pricing_type}
                    priceCents={community.price_cents}
                    currency={community.currency}
                    accessType={community.access_type}
                    discountCode={appliedDiscountCode || undefined}
                    discountedPriceCents={discountedPriceCents}
                    refreshTrigger={joinButtonRefresh}
                    checkoutMode={community.pricing_type === 'both' ? selectedCheckoutMode : undefined}
                    monthlyPriceCents={community.monthly_price_cents}
                    size="md"
                    className="w-full justify-center"
                  />
                </div>

                {/* TBI Installment Option - only show for one-time payments */}
                {community.tbi_enabled && community.price_cents >= 5000 && (community.pricing_type !== 'both' || selectedCheckoutMode === 'one_time') && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-[var(--fc-section-hover,#1F1F1F)]" />
                      <span className="text-xs text-[var(--fc-muted,#666666)] uppercase">или</span>
                      <div className="flex-1 h-px bg-[var(--fc-section-hover,#1F1F1F)]" />
                    </div>
                    <TBIButton
                      amountCents={community.price_cents}
                      currency={community.currency}
                      productName={community.name}
                      productType="community"
                      productId={community.id}
                      className="w-full"
                      style="outline"
                      onClick={() => {
                        if (!user) {
                          const returnUrl = encodeURIComponent(`/community/${community.slug || community.id}`);
                          navigate(`/signup?return=${returnUrl}`);
                          return;
                        }
                        setShowTBIModal(true);
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Free Community Badge */}
            {(community.pricing_type === 'free' || community.price_cents === 0) && (
              <div className="bg-[var(--fc-surface,#0A0A0A)] rounded-xl border border-[var(--fc-border,#1F1F1F)] p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-5 h-5 text-[#22C55E]" />
                  <h3 className="text-sm font-medium text-[#22C55E] uppercase tracking-wide">
                    {t('publicCommunities.landing.pricing.freeCommunity')}
                  </h3>
                </div>
                <p className="text-sm text-[var(--fc-muted,#A0A0A0)]">
                  {t('publicCommunities.landing.pricing.freeDescription')}
                </p>
                <div className="mt-4">
                  <JoinButton
                    communityId={community.id}
                    communityName={community.name}
                    communitySlug={community.slug}
                    pricingType="free"
                    priceCents={0}
                    currency={community.currency}
                    accessType={community.access_type}
                    refreshTrigger={joinButtonRefresh}
                    size="md"
                    className="w-full justify-center"
                  />
                </div>
              </div>
            )}

            {/* Stats Card */}
            <div className="bg-[var(--fc-surface,#0A0A0A)] rounded-xl  border border-[var(--fc-border,#1F1F1F)] p-6">
              <h3 className="text-sm font-medium text-[var(--fc-muted,#666666)] uppercase tracking-wide mb-4">
                {t('publicCommunities.landing.communityStats.title')}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--fc-muted,#A0A0A0)]">{t('publicCommunities.landing.communityStats.members')}</span>
                  <span className="font-semibold text-[var(--fc-text,#FAFAFA)]">{memberCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--fc-muted,#A0A0A0)]">{t('publicCommunities.landing.communityStats.channels')}</span>
                  <span className="font-semibold text-[var(--fc-text,#FAFAFA)]">{channelPreviews.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--fc-muted,#A0A0A0)]">{t('publicCommunities.landing.communityStats.created')}</span>
                  <span className="font-semibold text-[var(--fc-text,#FAFAFA)]">
                    {new Date(community.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Creator Bio Modal */}
      <CreatorBioModal
        creator={creator}
        isOpen={isCreatorModalOpen}
        onClose={() => setIsCreatorModalOpen(false)}
      />

      {/* TBI Application Modal */}
      {community.tbi_enabled && community.price_cents >= 5000 && (
        <TBIApplicationModal
          isOpen={showTBIModal}
          onClose={() => setShowTBIModal(false)}
          productType="community"
          productId={community.id}
          productName={community.name}
          amountCents={community.price_cents}
        />
      )}

      {/* Intake Survey Modal (shown after successful payment) */}
      {showSurveyModal && intakeSurvey && profile?.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              // Only allow close if survey is not required
              if (!intakeSurvey.is_required) {
                setShowSurveyModal(false);
                navigate('/app/community');
              }
            }}
          />
          {/* Modal Content */}
          <div className="relative w-full h-full max-w-4xl max-h-[90vh] bg-[var(--fc-surface,#0A0A0A)] rounded-xl  overflow-hidden m-4">
            {/* Close button - only show if survey is not required */}
            {!intakeSurvey.is_required && (
              <button
                onClick={() => {
                  setShowSurveyModal(false);
                  navigate('/app/community');
                }}
                className="absolute top-4 right-4 z-10 p-2 text-[var(--fc-muted,#666666)] hover:text-[var(--fc-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-full transition-colors duration-150"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {/* Survey Player */}
            <div className="h-full overflow-auto">
              <SurveyPlayer
                surveyId={intakeSurvey.id}
                studentId={profile.id}
                onComplete={() => {
                  setShowSurveyModal(false);
                  navigate('/app/community');
                }}
                onClose={() => {
                  // For required surveys, onClose should also navigate
                  // (user completed the survey via the "Continue" button)
                  setShowSurveyModal(false);
                  navigate('/app/community');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  );
};
