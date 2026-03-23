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
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isCurrentPlan,
  isRecommended = false,
  onSelect,
  disabled = false,
  currentPlanTier,
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
        relative bg-[#0A0A0A] rounded-xl border p-6 flex flex-col transition-all
        ${isCurrentPlan ? 'border-[#333333]' : 'border-[#1F1F1F]'}
      `}
    >
      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-1 rounded-full text-sm font-medium">
          {t('billing.plans.button.current')}
        </div>
      )}

      {/* Recommended Badge */}
      {isRecommended && !isCurrentPlan && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
          <Star size={14} className="fill-current" />
          {t('billing.plans.badgeMostPopular')}
        </div>
      )}

      {/* Plan Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-[#FAFAFA] mb-1">{plan.name}</h3>
        <p className="text-[#666666] text-sm">{plan.description || t(`billing.plans.${plan.tier}.description`)}</p>
      </div>

      {/* Pricing */}
      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-bold text-[#FAFAFA]">
            {plan.price_monthly_cents === 0 ? t('billing.plans.freeLabel') : `${plan.price_monthly_cents / 100}`}
          </span>
          {plan.price_monthly_cents > 0 && (
            <span className="text-[#666666] text-lg">{t('billing.plans.monthlySuffix')}</span>
          )}
        </div>
        <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-[#1F1F1F] rounded-full">
          <span className="text-sm font-medium text-[#A0A0A0]">
            {t('billing.plans.platformFeeLabel', { fee: plan.platform_fee_percent })}
          </span>
        </div>
      </div>

      {/* Break-even Info */}
      {displayInfo.breakEvenRevenue && (
        <div className="text-center mb-4 px-3 py-2 bg-[#151515] rounded-lg border border-[#1F1F1F]">
          <p className="text-xs text-[#A0A0A0]">
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
              className="shrink-0 mt-0.5 text-[#A0A0A0]"
            />
            <span className="text-sm text-[#A0A0A0]">{feature}</span>
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
              ? 'bg-[#1F1F1F] text-[#666666] cursor-default'
              : 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] hover:bg-[#E0E0E0] disabled:opacity-50'
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
