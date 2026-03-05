// ============================================================================
// ONBOARDING PAGE
// Creator activation fee payment and account setup
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  CheckCircle,
  CreditCard,
  Rocket,
  Shield,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { createActivationCheckout, getCreatorBilling } from '../stripeService';

const OnboardingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, role } = useAuth();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyActivated, setAlreadyActivated] = useState(false);

  // Check URL params for success/cancel from Stripe
  const checkoutSuccess = searchParams.get('success') === 'true';
  const checkoutCanceled = searchParams.get('canceled') === 'true';

  // Check if user is a creator
  const isCreator = role === 'creator' || role === 'superadmin';

  // Load existing billing status
  useEffect(() => {
    const checkStatus = async () => {
      if (!profile?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const billing = await getCreatorBilling(profile.id);
        if (billing?.activation_fee_paid) {
          setAlreadyActivated(true);
        }
      } catch (err) {
        console.error('Error checking billing status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, [profile?.id]);

  // Handle checkout success - redirect to dashboard
  useEffect(() => {
    if (checkoutSuccess) {
      // Wait a moment for webhook to process, then redirect
      const timer = setTimeout(() => {
        navigate('/settings?tab=billing', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [checkoutSuccess, navigate]);

  // Handle activation checkout
  const handleActivate = async () => {
    if (!profile?.id) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await createActivationCheckout(profile.id);

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setError(result.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="text-[#FAFAFA] animate-spin mx-auto mb-4" />
          <p className="text-[#A0A0A0]">{t('billing.onboarding.loading')}</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-[#EAB308] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">
            {t('billing.onboarding.authRequiredTitle')}
          </h2>
          <p className="text-[#A0A0A0] mb-6">
            {t('billing.onboarding.authRequiredMessage')}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/login?return=/onboarding')}
              className="px-6 py-2 bg-[#1F1F1F] text-[#A0A0A0] font-medium rounded-lg hover:bg-[#151515] transition-colors"
            >
              {t('billing.onboarding.signInButton')}
            </button>
            <button
              onClick={() => navigate('/signup?role=creator')}
              className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors"
            >
              {t('billing.onboarding.signUpButton')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not a creator
  if (!isCreator) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-[#EAB308] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">
            {t('billing.onboarding.creatorRequiredTitle')}
          </h2>
          <p className="text-[#A0A0A0] mb-6">
            {t('billing.onboarding.creatorRequiredMessage')}
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors"
          >
            {t('billing.onboarding.goToSettingsButton')}
          </button>
        </div>
      </div>
    );
  }

  // Already activated
  if (alreadyActivated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-8 max-w-md text-center">
          <CheckCircle size={48} className="text-[#22C55E] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">
            {t('billing.onboarding.alreadyActivatedTitle')}
          </h2>
          <p className="text-[#A0A0A0] mb-6">
            {t('billing.onboarding.alreadyActivatedMessage')}
          </p>
          <button
            onClick={() => navigate('/settings?tab=billing')}
            className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors"
          >
            {t('billing.onboarding.goToBillingButton')}
          </button>
        </div>
      </div>
    );
  }

  // Success state (from Stripe redirect)
  if (checkoutSuccess) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-[#22C55E]" />
          </div>
          <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">
            {t('billing.onboarding.successTitle')}
          </h2>
          <p className="text-[#A0A0A0] mb-4">
            {t('billing.onboarding.successMessage')}
          </p>
          <Loader2 size={24} className="text-[#FAFAFA] animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Canceled state
  if (checkoutCanceled) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-[#EAB308] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">
            {t('billing.onboarding.canceledTitle')}
          </h2>
          <p className="text-[#A0A0A0] mb-6">
            {t('billing.onboarding.canceledMessage')}
          </p>
          <button
            onClick={handleActivate}
            disabled={isProcessing}
            className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors disabled:opacity-50"
          >
            {t('billing.onboarding.tryAgainButton')}
          </button>
        </div>
      </div>
    );
  }

  // Main onboarding view
  return (
    <div className="min-h-screen bg-[#0A0A0A] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-[#1F1F1F] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Rocket size={32} className="text-[#FAFAFA]" />
          </div>
          <h1 className="text-3xl font-bold text-[#FAFAFA] mb-4">
            {t('billing.onboarding.mainTitle')}
          </h1>
          <p className="text-lg text-[#A0A0A0] max-w-xl mx-auto">
            {t('billing.onboarding.mainSubtitle')}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-[#EF4444]/10 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Activation Card */}
        <div className="bg-[#0A0A0A] rounded-2xl border border-[#1F1F1F] overflow-hidden">
          {/* Price Header */}
          <div className="bg-gradient-to-r from-[#1F1F1F] to-[#151515] p-6 text-center text-white">
            <p className="text-[#A0A0A0] text-sm mb-1">{t('billing.onboarding.activationFeeLabel')}</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold">9.90</span>
              <span className="text-lg">{t('billing.onboarding.currency')}</span>
            </div>
          </div>

          {/* Features */}
          <div className="p-8">
            <h3 className="font-semibold text-[#FAFAFA] mb-4">{t('billing.onboarding.whatYouGet')}</h3>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#22C55E]/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle size={14} className="text-[#22C55E]" />
                </div>
                <div>
                  <p className="font-medium text-[#FAFAFA]">{t('billing.onboarding.features.communitiesTitle')}</p>
                  <p className="text-sm text-[#666666]">{t('billing.onboarding.features.communitiesDesc')}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#22C55E]/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle size={14} className="text-[#22C55E]" />
                </div>
                <div>
                  <p className="font-medium text-[#FAFAFA]">{t('billing.onboarding.features.coursesTitle')}</p>
                  <p className="text-sm text-[#666666]">{t('billing.onboarding.features.coursesDesc')}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#22C55E]/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle size={14} className="text-[#22C55E]" />
                </div>
                <div>
                  <p className="font-medium text-[#FAFAFA]">{t('billing.onboarding.features.paymentsTitle')}</p>
                  <p className="text-sm text-[#666666]">{t('billing.onboarding.features.paymentsDesc')}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#22C55E]/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle size={14} className="text-[#22C55E]" />
                </div>
                <div>
                  <p className="font-medium text-[#FAFAFA]">{t('billing.onboarding.features.aiTitle')}</p>
                  <p className="text-sm text-[#666666]">{t('billing.onboarding.features.aiDesc')}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#22C55E]/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle size={14} className="text-[#22C55E]" />
                </div>
                <div>
                  <p className="font-medium text-[#FAFAFA]">{t('billing.onboarding.features.starterTitle')}</p>
                  <p className="text-sm text-[#666666]">{t('billing.onboarding.features.starterDesc')}</p>
                </div>
              </li>
            </ul>

            {/* CTA Button */}
            <button
              onClick={handleActivate}
              disabled={isProcessing}
              className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-[#E0E0E0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {t('billing.upgradeModal.processing')}
                </>
              ) : (
                <>
                  <CreditCard size={20} />
                  {t('billing.onboarding.payButton')}
                </>
              )}
            </button>

            {/* Security Note */}
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-[#666666]">
              <Shield size={14} />
              <span>{t('billing.onboarding.securityNote')}</span>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8 p-6 bg-[#0A0A0A]/50 rounded-xl border border-[#1F1F1F]">
          <h3 className="font-semibold text-[#FAFAFA] mb-4">{t('billing.onboarding.faqTitle')}</h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-[#FAFAFA]">{t('billing.onboarding.faq.activationTitle')}</p>
              <p className="text-sm text-[#A0A0A0] mt-1">
                {t('billing.onboarding.faq.activationAnswer')}
              </p>
            </div>
            <div>
              <p className="font-medium text-[#FAFAFA]">{t('billing.onboarding.faq.monthlyTitle')}</p>
              <p className="text-sm text-[#A0A0A0] mt-1">
                {t('billing.onboarding.faq.monthlyAnswer')}
              </p>
            </div>
            <div>
              <p className="font-medium text-[#FAFAFA]">{t('billing.onboarding.faq.upgradeTitle')}</p>
              <p className="text-sm text-[#A0A0A0] mt-1">
                {t('billing.onboarding.faq.upgradeAnswer')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
