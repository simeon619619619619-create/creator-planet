import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/contexts/AuthContext';
import { joinCommunity, getMembership, applyToCommunity, getApplication } from '../../features/community/communityService';
import { createCommunityCheckout } from '../../features/community/communityPaymentService';
import { formatCommunityPrice, type CommunityPricingType, type CommunityAccessType, type ApplicationStatus } from '../../features/community/communityTypes';
import { supabase } from '../../core/supabase/client';
import { UserPlus, Check, Loader2, ArrowRight, CreditCard, Repeat, Clock, X, FileText, XCircle } from 'lucide-react';
import { getCommunityIntakeSurvey, hasCompletedSurvey } from '../../features/surveys/surveyService';
import type { Survey } from '../../features/surveys/surveyTypes';
import SurveyPlayer from '../../features/surveys/components/SurveyPlayer';
import { ApplyModal } from './ApplyModal';

interface JoinButtonProps {
  communityId: string;
  communityName: string;
  // Optional pricing props - if provided, skip fetching from database
  pricingType?: CommunityPricingType;
  priceCents?: number;
  currency?: string;
  // Access type for gated communities
  accessType?: CommunityAccessType;
  // Discount code support
  discountCode?: string;
  discountedPriceCents?: number; // Final price after discount (undefined = no discount)
  // Increment to force membership re-fetch (e.g. after cancel cleanup)
  refreshTrigger?: number;
  // Dual pricing support
  checkoutMode?: 'one_time' | 'monthly';
  monthlyPriceCents?: number;
  // Existing props
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const JoinButton: React.FC<JoinButtonProps> = ({
  communityId,
  communityName,
  // Optional pricing props
  pricingType: propsPricingType,
  priceCents: propsPriceCents,
  currency: propsCurrency = 'EUR',
  // Access type
  accessType: propsAccessType,
  // Discount code support
  discountCode,
  discountedPriceCents,
  // Membership re-fetch trigger
  refreshTrigger,
  // Dual pricing support
  checkoutMode,
  monthlyPriceCents,
  // Existing props
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isJoining, setIsJoining] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<{
    isMember: boolean;
    paymentStatus: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Survey modal state
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [intakeSurvey, setIntakeSurvey] = useState<Survey | null>(null);
  // Application state for gated communities
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [communityPricing, setCommunityPricing] = useState<{
    pricing_type: CommunityPricingType;
    price_cents: number;
    currency: string;
    access_type: CommunityAccessType;
  } | null>(
    // Initialize from props if provided
    propsPricingType !== undefined
      ? {
          pricing_type: propsPricingType,
          price_cents: propsPriceCents ?? 0,
          currency: propsCurrency,
          access_type: propsAccessType || 'open',
        }
      : null
  );

  // Fetch community pricing and access type when component mounts (only if not provided via props)
  useEffect(() => {
    // Skip fetch if pricing was provided via props
    if (propsPricingType !== undefined) {
      return;
    }

    const fetchPricing = async () => {
      const { data, error } = await supabase
        .from('communities')
        .select('pricing_type, price_cents, currency, access_type')
        .eq('id', communityId)
        .single();

      if (!error && data) {
        setCommunityPricing({
          pricing_type: data.pricing_type || 'free',
          price_cents: data.price_cents || 0,
          currency: data.currency || 'EUR',
          access_type: data.access_type || 'open',
        });
      }
    };

    fetchPricing();
  }, [communityId, propsPricingType]);

  // Check for existing application (for gated communities)
  useEffect(() => {
    const checkApplication = async () => {
      if (!user) {
        setApplicationStatus(null);
        return;
      }

      const application = await getApplication(user.id, communityId);
      if (application) {
        setApplicationStatus(application.status);
      } else {
        setApplicationStatus(null);
      }
    };

    checkApplication();
  }, [user, communityId]);

  // Check membership status when user is authenticated
  // Re-runs when refreshTrigger changes (e.g. after cancel cleanup in parent)
  useEffect(() => {
    const checkMembership = async () => {
      if (!user) {
        setMembershipStatus(null);
        return;
      }

      const membership = await getMembership(user.id, communityId);
      if (membership) {
        // payment_status can be: null, 'none' (free), 'pending', 'paid', 'expired', 'failed'
        const paymentStatus = (membership as { payment_status?: string | null }).payment_status ?? null;

        // Safety net: clean up stale pending memberships (>30 min)
        if (paymentStatus === 'pending') {
          const joinedAt = (membership as { joined_at?: string }).joined_at;
          const staleCutoff = 30 * 60 * 1000; // 30 minutes
          if (joinedAt && Date.now() - new Date(joinedAt).getTime() > staleCutoff) {
            const { error: deleteError } = await supabase
              .from('memberships')
              .delete()
              .eq('id', (membership as { id: string }).id)
              .eq('payment_status', 'pending');
            if (!deleteError) {
              setMembershipStatus(null);
              return;
            }
            // If delete failed, still show pending state (accurate)
          }
        }

        // User is a valid member if:
        // - payment_status is null or 'none' (free community - DB default is 'none')
        // - payment_status is 'paid'
        const isValidMember = paymentStatus === null || paymentStatus === 'none' || paymentStatus === 'paid';
        setMembershipStatus({
          isMember: isValidMember,
          paymentStatus,
        });
      } else {
        setMembershipStatus(null);
      }
    };

    checkMembership();
  }, [user, communityId, refreshTrigger]);

  const handleClick = async () => {
    setError(null);

    // If not authenticated, redirect to signup with return URL
    if (!user) {
      const returnUrl = encodeURIComponent(`/community/${communityId}?action=join`);
      navigate(`/signup?return=${returnUrl}`);
      return;
    }

    // If already a member, navigate to community
    if (membershipStatus?.isMember) {
      navigate(`/app/community`);
      return;
    }

    // If payment is pending, clean up stale membership and restart checkout
    if (membershipStatus?.paymentStatus === 'pending') {
      setIsJoining(true);
      try {
        // Delete the stale pending membership so checkout can restart
        const membership = await getMembership(user.id, communityId);
        if (membership) {
          await supabase
            .from('memberships')
            .delete()
            .eq('id', (membership as { id: string }).id)
            .eq('payment_status', 'pending');
        }
        setMembershipStatus(null);
      } catch {
        // Continue even if cleanup fails — checkout will upsert
      } finally {
        setIsJoining(false);
      }
      // Fall through to the checkout flow below
    }

    // If application is pending or rejected, don't allow action
    if (applicationStatus === 'pending' || applicationStatus === 'rejected') {
      return;
    }

    // Check if this is a paid community
    if (communityPricing?.pricing_type !== 'free' && communityPricing?.price_cents > 0) {
      // Paid community - redirect to Stripe Checkout
      setIsJoining(true);
      try {
        // Determine checkout mode for dual pricing
        const effectiveCheckoutMode = communityPricing.pricing_type === 'both'
          ? (checkoutMode || 'one_time')
          : undefined;

        const result = await createCommunityCheckout({
          communityId,
          successUrl: `${window.location.origin}/community/${communityId}?success=true`,
          cancelUrl: `${window.location.origin}/community/${communityId}?canceled=true`,
          discountCode,
          checkoutMode: effectiveCheckoutMode,
        });

        if (result.success && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          setError(result.error || t('publicCommunities.join.error.checkoutFailed'));
        }
      } catch (err) {
        setError(t('publicCommunities.join.error.generic'));
      } finally {
        setIsJoining(false);
      }
      return;
    }

    // Free community - check if gated
    if (communityPricing?.access_type === 'gated') {
      // Gated community - show apply modal
      setShowApplyModal(true);
      return;
    }

    // Open free community - join directly
    setIsJoining(true);
    try {
      const result = await joinCommunity(user.id, communityId);
      if (result) {
        setMembershipStatus({ isMember: true, paymentStatus: null });

        // Check for intake survey
        if (profile?.id) {
          try {
            const survey = await getCommunityIntakeSurvey(communityId);
            if (survey && survey.is_required) {
              // Check if student has already completed it
              const completed = await hasCompletedSurvey(survey.id, profile.id);
              if (!completed) {
                // Show survey modal instead of navigating
                setIntakeSurvey(survey);
                setShowSurveyModal(true);
                setIsJoining(false);
                return;
              }
            }
          } catch (surveyErr) {
            console.error('Error checking intake survey:', surveyErr);
            // Continue with navigation even if survey check fails
          }
        }

        // Navigate to authenticated community view after short delay
        setTimeout(() => {
          navigate(`/app/community`);
        }, 1000);
      } else {
        setError(t('publicCommunities.join.error.joinFailed'));
      }
    } catch (err) {
      setError(t('publicCommunities.join.error.generic'));
    } finally {
      setIsJoining(false);
    }
  };

  // Handle application submission for gated communities
  const handleApply = async (message: string) => {
    if (!user) return;

    setIsApplying(true);
    try {
      const result = await applyToCommunity(user.id, communityId, message);
      if (result) {
        setApplicationStatus('pending');
        setShowApplyModal(false);
      } else {
        setError(t('publicCommunities.apply.error.failed'));
      }
    } catch (err) {
      setError(t('publicCommunities.apply.error.generic'));
    } finally {
      setIsApplying(false);
    }
  };

  // Derived state for cleaner conditionals
  const isMember = membershipStatus?.isMember ?? false;
  const isPendingPayment = membershipStatus?.paymentStatus === 'pending';
  const isGatedCommunity = communityPricing?.pricing_type === 'free' && communityPricing?.access_type === 'gated';
  const isPendingApplication = applicationStatus === 'pending';
  const isRejectedApplication = applicationStatus === 'rejected';

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  // Determine if this is a paid community
  const isPaidCommunity =
    communityPricing?.pricing_type !== 'free' && (communityPricing?.price_cents ?? 0) > 0;

  // Get formatted pricing display using the helper
  const pricingDisplay = communityPricing
    ? formatCommunityPrice(
        communityPricing.price_cents,
        communityPricing.currency,
        communityPricing.pricing_type
      )
    : null;

  // Variant classes - add prominent styling for paid communities and pending state
  const getVariantClass = () => {
    if (isMember) {
      return variant === 'primary'
        ? 'bg-[#22C55E] text-white hover:bg-[#22C55E]/90'
        : 'border border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/10';
    }
    if (isPendingPayment) {
      // Pending payment - clickable to retry, not cursor-wait
      return variant === 'primary'
        ? 'bg-[#EAB308] text-black hover:bg-[#EAB308]/90'
        : 'border-2 border-[#EAB308]/40 text-[#EAB308] hover:bg-[#EAB308]/10';
    }
    if (isPendingApplication) {
      return variant === 'primary'
        ? 'bg-[#EAB308] text-black cursor-wait'
        : 'border-2 border-[#EAB308]/40 text-[#EAB308] cursor-wait';
    }
    if (isRejectedApplication) {
      return variant === 'primary'
        ? 'bg-[#333333] text-[#666666] cursor-not-allowed'
        : 'border-2 border-[#333333] text-[#666666] cursor-not-allowed';
    }
    if (isPaidCommunity) {
      return variant === 'primary'
        ? 'bg-white text-black hover:bg-[#E0E0E0]'
        : 'border-2 border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#151515] hover:border-[#333333]';
    }
    if (isGatedCommunity) {
      return variant === 'primary'
        ? 'bg-white text-black hover:bg-[#E0E0E0]'
        : 'border-2 border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#151515] hover:border-[#333333]';
    }
    return variant === 'primary'
      ? 'bg-white text-black hover:bg-[#E0E0E0]'
      : 'border border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#151515]';
  };

  // Icon based on state
  const renderIcon = () => {
    const iconSize = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

    if (isJoining) {
      return <Loader2 className={`${iconSize} animate-spin`} />;
    }
    if (isMember) {
      return <Check className={iconSize} />;
    }
    if (isPendingPayment) {
      return <CreditCard className={iconSize} />;
    }
    if (isPendingApplication) {
      return <Clock className={`${iconSize} animate-pulse`} />;
    }
    if (isRejectedApplication) {
      return <XCircle className={iconSize} />;
    }
    if (!user) {
      return <ArrowRight className={iconSize} />;
    }
    // Authenticated user - show payment icon for paid communities
    if (isPaidCommunity) {
      if (communityPricing?.pricing_type === 'monthly' || (communityPricing?.pricing_type === 'both' && checkoutMode === 'monthly')) {
        return <Repeat className={iconSize} />;
      }
      return <CreditCard className={iconSize} />;
    }
    // Gated community - show application icon
    if (isGatedCommunity) {
      return <FileText className={iconSize} />;
    }
    return <UserPlus className={iconSize} />;
  };

  // Button text based on state
  const getButtonText = () => {
    if (isJoining) {
      if (isPaidCommunity) {
        return t('publicCommunities.join.redirecting');
      }
      return t('publicCommunities.join.joining');
    }
    if (isMember) return t('publicCommunities.join.goToCommunity');
    if (isPendingPayment) return t('publicCommunities.join.retryPayment');
    if (isPendingApplication) return t('publicCommunities.apply.pending');
    if (isRejectedApplication) return t('publicCommunities.apply.rejected');

    // Not authenticated
    if (!user) return t('publicCommunities.join.signInToJoin');

    // Use formatted pricing display for paid communities
    if (isPaidCommunity && pricingDisplay) {
      // If a discount makes it free, show free access text
      if (discountedPriceCents !== undefined && discountedPriceCents <= 0) {
        return t('publicCommunities.join.freeAccess');
      }

      // If a discount is applied, show discounted price
      if (discountedPriceCents !== undefined && discountedPriceCents < (communityPricing?.price_cents ?? 0)) {
        const discountedFormatted = formatCommunityPrice(discountedPriceCents, communityPricing?.currency || 'EUR', 'one_time');
        return t('publicCommunities.join.buyAccess', { price: discountedFormatted.price });
      }

      // Handle dual pricing
      if (communityPricing?.pricing_type === 'both') {
        const effectiveMode = checkoutMode || 'one_time';
        if (effectiveMode === 'monthly' && monthlyPriceCents) {
          const monthlyFormatted = formatCommunityPrice(monthlyPriceCents, communityPricing.currency, 'monthly');
          return t('publicCommunities.join.subscribe', { price: monthlyFormatted.price });
        }
        return t('publicCommunities.join.buyAccess', { price: pricingDisplay.price });
      }
      if (communityPricing?.pricing_type === 'monthly') {
        return t('publicCommunities.join.subscribe', { price: pricingDisplay.price });
      }
      return t('publicCommunities.join.buyAccess', { price: pricingDisplay.price });
    }

    // Gated free community
    if (isGatedCommunity) {
      return t('publicCommunities.apply.applyToJoin');
    }

    return t('publicCommunities.join.joinCommunity');
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={isJoining || isPendingApplication || isRejectedApplication}
        className={`
          inline-flex items-center justify-center gap-2 font-medium rounded-lg
          transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${getVariantClass()}
          ${className}
        `}
      >
        {renderIcon()}
        {getButtonText()}
      </button>

      {error && (
        <p className="text-xs text-[#EF4444]">{error}</p>
      )}

      {/* Intake Survey Modal */}
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
          <div className="relative w-full h-full max-w-4xl max-h-[90vh] bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl overflow-hidden m-4">
            {/* Close button - only show if survey is not required */}
            {!intakeSurvey.is_required && (
              <button
                onClick={() => {
                  setShowSurveyModal(false);
                  navigate('/app/community');
                }}
                className="absolute top-4 right-4 z-10 p-2 text-[#666666] hover:text-[#FAFAFA] hover:bg-[#151515] rounded-full transition-colors"
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

      {/* Apply Modal for gated communities */}
      {showApplyModal && (
        <ApplyModal
          communityName={communityName}
          onSubmit={handleApply}
          onClose={() => setShowApplyModal(false)}
          isSubmitting={isApplying}
        />
      )}
    </div>
  );
};
