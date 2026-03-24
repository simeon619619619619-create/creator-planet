// ============================================================================
// UPGRADE MODAL COMPONENT
// Modal for confirming plan upgrade/downgrade with comparison
// ============================================================================

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, ArrowRight, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import type { BillingPlan } from '../stripeTypes';
import { getPlanDisplayInfo, formatAmount } from '../stripeService';

export interface UpgradeModalProps {
  currentPlan: BillingPlan;
  newPlan: BillingPlan;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  currentPlan,
  newPlan,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const currentInfo = getPlanDisplayInfo(currentPlan);
  const newInfo = getPlanDisplayInfo(newPlan);

  const isUpgrade = newPlan.price_monthly_cents > currentPlan.price_monthly_cents;
  const isDowngrade = newPlan.price_monthly_cents < currentPlan.price_monthly_cents;

  // Calculate savings or additional cost
  const priceDiff = Math.abs(newPlan.price_monthly_cents - currentPlan.price_monthly_cents);
  const feeDiff = currentPlan.platform_fee_percent - newPlan.platform_fee_percent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--fc-section-border,#1F1F1F)]">
          <h2 className="text-xl font-bold text-[var(--fc-section-text,#FAFAFA)]">
            {isUpgrade ? t('billing.upgradeModal.titleUpgrade') : t('billing.upgradeModal.titleChange')}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Plan Comparison */}
          <div className="flex items-center gap-4 mb-6">
            {/* Current Plan */}
            <div className="flex-1 p-4 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-center">
              <p className="text-sm text-[var(--fc-section-muted,#666666)] mb-1">{t('billing.upgradeModal.currentPlanLabel')}</p>
              <p className="font-semibold text-[var(--fc-section-text,#FAFAFA)]">{currentInfo.name}</p>
              <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">{currentInfo.priceMonthly}{t('billing.upgradeModal.priceSuffix')}</p>
              <p className="text-xs text-[var(--fc-section-muted,#666666)]">{t('billing.upgradeModal.feeLabel', { fee: currentInfo.platformFee })}</p>
            </div>

            {/* Arrow */}
            <ArrowRight size={24} className="text-[var(--fc-section-muted,#666666)] shrink-0" />

            {/* New Plan */}
            <div className="flex-1 p-4 bg-[var(--fc-section-hover,#151515)] rounded-lg text-center border border-[#333333]">
              <p className="text-sm text-[var(--fc-section-text,#FAFAFA)] mb-1">{t('billing.upgradeModal.newPlanLabel')}</p>
              <p className="font-semibold text-[var(--fc-section-text,#FAFAFA)]">{newInfo.name}</p>
              <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">{newInfo.priceMonthly}{t('billing.upgradeModal.priceSuffix')}</p>
              <p className="text-xs text-[var(--fc-section-text,#FAFAFA)]">{t('billing.upgradeModal.feeLabel', { fee: newInfo.platformFee })}</p>
            </div>
          </div>

          {/* What Changes */}
          <div className="mb-6">
            <h3 className="font-semibold text-[var(--fc-section-text,#FAFAFA)] mb-3">{t('billing.upgradeModal.whatChanges.title')}</h3>
            <ul className="space-y-2">
              {isUpgrade && (
                <>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle size={16} className="text-[#22C55E] shrink-0 mt-0.5" />
                    <span className="text-[var(--fc-section-muted,#A0A0A0)]">
                      {t('billing.upgradeModal.whatChanges.feeDecrease', { current: currentInfo.platformFee, new: newInfo.platformFee })}
                      {feeDiff > 0 && ` ${t('billing.upgradeModal.whatChanges.feeSavings', { savings: feeDiff.toFixed(1) })}`}
                    </span>
                  </li>
                  {newInfo.features
                    .filter((f) => !currentInfo.features.includes(f))
                    .map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle size={16} className="text-[#22C55E] shrink-0 mt-0.5" />
                        <span className="text-[var(--fc-section-muted,#A0A0A0)]">{t('billing.upgradeModal.whatChanges.unlockFeature', { feature })}</span>
                      </li>
                    ))}
                </>
              )}
              {isDowngrade && (
                <>
                  <li className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={16} className="text-[#EAB308] shrink-0 mt-0.5" />
                    <span className="text-[var(--fc-section-muted,#A0A0A0)]">
                      {t('billing.upgradeModal.whatChanges.feeIncrease', { current: currentInfo.platformFee, new: newInfo.platformFee })}
                    </span>
                  </li>
                  {currentInfo.features
                    .filter((f) => !newInfo.features.includes(f))
                    .map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle size={16} className="text-[#EAB308] shrink-0 mt-0.5" />
                        <span className="text-[var(--fc-section-muted,#A0A0A0)]">{t('billing.upgradeModal.whatChanges.loseFeature', { feature })}</span>
                      </li>
                    ))}
                </>
              )}
            </ul>
          </div>

          {/* Billing Info */}
          <div className="p-4 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg mb-6">
            <h3 className="font-semibold text-[var(--fc-section-text,#FAFAFA)] mb-2">{t('billing.upgradeModal.billingDetails.title')}</h3>
            {isUpgrade ? (
              <div className="space-y-2 text-sm text-[var(--fc-section-muted,#A0A0A0)]">
                <p>{t('billing.upgradeModal.billingDetails.upgradeImmediate')}</p>
                <p>
                  {t('billing.upgradeModal.billingDetails.upgradeProrated', { amount: (priceDiff / 100).toFixed(2) })}
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-[var(--fc-section-muted,#A0A0A0)]">
                <p>{t('billing.upgradeModal.billingDetails.downgradePeriodEnd')}</p>
                <p>{t('billing.upgradeModal.billingDetails.downgradeAccessContinues')}</p>
              </div>
            )}
          </div>

          {/* Downgrade Warning */}
          {isDowngrade && (
            <div className="p-4 bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-[#EAB308] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[var(--fc-section-text,#FAFAFA)]">{t('billing.upgradeModal.downgradeWarning.title')}</p>
                  <p className="text-sm text-[#EAB308] mt-1">
                    {t('billing.upgradeModal.downgradeWarning.message', { planName: newInfo.name })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-[var(--fc-section-border,#1F1F1F)]">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 px-4 border border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-text,#FAFAFA)] font-medium rounded-lg hover:bg-[var(--fc-section-hover,#151515)] hover:border-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('billing.upgradeModal.cancelButton')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              flex-1 py-3 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2
              ${'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] hover:bg-[var(--fc-button-hover,#E0E0E0)]'}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('billing.upgradeModal.processing')}
              </>
            ) : (
              <>{isUpgrade ? t('billing.upgradeModal.confirmUpgrade') : t('billing.upgradeModal.confirmDowngrade')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
