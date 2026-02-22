// ============================================================================
// PLAN CARD COMPONENT
// Reusable card displaying plan details with selection CTA
// ============================================================================

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Star, ArrowUp, ArrowDown } from 'lucide-react';
import type { BillingPlan, PlanTier } from '../stripeTypes';
import { getPlanDisplayInfo } from '../stripeService';

export interface PlanCardProps {
  plan: BillingPlan;
  isCurrentPlan: boolean;
  isRecommended?: boolean;
  onSelect: (tier: PlanTier) => void;
  disabled?: boolean;
  currentPlanTier?: PlanTier;
  showFirstSaleNote?: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isCurrentPlan,
  isRecommended = false,
  onSelect,
  disabled = false,
  currentPlanTier,
  showFirstSaleNote = false,
}) => {
  const { t } = useTranslation();
  const displayInfo = getPlanDisplayInfo(plan);

  // Determine if this is an upgrade or downgrade from current plan
  const isUpgrade = currentPlanTier
    ? plan.price_monthly_cents > (currentPlanTier === 'starter' ? 0 : currentPlanTier === 'pro' ? 3000 : 9900)
    : false;
  const isDowngrade = currentPlanTier
    ? plan.price_monthly_cents < (currentPlanTier === 'starter' ? 0 : currentPlanTier === 'pro' ? 3000 : 9900)
    : false;

  // CTA button text
  const getButtonText = () => {
    if (isCurrentPlan) return t('billing.plans.button.current');
    if (isUpgrade) return t('billing.plans.button.upgrade');
    if (isDowngrade) return t('billing.plans.button.downgrade');
    return t('billing.plans.button.getStarted');
  };

  // CTA button icon
  const ButtonIcon = isUpgrade ? ArrowUp : isDowngrade ? ArrowDown : null;

  return (
    <div
      className={`
        relative bg-white rounded-xl border-2 p-6 flex flex-col transition-all
        ${isRecommended ? 'border-indigo-500 shadow-lg scale-105 z-10' : 'border-slate-200 shadow-sm'}
        ${isCurrentPlan ? 'ring-2 ring-indigo-200' : ''}
      `}
    >
      {/* Recommended Badge */}
      {isRecommended && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
          <Star size={14} className="fill-current" />
          {t('billing.plans.badgeMostPopular')}
        </div>
      )}

      {/* Plan Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
        <p className="text-slate-500 text-sm">{plan.description || t(`billing.plans.${plan.tier}.description`)}</p>
      </div>

      {/* Pricing */}
      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-slate-900">
            {plan.price_monthly_cents === 0 ? t('billing.plans.freeLabel') : `${plan.price_monthly_cents / 100}`}
          </span>
          {plan.price_monthly_cents > 0 && (
            <span className="text-slate-500 text-lg">{t('billing.plans.monthlySuffix')}</span>
          )}
        </div>
        <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full">
          <span className="text-sm font-medium text-slate-700">
            {t('billing.plans.platformFeeLabel', { fee: plan.platform_fee_percent })}
          </span>
        </div>
        {showFirstSaleNote && plan.tier !== 'starter' && (
          <p className="text-xs text-slate-500 mt-2">
            {t('billing.plans.firstSaleNote')}
          </p>
        )}
      </div>

      {/* Break-even Info */}
      {displayInfo.breakEvenRevenue && (
        <div className="text-center mb-4 px-3 py-2 bg-indigo-50 rounded-lg">
          <p className="text-xs text-indigo-700">
            {t('billing.plans.breakEvenInfo', { amount: displayInfo.breakEvenRevenue.replace('€', '') })}
          </p>
        </div>
      )}

      {/* Features List */}
      <ul className="space-y-3 mb-8 flex-1">
        {displayInfo.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check
              size={18}
              className={`shrink-0 mt-0.5 ${isRecommended ? 'text-indigo-600' : 'text-green-500'}`}
            />
            <span className="text-sm text-slate-700">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={() => onSelect(plan.tier)}
        disabled={disabled || isCurrentPlan}
        className={`
          w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
          ${
            isCurrentPlan
              ? 'bg-slate-100 text-slate-500 cursor-default'
              : isRecommended
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300'
              : 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300'
          }
          disabled:cursor-not-allowed
        `}
      >
        {ButtonIcon && <ButtonIcon size={18} />}
        {getButtonText()}
      </button>
    </div>
  );
};

export default PlanCard;
