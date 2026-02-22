// ============================================================================
// BILLING FEATURE - Public Exports
// ============================================================================

// Types
export type {
  PlanTier,
  BillingStatus,
  TransactionType,
  TransactionStatus,
  ProductType,
  PlanFeatures,
  BillingPlan,
  CreatorBilling,
  BillingTransaction,
  CreatorSale,
  WebhookEvent,
  HandledWebhookEvent,
  ActivationCheckoutParams,
  SubscriptionCheckoutParams,
  SaleCheckoutParams,
  ConnectAccountStatus,
  CheckoutResult,
  SubscriptionResult,
  PlanChangeResult,
  ConnectOnboardingResult,
  PaymentIntentResult,
  FeeCalculation,
  PlanDisplayInfo,
  BillingDashboardData,
  UpgradeReason,
  UpgradePromptInfo,
  StripeClient,
} from './stripeTypes';

// Constants
export {
  STRIPE_CONFIG,
  PLAN_LIMITS,
  UPGRADE_MESSAGES,
} from './stripeTypes';

// Service functions
export {
  // Stripe initialization
  initStripe,
  getStripe,

  // Plan operations
  getPlans,
  getPlanByTier,
  getPlanDisplayInfo,
  getPlansWithDisplayInfo,

  // Creator billing operations
  getCreatorBilling,
  isActivationPaid,
  getBillingDashboard,

  // Checkout & payment operations
  createActivationCheckout,
  createPlanSubscription,

  // Plan change operations
  changePlan,
  cancelSubscription,
  resumeSubscription,
  getBillingPortalUrl,

  // Platform fee calculations
  calculatePlatformFee,
  calculatePlatformFeeSync,

  // Stripe Connect operations
  createConnectAccount,
  getConnectOnboardingLink,
  getConnectAccountStatus,

  // Sale processing
  createSalePaymentIntent,

  // First sale trigger
  handleFirstSale,
  activateMonthlyFee,

  // Transaction history
  getTransactions,
  getSales,
  getRevenueAnalytics,

  // Webhook processing
  processWebhookEvent,
  webhookHandlers,

  // Utility functions
  formatAmount,
  getRecommendedPlan,
  calculateBreakEven,
  isPlanFeatureAvailable,
  getPlanLimit,
} from './stripeService';

// ============================================================================
// HOOKS
// ============================================================================

// Plan limits hook
export {
  usePlanLimits,
  getUpgradeMessage,
  getRecommendedPlanForUpgrade,
} from './hooks/usePlanLimits';
export type { PlanLimitsHook } from './hooks/usePlanLimits';

// Limit check hooks
export {
  useStudentLimitCheck,
  useCourseLimitCheck,
  useCommunityLimitCheck,
  useFeatureCheck,
} from './hooks/useLimitCheck';
export type { LimitCheckResult } from './hooks/useLimitCheck';

// ============================================================================
// COMPONENTS
// ============================================================================

// Upgrade prompt modal
export { UpgradePrompt } from './components/UpgradePrompt';
export type { UpgradePromptProps } from './components/UpgradePrompt';

// Plan gate wrapper
export { PlanGate } from './components/PlanGate';
export type { PlanGateProps } from './components/PlanGate';

// Plan card
export { default as PlanCard } from './components/PlanCard';
export type { PlanCardProps } from './components/PlanCard';

// Upgrade modal (for plan changes)
export { default as UpgradeModal } from './components/UpgradeModal';
export type { UpgradeModalProps } from './components/UpgradeModal';

// ============================================================================
// PAGES
// ============================================================================

// Public pricing page
export { default as PricingPage } from './pages/PricingPage';

// Billing settings page (for Settings tab)
export { default as BillingSettingsPage } from './pages/BillingSettingsPage';

// Creator onboarding page (activation fee)
export { default as OnboardingPage } from './pages/OnboardingPage';
