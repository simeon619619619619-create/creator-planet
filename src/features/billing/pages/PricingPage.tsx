// ============================================================================
// PRICING PAGE
// Public-facing pricing page showing all available plans
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ArrowLeft, Calculator, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../core/contexts/AuthContext';
import PlanCard from '../components/PlanCard';
import UpgradeModal from '../components/UpgradeModal';
import type { BillingPlan, PlanTier, CreatorBilling } from '../stripeTypes';
import { getPlans, getCreatorBilling, changePlan } from '../stripeService';

const PricingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();

  // State
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [billing, setBilling] = useState<CreatorBilling | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  // Check if user is a creator
  const isCreator = role === 'creator' || role === 'superadmin';

  // Load plans and billing info
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch all plans
        const plansData = await getPlans();
        setPlans(plansData);

        // If logged in creator, fetch their billing
        if (user && profile && isCreator) {
          const billingData = await getCreatorBilling(profile.id);
          setBilling(billingData);
        }
      } catch (err) {
        console.error('Error loading pricing data:', err);
        setError('Failed to load pricing information');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, profile, isCreator]);

  // Get current plan tier
  const currentPlanTier = billing?.plan?.tier;

  // Handle plan selection
  const handlePlanSelect = (tier: PlanTier) => {
    if (!user) {
      // Not logged in - redirect to signup
      navigate(`/signup?plan=${tier}`);
      return;
    }

    if (!isCreator) {
      // Logged in but not a creator
      navigate('/settings');
      return;
    }

    // Find the selected plan
    const plan = plans.find((p) => p.tier === tier);
    if (!plan) return;

    // If same as current plan, do nothing
    if (tier === currentPlanTier) return;

    // Show upgrade/downgrade modal
    setSelectedPlan(plan);
    setShowUpgradeModal(true);
  };

  // Handle plan change confirmation
  const handleConfirmPlanChange = async () => {
    if (!selectedPlan || !profile) return;

    setIsChangingPlan(true);
    try {
      const result = await changePlan(profile.id, selectedPlan.tier);

      if (result.success) {
        // Refresh billing data
        const updatedBilling = await getCreatorBilling(profile.id);
        setBilling(updatedBilling);
        setShowUpgradeModal(false);
        setSelectedPlan(null);
      } else {
        setError(result.error || 'Failed to change plan');
      }
    } catch (err) {
      console.error('Error changing plan:', err);
      setError('An error occurred while changing your plan');
    } finally {
      setIsChangingPlan(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="text-[#FAFAFA] animate-spin mx-auto mb-4" />
          <p className="text-[#A0A0A0]">{t('billing.pricing.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back button if logged in */}
        {user && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#A0A0A0] hover:text-[#FAFAFA] mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            {t('billing.pricing.backButton')}
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#FAFAFA] mb-4">
            {t('billing.pricing.title')}
          </h1>
          <p className="text-xl text-[#A0A0A0] max-w-2xl mx-auto">
            {t('billing.pricing.subtitle')}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-[#EF4444] text-center">
            {error}
          </div>
        )}

        {/* Current Plan Banner (for logged in creators) */}
        {isCreator && billing && (
          <div className="mb-8 p-4 bg-[#151515] border border-[#1F1F1F] rounded-lg flex items-center justify-center gap-3">
            <CheckCircle size={20} className="text-[#FAFAFA]" />
            <span className="text-[#FAFAFA]">
              {t('billing.pricing.currentPlanLabel', { planName: billing.plan?.name || 'Starter' })}
            </span>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={currentPlanTier === plan.tier}
              isRecommended={plan.tier === 'pro'}
              onSelect={handlePlanSelect}
              currentPlanTier={currentPlanTier}
            />
          ))}
        </div>

        {/* Break-Even Calculator */}
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-8 mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#1F1F1F] rounded-lg flex items-center justify-center">
              <Calculator size={20} className="text-[#FAFAFA]" />
            </div>
            <h2 className="text-xl font-bold text-[#FAFAFA]">{t('billing.pricing.calculator.title')}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Starter to Pro */}
            <div className="p-6 bg-[#0A0A0A] rounded-lg">
              <h3 className="font-semibold text-[#FAFAFA] mb-3">{t('billing.pricing.calculator.starterToProTitle')}</h3>
              <p className="text-[#A0A0A0] text-sm mb-4">
                {t('billing.pricing.calculator.starterToProMessage', { amount: '750' })}
              </p>
              <div className="text-xs text-[#666666]">
                <p>{t('billing.pricing.calculator.starterToProExample1')}</p>
                <p>{t('billing.pricing.calculator.starterToProExample2')}</p>
                <p>{t('billing.pricing.calculator.starterToProExample3')}</p>
              </div>
            </div>

            {/* Pro to Scale */}
            <div className="p-6 bg-[#0A0A0A] rounded-lg">
              <h3 className="font-semibold text-[#FAFAFA] mb-3">{t('billing.pricing.calculator.proToScaleTitle')}</h3>
              <p className="text-[#A0A0A0] text-sm mb-4">
                {t('billing.pricing.calculator.proToScaleMessage', { amount: '6,900' })}
              </p>
              <div className="text-xs text-[#666666]">
                <p>{t('billing.pricing.calculator.proToScaleExample1')}</p>
                <p>{t('billing.pricing.calculator.proToScaleExample2')}</p>
                <p>{t('billing.pricing.calculator.proToScaleExample3')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-8">
          <h2 className="text-xl font-bold text-[#FAFAFA] mb-6">{t('billing.pricing.faq.title')}</h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-[#FAFAFA] mb-2">
                {t('billing.pricing.faq.activationTitle')}
              </h3>
              <p className="text-[#A0A0A0] text-sm">
                {t('billing.pricing.faq.activationAnswer')}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#FAFAFA] mb-2">
                {t('billing.pricing.faq.whenStartTitle')}
              </h3>
              <p className="text-[#A0A0A0] text-sm">
                {t('billing.pricing.faq.whenStartAnswer')}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#FAFAFA] mb-2">
                {t('billing.pricing.faq.changePlansTitle')}
              </h3>
              <p className="text-[#A0A0A0] text-sm">
                {t('billing.pricing.faq.changePlansAnswer')}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#FAFAFA] mb-2">
                {t('billing.pricing.faq.paymentTitle')}
              </h3>
              <p className="text-[#A0A0A0] text-sm">
                {t('billing.pricing.faq.paymentAnswer')}
              </p>
            </div>
          </div>
        </div>

        {/* CTA for non-logged in users */}
        {!user && (
          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/signup')}
              className="bg-white text-black px-8 py-4 rounded-lg font-semibold hover:bg-[#E0E0E0] transition-colors text-lg"
            >
              {t('billing.pricing.getStartedButton')}
            </button>
            <p className="text-[#666666] mt-4">
              {t('billing.pricing.haveAccount')}{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-[#FAFAFA] hover:underline"
              >
                {t('billing.pricing.signInLink')}
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && selectedPlan && billing && (
        <UpgradeModal
          currentPlan={billing.plan!}
          newPlan={selectedPlan}
          onConfirm={handleConfirmPlanChange}
          onCancel={() => {
            setShowUpgradeModal(false);
            setSelectedPlan(null);
          }}
          isLoading={isChangingPlan}
        />
      )}
    </div>
  );
};

export default PricingPage;
