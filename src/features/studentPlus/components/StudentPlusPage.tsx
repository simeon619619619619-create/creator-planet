// =============================================================================
// StudentPlusPage Component
// Main entry point for Student Plus subscription and loyalty program
// =============================================================================

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useStudentSubscription } from '../hooks/useStudentSubscription';
import { studentPlusService } from '../studentPlusService';
import { STUDENT_PLUS_CONFIG, formatPrice } from '../studentPlusTypes';
import { LoyaltyDashboard } from './LoyaltyDashboard';
import { SubscriptionStatus } from './SubscriptionStatus';
import { CheckCircle, XCircle, LogIn, Sparkles } from 'lucide-react';

export function StudentPlusPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscription, isLoading, isSubscribed, refetch } = useStudentSubscription();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showCancelMessage, setShowCancelMessage] = useState(false);

  // Handle URL params for checkout success/cancel
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      setShowSuccessMessage(true);
      // Clear the URL params
      setSearchParams({});
      // Refresh subscription status
      refetch();
      // Auto-hide after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }

    if (canceled === 'true') {
      setShowCancelMessage(true);
      // Clear the URL params
      setSearchParams({});
      // Auto-hide after 5 seconds
      setTimeout(() => setShowCancelMessage(false), 5000);
    }
  }, [searchParams, setSearchParams, refetch]);

  const handleSubscribe = async () => {
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const { checkoutUrl } = await studentPlusService.createCheckoutSession(
        `${window.location.origin}/student-plus?success=true`,
        `${window.location.origin}/student-plus?canceled=true`
      );
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError(t('studentPlus.page.checkoutError'));
      setIsCheckingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Subscriber view - show dashboard
  if (isSubscribed && subscription) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        {/* Success notification */}
        {showSuccessMessage && (
          <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-[#22C55E] shrink-0" />
            <div>
              <p className="font-semibold text-[#22C55E]">{t('studentPlus.page.successTitle')}</p>
              <p className="text-[#22C55E] text-sm">{t('studentPlus.page.successMessage')}</p>
            </div>
          </div>
        )}
        <SubscriptionStatus subscription={subscription} onUpdate={refetch} />
        <LoyaltyDashboard consecutiveMonths={subscription.consecutive_months} />
      </div>
    );
  }

  // Non-subscriber view - sales page
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {/* Cancel notification */}
      {showCancelMessage && (
        <div className="bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-xl p-4 flex items-center gap-3 mb-8">
          <XCircle className="w-6 h-6 text-[#EAB308] shrink-0" />
          <div>
            <p className="font-semibold text-[#FAFAFA]">{t('studentPlus.page.canceledTitle')}</p>
            <p className="text-[#EAB308] text-sm">{t('studentPlus.page.canceledMessage')}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-block bg-[#1F1F1F] text-[#FAFAFA] text-sm font-semibold px-4 py-1 rounded-full mb-4">
          {t('studentPlus.page.tagline')}
        </div>
        <h1 className="text-4xl font-bold mb-4 text-[#FAFAFA]">{t('studentPlus.page.title')}</h1>
        <p className="text-xl text-[#A0A0A0] mb-6">
          {t('studentPlus.page.subtitle')}
        </p>
        <div className="text-4xl font-bold text-[#FAFAFA]">
          {formatPrice(STUDENT_PLUS_CONFIG.product.amount)}
          <span className="text-lg font-normal text-[#666666]">{t('studentPlus.page.pricePerMonth')}</span>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <BenefitCard
          icon="📬"
          title={t('studentPlus.page.benefits.exclusiveNewsletter.title')}
          description={t('studentPlus.page.benefits.exclusiveNewsletter.description')}
        />
        <BenefitCard
          icon="🎯"
          title={t('studentPlus.page.benefits.communityPerks.title')}
          description={t('studentPlus.page.benefits.communityPerks.description')}
        />
        <BenefitCard
          icon="🏆"
          title={t('studentPlus.page.benefits.loyaltyRewards.title')}
          description={t('studentPlus.page.benefits.loyaltyRewards.description')}
        />
        <BenefitCard
          icon="🎁"
          title={t('studentPlus.page.benefits.redeemRewards.title')}
          description={t('studentPlus.page.benefits.redeemRewards.description')}
        />
      </div>

      {/* Milestone Preview */}
      <div className="bg-[#0A0A0A] rounded-2xl p-8 mb-12">
        <h2 className="text-2xl font-bold mb-8 text-center text-[#FAFAFA]">{t('studentPlus.page.milestonePreview.title')}</h2>
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          {STUDENT_PLUS_CONFIG.milestones.map((milestone, index) => (
            <div key={milestone.months} className="flex items-center">
              <MilestonePreview
                emoji={milestone.emoji}
                months={milestone.months}
                bonus={milestone.bonus}
                name={milestone.name}
              />
              {index < STUDENT_PLUS_CONFIG.milestones.length - 1 && (
                <div className="h-1 w-12 md:w-16 bg-[#1F1F1F] mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* What You Get Section */}
      <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-8 mb-12">
        <h2 className="text-2xl font-bold mb-6 text-[#FAFAFA]">{t('studentPlus.page.whatsIncluded.title')}</h2>
        <ul className="space-y-4">
          <FeatureItem text={t('studentPlus.page.whatsIncluded.weeklyNewsletter')} />
          <FeatureItem text={t('studentPlus.page.whatsIncluded.monthlyPoints')} />
          <FeatureItem text={t('studentPlus.page.whatsIncluded.milestoneBadges')} />
          <FeatureItem text={t('studentPlus.page.whatsIncluded.bonusPoints')} />
          <FeatureItem text={t('studentPlus.page.whatsIncluded.redeemPoints')} />
          <FeatureItem text={t('studentPlus.page.whatsIncluded.memberOnlyPerks')} />
        </ul>
      </div>

      {/* CTA */}
      <div className="text-center">
        {checkoutError && (
          <div className="mb-4 text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-4 py-2 inline-block">
            {checkoutError}
          </div>
        )}

        {!user ? (
          // Auth-gated: Show sign-in CTA for logged out users
          <div className="space-y-4">
            <div className="bg-[#0A0A0A] border-2 border-[#1F1F1F] rounded-2xl p-6 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-[#FAFAFA]" />
                <span className="text-sm font-medium text-[#A0A0A0]">{t('studentPlus.page.readyToJoin')}</span>
              </div>
              <p className="text-[#A0A0A0] text-sm mb-4">
                {t('studentPlus.page.signInRequired')}
              </p>
              <button
                onClick={() => navigate('/signin?return=/student-plus')}
                className="w-full bg-white text-black px-8 py-4 rounded-xl text-lg font-semibold hover:bg-[#E0E0E0] transition-all flex items-center justify-center gap-3"
              >
                <LogIn className="w-5 h-5" />
                {t('studentPlus.page.signInToSubscribe')}
              </button>
              <p className="text-xs text-[#666666] mt-3">
                {t('studentPlus.page.noAccountYet')}{' '}
                <button
                  onClick={() => navigate('/signup?return=/student-plus')}
                  className="text-[#FAFAFA] hover:text-[#A0A0A0] font-medium underline underline-offset-2"
                >
                  {t('studentPlus.page.createAccount')}
                </button>
              </p>
            </div>
          </div>
        ) : (
          // Authenticated: Show subscribe button
          <>
            <button
              onClick={handleSubscribe}
              disabled={isCheckingOut}
              className="bg-white text-black px-8 py-4 rounded-xl text-xl font-semibold hover:bg-[#E0E0E0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                  {t('studentPlus.page.redirectingToCheckout')}
                </span>
              ) : (
                t('studentPlus.page.startYourJourney')
              )}
            </button>
            <p className="text-sm text-[#666666] mt-4">
              {t('studentPlus.page.cancelAnytime')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function BenefitCard({
  icon,
  title,
  description
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-[#0A0A0A] p-6 rounded-xl border border-[#1F1F1F] hover:border-[#333333] transition-colors">
      <span className="text-4xl mb-4 block">{icon}</span>
      <h3 className="font-semibold text-lg mb-2 text-[#FAFAFA]">{title}</h3>
      <p className="text-[#A0A0A0]">{description}</p>
    </div>
  );
}

function MilestonePreview({
  emoji,
  months,
  bonus,
  name
}: {
  emoji: string;
  months: number;
  bonus: number;
  name: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="text-center">
      <span className="text-3xl md:text-4xl block mb-2">{emoji}</span>
      <div className="font-semibold text-[#FAFAFA]">{name}</div>
      <div className="text-xs text-[#666666]">{months} {t('studentPlus.page.milestonePreview.months')}</div>
      <div className="text-xs text-[#FAFAFA] font-medium">+{bonus} {t('studentPlus.page.milestonePreview.pts')}</div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-[#22C55E] mt-0.5">✓</span>
      <span className="text-[#A0A0A0]">{text}</span>
    </li>
  );
}

export default StudentPlusPage;
