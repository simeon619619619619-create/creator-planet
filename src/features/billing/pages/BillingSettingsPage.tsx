// ============================================================================
// BILLING SETTINGS PAGE
// Creator billing management - shows plan, usage, transactions
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  CreditCard,
  ArrowUpRight,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Receipt,
  ExternalLink,
  AlertTriangle,
  XCircle,
  Wallet,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../../core/contexts/AuthContext';
import UpgradeModal from '../components/UpgradeModal';
import type {
  BillingPlan,
  BillingDashboardData,
  CreatorSale,
  PlanTier,
  ConnectAccountStatus,
} from '../stripeTypes';
import {
  getBillingDashboard,
  getPlans,
  getPlanByTier,
  getBillingPortalUrl,
  changePlan,
  cancelSubscription,
  resumeSubscription,
  formatAmount,
  getSales,
  createConnectAccount,
  getConnectOnboardingLink,
  getConnectAccountStatus,
  createPlanSubscription,
} from '../stripeService';

const BillingSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // State
  const [dashboard, setDashboard] = useState<BillingDashboardData | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [sales, setSales] = useState<CreatorSale[]>([]);
  const [connectStatus, setConnectStatus] = useState<ConnectAccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnectLoading, setIsConnectLoading] = useState(false);

  // Load billing data
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;

      setIsLoading(true);
      setError(null);

      try {
        const [dashboardData, plansData, salesData, connectData] = await Promise.all([
          getBillingDashboard(profile.id),
          getPlans(),
          getSales(profile.id, { limit: 20 }),
          getConnectAccountStatus(profile.id),
        ]);

        setDashboard(dashboardData);
        setPlans(plansData);
        setSales(salesData);
        setConnectStatus(connectData);
      } catch (err) {
        console.error('Error loading billing data:', err);
        const errMsg = err instanceof Error ? err.message : '';
        // Don't show raw Edge Function errors - show user-friendly message
        if (!errMsg.includes('non-2xx') && !errMsg.includes('Edge Function')) {
          setError(t('billing.settings.loadError', 'Грешка при зареждане на информацията за фактуриране.'));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [profile?.id]);

  // Handle opening Stripe billing portal
  const handleOpenBillingPortal = async () => {
    if (!profile?.id) return;

    setIsProcessing(true);
    try {
      const url = await getBillingPortalUrl(profile.id);
      if (url) {
        window.open(url, '_blank');
      } else {
        setError('Could not open billing portal');
      }
    } catch (err) {
      setError('Failed to open billing portal');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle plan change
  const handlePlanChange = async (tier: PlanTier) => {
    const plan = plans.find((p) => p.tier === tier);
    if (!plan) return;

    // Don't show modal if selecting the same plan
    if (tier === dashboard?.currentPlan?.tier) return;

    setSelectedPlan(plan);
    setShowUpgradeModal(true);
  };

  // Handle starting subscription for current plan (for trial users wanting to pay early)
  const handleStartCurrentSubscription = async () => {
    if (!profile?.id || !dashboard?.currentPlan) return;

    setIsProcessing(true);
    try {
      const checkoutResult = await createPlanSubscription(profile.id, dashboard.currentPlan.tier);
      if (checkoutResult.success && checkoutResult.checkoutUrl) {
        window.location.href = checkoutResult.checkoutUrl;
        return;
      } else {
        setError(checkoutResult.error || 'Failed to create checkout session');
      }
    } catch (err) {
      setError('An error occurred while starting your subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm plan change
  const handleConfirmPlanChange = async () => {
    if (!selectedPlan || !profile?.id) return;

    setIsProcessing(true);
    try {
      const result = await changePlan(profile.id, selectedPlan.tier);

      if (result.success) {
        // Check if subscription checkout is required (has first sale but no active subscription yet)
        if (result.requiresCheckout) {
          // Create subscription checkout session and redirect
          const checkoutResult = await createPlanSubscription(profile.id, selectedPlan.tier);
          if (checkoutResult.success && checkoutResult.checkoutUrl) {
            window.location.href = checkoutResult.checkoutUrl;
            return;
          } else {
            setError(checkoutResult.error || 'Failed to create checkout session');
            setIsProcessing(false);
            return;
          }
        }

        // Optimistic UI update - immediately show the new plan
        // This avoids waiting for webhook processing
        if (dashboard) {
          setDashboard({
            ...dashboard,
            currentPlan: selectedPlan,
          });
        }
        setShowUpgradeModal(false);
        setSelectedPlan(null);
        setIsProcessing(false);

        // Background sync - fetch actual data after a delay to confirm
        setTimeout(async () => {
          try {
            const dashboardData = await getBillingDashboard(profile.id);
            if (dashboardData) {
              setDashboard(dashboardData);
            }
          } catch {
            // Silently fail background sync - optimistic update already shown
          }
        }, 2000);
        return; // Exit early since we handled setIsProcessing above
      } else {
        setError(result.error || 'Failed to change plan');
      }
    } catch (err) {
      setError('An error occurred while changing your plan');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle cancel subscription
  const handleCancelSubscription = async () => {
    if (!profile?.id) return;

    setIsProcessing(true);
    try {
      const result = await cancelSubscription(profile.id);

      if (result.success) {
        // Optimistic UI update - immediately show cancellation
        if (dashboard?.billing) {
          setDashboard({
            ...dashboard,
            billing: {
              ...dashboard.billing,
              cancel_at_period_end: true,
            },
          });
        }
        setShowCancelModal(false);
        setIsProcessing(false);

        // Background sync
        setTimeout(async () => {
          try {
            const dashboardData = await getBillingDashboard(profile.id);
            if (dashboardData) setDashboard(dashboardData);
          } catch { /* Silently fail */ }
        }, 2000);
        return;
      } else {
        setError(result.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      setError('An error occurred while canceling your subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle resume subscription
  const handleResumeSubscription = async () => {
    if (!profile?.id) return;

    setIsProcessing(true);
    try {
      const result = await resumeSubscription(profile.id);

      if (result.success) {
        // Optimistic UI update - immediately show resumed state
        if (dashboard?.billing) {
          setDashboard({
            ...dashboard,
            billing: {
              ...dashboard.billing,
              cancel_at_period_end: false,
            },
          });
        }
        setIsProcessing(false);

        // Background sync
        setTimeout(async () => {
          try {
            const dashboardData = await getBillingDashboard(profile.id);
            if (dashboardData) setDashboard(dashboardData);
          } catch { /* Silently fail */ }
        }, 2000);
        return;
      } else {
        setError(result.error || 'Failed to resume subscription');
      }
    } catch (err) {
      setError('An error occurred while resuming your subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle setting up Stripe Connect for payouts
  const handleSetupPayouts = async () => {
    if (!profile?.id || !profile?.email) return;

    setIsConnectLoading(true);
    setError(null);

    try {
      // First, create the Connect account if it doesn't exist
      if (!connectStatus) {
        const createResult = await createConnectAccount(profile.id, profile.email);
        if (!createResult.success) {
          setError(t('billing.settings.payoutsSetupError', 'Настройката на изплащанията не е налична в момента. Моля, опитайте по-късно.'));
          return;
        }
      }

      // Get the onboarding link
      const onboardingUrl = await getConnectOnboardingLink(profile.id);
      if (onboardingUrl) {
        window.location.href = onboardingUrl;
      } else {
        setError(t('billing.settings.payoutsSetupError', 'Настройката на изплащанията не е налична в момента. Моля, опитайте по-късно.'));
      }
    } catch (err) {
      console.error('Error setting up payouts:', err);
      setError(t('billing.settings.payoutsSetupError', 'Настройката на изплащанията не е налична в момента. Моля, опитайте по-късно.'));
    } finally {
      setIsConnectLoading(false);
    }
  };

  // Handle refreshing Connect account status
  const handleRefreshConnectStatus = async () => {
    if (!profile?.id) return;

    setIsConnectLoading(true);
    try {
      const status = await getConnectAccountStatus(profile.id);
      setConnectStatus(status);
    } catch (err) {
      console.error('Error refreshing connect status:', err);
    } finally {
      setIsConnectLoading(false);
    }
  };

  // Setup checklist logic
  const setupChecklist = (() => {
    if (!dashboard?.billing) return null;
    const items = [
      {
        key: 'activation',
        label: t('billing.settings.checklist.activationFee'),
        done: dashboard.billing.activation_fee_paid === true,
        action: () => navigate('/onboarding'),
        actionLabel: t('billing.settings.checklist.payActivation'),
      },
      {
        key: 'plan',
        label: t('billing.settings.checklist.choosePlan'),
        done: dashboard.billing.plan_id != null,
        action: () => navigate('/pricing'),
        actionLabel: t('billing.settings.checklist.selectPlan'),
      },
      {
        key: 'payout',
        label: t('billing.settings.checklist.connectPayout'),
        done: connectStatus?.status === 'active',
        action: handleSetupPayouts,
        actionLabel: t('billing.settings.checklist.connectAccount'),
      },
    ];
    const completedCount = items.filter((i) => i.done).length;
    if (completedCount === 3) return null;
    return { items, completedCount };
  })();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 size={32} className="text-[#FAFAFA] animate-spin mx-auto mb-4" />
          <p className="text-[#A0A0A0]">{t('billing.settings.loading')}</p>
        </div>
      </div>
    );
  }

  // No billing record at all - show onboarding prompt
  if (!dashboard || !dashboard.billing) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="text-[#EAB308] mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[#FAFAFA] mb-2">
          {t('billing.settings.errorNotSetup')}
        </h3>
        <p className="text-[#A0A0A0] mb-6">
          {t('billing.settings.errorIncompleteSetup')}
        </p>
        <button
          onClick={() => navigate('/onboarding')}
          className="bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-6 py-2 rounded-lg font-medium hover:bg-[#E0E0E0] transition-colors"
        >
          {t('billing.settings.completeSetupButton')}
        </button>
      </div>
    );
  }

  const { currentPlan, billing } = dashboard;
  const currentTier = currentPlan.tier;

  return (
    <div className="space-y-8">
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-[#EF4444] flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm underline mt-1"
            >
              {t('billing.settings.errorDismiss')}
            </button>
          </div>
        </div>
      )}

      {/* Setup Checklist */}
      {setupChecklist && (
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-6">
          <h2 className="text-lg font-semibold text-[#FAFAFA] mb-4">
            {t('billing.settings.checklist.title')}
          </h2>

          <div className="space-y-3 mb-6">
            {setupChecklist.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  {item.done ? (
                    <CheckCircle size={20} className="text-[#22C55E]" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[#666666]" />
                  )}
                  <span className={item.done ? 'text-[#A0A0A0]' : 'text-[#FAFAFA]'}>
                    {item.label}
                  </span>
                </div>
                {item.done ? (
                  <span className="text-sm text-[#22C55E]">{t('billing.settings.checklist.done')}</span>
                ) : (
                  <button
                    onClick={item.action}
                    className="flex items-center gap-1 text-sm font-medium text-[#FAFAFA] hover:text-white bg-[#1F1F1F] hover:bg-[#333333] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {item.actionLabel}
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[#A0A0A0]">
                {t('billing.settings.checklist.progress', { done: setupChecklist.completedCount, total: 3 })}
              </span>
            </div>
            <div className="h-2 bg-[#1F1F1F] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#22C55E] rounded-full transition-all duration-500"
                style={{ width: `${(setupChecklist.completedCount / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Section */}
      <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[#FAFAFA]">{t('billing.settings.sectionCurrentPlan')}</h2>
            <p className="text-[#666666] text-sm">
              {t('billing.settings.sectionSubtitle')}
            </p>
          </div>
          <button
            onClick={() => navigate('/pricing')}
            className="text-[#FAFAFA] hover:text-white text-sm font-medium flex items-center gap-1"
          >
            {t('billing.settings.viewAllPlansLink')}
            <ArrowUpRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 bg-[#0A0A0A] rounded-lg mb-6">
          <div className="w-12 h-12 bg-[#1F1F1F] rounded-lg flex items-center justify-center">
            <CreditCard size={24} className="text-[#FAFAFA]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[#FAFAFA]">{currentPlan.name}</h3>
              <StatusBadge status={billing.status} t={t} />
            </div>
            <p className="text-sm text-[#A0A0A0]">
              {currentPlan.price_monthly_cents === 0
                ? t('billing.settings.freePlanLabel')
                : `${formatAmount(currentPlan.price_monthly_cents)}/month`}{' '}
              {t('billing.settings.platformFeeLabel', { fee: currentPlan.platform_fee_percent })}
            </p>
          </div>
          {currentTier !== 'scale' && (
            <button
              onClick={() => handlePlanChange(currentTier === 'starter' ? 'pro' : 'scale')}
              className="bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E0E0E0] transition-colors"
            >
              {t('billing.settings.upgradeButton')}
            </button>
          )}
        </div>

        {/* Cancellation Notice */}
        {billing.cancel_at_period_end && (
          <div className="p-4 bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-[#EAB308] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#FAFAFA]">{t('billing.settings.cancellationNoticeTitle')}</p>
                <p className="text-sm text-[#EAB308] mt-1">
                  {t('billing.settings.cancellationNoticeMessage', {
                    date: billing.current_period_end
                      ? new Date(billing.current_period_end).toLocaleDateString()
                      : 'the end of your billing period'
                  })}
                </p>
                <button
                  onClick={handleResumeSubscription}
                  disabled={isProcessing}
                  className="mt-3 text-sm font-medium text-[#FAFAFA] underline hover:no-underline disabled:opacity-50"
                >
                  {t('billing.settings.resumeSubscriptionButton')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Billing Actions */}
        <div className="flex flex-wrap gap-3">
          {billing.stripe_customer_id && (
            <button
              onClick={handleOpenBillingPortal}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 border border-[#1F1F1F] rounded-lg text-sm font-medium text-[#A0A0A0] hover:bg-[#0A0A0A] transition-colors disabled:opacity-50"
            >
              <ExternalLink size={16} />
              {t('billing.settings.managePaymentButton')}
            </button>
          )}
          {currentTier !== 'starter' && !billing.cancel_at_period_end && billing.stripe_subscription_id && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 text-sm font-medium text-[#EF4444] hover:text-[#EF4444] transition-colors"
            >
              {t('billing.settings.cancelSubscriptionButton')}
            </button>
          )}
        </div>
      </div>

      {/* Payouts Section (Stripe Connect) */}
      <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[#FAFAFA]">{t('billing.settings.sectionPayouts')}</h2>
            <p className="text-[#666666] text-sm">
              {t('billing.settings.payoutsSubtitle')}
            </p>
          </div>
          {connectStatus && (
            <button
              onClick={handleRefreshConnectStatus}
              disabled={isConnectLoading}
              className="p-2 text-[#666666] hover:text-[#A0A0A0] hover:bg-[#151515] rounded-lg transition-colors disabled:opacity-50"
              title={t('billing.settings.refreshStatusTitle')}
            >
              <RefreshCw size={16} className={isConnectLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {!connectStatus ? (
          // No Connect account - show setup prompt
          <div className="p-6 bg-[#0A0A0A] rounded-lg border border-[#1F1F1F]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-lg flex items-center justify-center shrink-0">
                <Wallet size={24} className="text-[#FAFAFA]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[#FAFAFA] mb-1">{t('billing.settings.payoutsSetupTitle')}</h3>
                <p className="text-sm text-[#A0A0A0] mb-4">
                  {t('billing.settings.payoutsSetupMessage')}
                </p>
                <button
                  onClick={handleSetupPayouts}
                  disabled={isConnectLoading}
                  className="bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E0E0E0] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isConnectLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('billing.settings.settingUp')}
                    </>
                  ) : (
                    <>
                      {t('billing.settings.setupPayoutsButton')}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Has Connect account - show status
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-[#0A0A0A] rounded-lg">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-lg flex items-center justify-center">
                <Wallet size={24} className="text-[#FAFAFA]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[#FAFAFA]">{t('billing.settings.payoutAccountTitle')}</h3>
                  <ConnectStatusBadge status={connectStatus.status} t={t} />
                </div>
                <p className="text-sm text-[#A0A0A0]">
                  {connectStatus.status === 'active'
                    ? t('billing.settings.payoutAccountActive')
                    : connectStatus.status === 'pending'
                    ? t('billing.settings.payoutAccountPending')
                    : t('billing.settings.payoutAccountRestricted')}
                </p>
              </div>
              {connectStatus.status !== 'active' && (
                <button
                  onClick={handleSetupPayouts}
                  disabled={isConnectLoading}
                  className="bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E0E0E0] transition-colors disabled:opacity-50"
                >
                  {isConnectLoading ? t('billing.settings.loadingButton') : t('billing.settings.completeSetupButtonAlt')}
                </button>
              )}
            </div>

            {/* Status details */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 border border-[#1F1F1F] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {connectStatus.chargesEnabled ? (
                    <CheckCircle size={18} className="text-[#22C55E]" />
                  ) : (
                    <Clock size={18} className="text-[#EAB308]" />
                  )}
                  <span className="font-medium text-[#FAFAFA]">{t('billing.settings.payoutChargesEnabled')}</span>
                </div>
                <p className="text-sm text-[#A0A0A0]">
                  {connectStatus.chargesEnabled
                    ? t('billing.settings.payoutChargesReady')
                    : t('billing.settings.payoutChargesPending')}
                </p>
              </div>

              <div className="p-4 border border-[#1F1F1F] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {connectStatus.payoutsEnabled ? (
                    <CheckCircle size={18} className="text-[#22C55E]" />
                  ) : (
                    <Clock size={18} className="text-[#EAB308]" />
                  )}
                  <span className="font-medium text-[#FAFAFA]">{t('billing.settings.payoutPayoutsEnabled')}</span>
                </div>
                <p className="text-sm text-[#A0A0A0]">
                  {connectStatus.payoutsEnabled
                    ? t('billing.settings.payoutPayoutsReady')
                    : t('billing.settings.payoutPayoutsPending')}
                </p>
              </div>

              <div className="p-4 border border-[#1F1F1F] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {connectStatus.detailsSubmitted ? (
                    <CheckCircle size={18} className="text-[#22C55E]" />
                  ) : (
                    <Clock size={18} className="text-[#EAB308]" />
                  )}
                  <span className="font-medium text-[#FAFAFA]">{t('billing.settings.payoutIdentityVerified')}</span>
                </div>
                <p className="text-sm text-[#A0A0A0]">
                  {connectStatus.detailsSubmitted
                    ? t('billing.settings.payoutIdentityVerifiedComplete')
                    : t('billing.settings.payoutIdentityPending')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Revenue Overview */}
      <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-6">
        <h2 className="text-lg font-semibold text-[#FAFAFA] mb-6">{t('billing.settings.sectionRevenue')}</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-4 bg-[#0A0A0A] rounded-lg">
            <div className="flex items-center gap-2 text-[#666666] text-sm mb-2">
              <TrendingUp size={16} />
              {t('billing.settings.revenueThisMonth')}
            </div>
            <p className="text-2xl font-bold text-[#FAFAFA]">
              {formatAmount(dashboard.currentPeriodRevenue)}
            </p>
            <p className="text-sm text-[#666666] mt-1">
              {t('billing.settings.revenueFeesLabel', { amount: formatAmount(dashboard.platformFeesThisPeriod) })}
            </p>
          </div>

          <div className="p-4 bg-[#0A0A0A] rounded-lg">
            <div className="flex items-center gap-2 text-[#666666] text-sm mb-2">
              <Receipt size={16} />
              {t('billing.settings.revenueAllTime')}
            </div>
            <p className="text-2xl font-bold text-[#FAFAFA]">
              {formatAmount(dashboard.totalRevenue)}
            </p>
          </div>

          {dashboard.nextInvoiceDate && dashboard.nextInvoiceAmount && (
            <div className="p-4 bg-[#0A0A0A] rounded-lg">
              <div className="flex items-center gap-2 text-[#666666] text-sm mb-2">
                <Clock size={16} />
                {t('billing.settings.revenueNextInvoice')}
              </div>
              <p className="text-2xl font-bold text-[#FAFAFA]">
                {formatAmount(dashboard.nextInvoiceAmount)}
              </p>
              <p className="text-sm text-[#666666] mt-1">
                {t('billing.settings.revenueDueDate', { date: new Date(dashboard.nextInvoiceDate).toLocaleDateString() })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Community Sales */}
      <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#FAFAFA]">{t('billing.settings.sectionSales')}</h2>
          <p className="text-[#666666] text-sm">{t('billing.settings.salesSubtitle')}</p>
        </div>

        {sales.length === 0 ? (
          <p className="text-center text-[#666666] py-8">
            {t('billing.settings.noSales')}
          </p>
        ) : (
          <div className="divide-y divide-[#1F1F1F]">
            {sales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} t={t} />
            ))}
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && selectedPlan && (
        <UpgradeModal
          currentPlan={currentPlan}
          newPlan={selectedPlan}
          onConfirm={handleConfirmPlanChange}
          onCancel={() => {
            setShowUpgradeModal(false);
            setSelectedPlan(null);
          }}
          isLoading={isProcessing}
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <CancelModal
          planName={currentPlan.name}
          periodEnd={billing.current_period_end}
          onConfirm={handleCancelSubscription}
          onCancel={() => setShowCancelModal(false)}
          isLoading={isProcessing}
          t={t}
        />
      )}

    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface StatusBadgeProps {
  status: string;
  t: (key: string) => string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, t }) => {
  const config: Record<string, { bg: string; text: string; labelKey: string }> = {
    active: { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', labelKey: 'billing.settings.status.active' },
    trialing: { bg: 'bg-[#1F1F1F]', text: 'text-[#A0A0A0]', labelKey: 'billing.settings.status.trial' },
    past_due: { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', labelKey: 'billing.settings.status.pastDue' },
    canceled: { bg: 'bg-[#1F1F1F]', text: 'text-[#A0A0A0]', labelKey: 'billing.settings.status.canceled' },
    incomplete: { bg: 'bg-[#EAB308]/10', text: 'text-[#EAB308]', labelKey: 'billing.settings.status.incomplete' },
    paused: { bg: 'bg-[#1F1F1F]', text: 'text-[#A0A0A0]', labelKey: 'billing.settings.status.paused' },
  };

  const { bg, text, labelKey } = config[status] || config.incomplete;

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {t(labelKey)}
    </span>
  );
};

interface ConnectStatusBadgeProps {
  status: string;
  t: (key: string) => string;
}

const ConnectStatusBadge: React.FC<ConnectStatusBadgeProps> = ({ status, t }) => {
  const config: Record<string, { bg: string; text: string; labelKey: string }> = {
    active: { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', labelKey: 'billing.settings.connectStatus.active' },
    pending: { bg: 'bg-[#EAB308]/10', text: 'text-[#EAB308]', labelKey: 'billing.settings.connectStatus.pending' },
    restricted: { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', labelKey: 'billing.settings.connectStatus.restricted' },
    disabled: { bg: 'bg-[#1F1F1F]', text: 'text-[#A0A0A0]', labelKey: 'billing.settings.connectStatus.disabled' },
  };

  const { bg, text, labelKey } = config[status] || config.pending;

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {t(labelKey)}
    </span>
  );
};

interface SaleRowProps {
  sale: CreatorSale;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const SaleRow: React.FC<SaleRowProps> = ({ sale, t }) => {
  const typeLabels: Record<string, string> = {
    membership: t('billing.settings.saleTypes.membership'),
    membership_renewal: t('billing.settings.saleTypes.membership_renewal'),
    course: t('billing.settings.saleTypes.course'),
    product: t('billing.settings.saleTypes.product'),
  };

  const statusIcons: Record<string, React.ReactNode> = {
    completed: <CheckCircle size={16} className="text-[#22C55E]" />,
    pending: <Clock size={16} className="text-[#EAB308]" />,
    failed: <XCircle size={16} className="text-[#EF4444]" />,
    refunded: <AlertCircle size={16} className="text-[#666666]" />,
  };

  return (
    <div className="flex items-center gap-4 py-4">
      <div className="shrink-0">{statusIcons[sale.status] || statusIcons.pending}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[#FAFAFA]">
          {sale.product_name}
        </p>
        <p className="text-sm text-[#666666]">
          {typeLabels[sale.product_type] || sale.product_type}
          {' · '}
          {new Date(sale.created_at).toLocaleDateString()}
        </p>
      </div>
      <div className="text-right">
        <p className="font-medium text-[#22C55E]">
          +{formatAmount(sale.sale_amount_cents, sale.currency)}
        </p>
        <p className="text-xs text-[#666666]">
          {t('billing.settings.saleNet', { amount: formatAmount(sale.net_amount_cents, sale.currency) })}
        </p>
      </div>
    </div>
  );
};

interface CancelModalProps {
  planName: string;
  periodEnd: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  t: (key: string, options?: Record<string, string>) => string;
}

const CancelModal: React.FC<CancelModalProps> = ({
  planName,
  periodEnd,
  onConfirm,
  onCancel,
  isLoading,
  t,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#EF4444]/10 rounded-full flex items-center justify-center">
            <AlertTriangle size={20} className="text-[#EF4444]" />
          </div>
          <h2 className="text-lg font-semibold text-[#FAFAFA]">{t('billing.settings.cancelModal.title')}</h2>
        </div>

        <p className="text-[#A0A0A0] mb-4">
          {t('billing.settings.cancelModal.message', { planName })}
        </p>

        <ul className="space-y-2 mb-6 text-sm text-[#A0A0A0]">
          <li className="flex items-start gap-2">
            <span className="text-[#666666]">-</span>
            <span>
              {t('billing.settings.cancelModal.accessUntil', {
                date: periodEnd ? new Date(periodEnd).toLocaleDateString() : 'the end of your billing period'
              })}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#666666]">-</span>
            <span>{t('billing.settings.cancelModal.downgradeNotice')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#666666]">-</span>
            <span>{t('billing.settings.cancelModal.resubscribe')}</span>
          </li>
        </ul>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 border border-[#1F1F1F] text-[#FAFAFA] font-medium rounded-lg hover:bg-[#151515] hover:border-[#333333] transition-colors disabled:opacity-50"
          >
            {t('billing.settings.cancelModal.keepButton')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 bg-[#EF4444] text-white font-medium rounded-lg hover:bg-[#EF4444]/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('billing.settings.cancelModal.canceling')}
              </>
            ) : (
              t('billing.settings.cancelModal.confirmButton')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillingSettingsPage;
