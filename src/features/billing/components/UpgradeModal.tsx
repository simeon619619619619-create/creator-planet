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
  hasFirstSale: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  currentPlan,
  newPlan,
  hasFirstSale,
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
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {isUpgrade ? t('billing.upgradeModal.titleUpgrade') : t('billing.upgradeModal.titleChange')}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Plan Comparison */}
          <div className="flex items-center gap-4 mb-6">
            {/* Current Plan */}
            <div className="flex-1 p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-sm text-slate-500 mb-1">{t('billing.upgradeModal.currentPlanLabel')}</p>
              <p className="font-semibold text-slate-900">{currentInfo.name}</p>
              <p className="text-sm text-slate-600">{currentInfo.priceMonthly}{t('billing.upgradeModal.priceSuffix')}</p>
              <p className="text-xs text-slate-500">{t('billing.upgradeModal.feeLabel', { fee: currentInfo.platformFee })}</p>
            </div>

            {/* Arrow */}
            <ArrowRight size={24} className="text-slate-400 shrink-0" />

            {/* New Plan */}
            <div className="flex-1 p-4 bg-indigo-50 rounded-lg text-center border-2 border-indigo-200">
              <p className="text-sm text-indigo-600 mb-1">{t('billing.upgradeModal.newPlanLabel')}</p>
              <p className="font-semibold text-slate-900">{newInfo.name}</p>
              <p className="text-sm text-slate-600">{newInfo.priceMonthly}{t('billing.upgradeModal.priceSuffix')}</p>
              <p className="text-xs text-indigo-600">{t('billing.upgradeModal.feeLabel', { fee: newInfo.platformFee })}</p>
            </div>
          </div>

          {/* What Changes */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-3">{t('billing.upgradeModal.whatChanges.title')}</h3>
            <ul className="space-y-2">
              {isUpgrade && (
                <>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                    <span className="text-slate-600">
                      {t('billing.upgradeModal.whatChanges.feeDecrease', { current: currentInfo.platformFee, new: newInfo.platformFee })}
                      {feeDiff > 0 && ` ${t('billing.upgradeModal.whatChanges.feeSavings', { savings: feeDiff.toFixed(1) })}`}
                    </span>
                  </li>
                  {newInfo.features
                    .filter((f) => !currentInfo.features.includes(f))
                    .map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                        <span className="text-slate-600">{t('billing.upgradeModal.whatChanges.unlockFeature', { feature })}</span>
                      </li>
                    ))}
                </>
              )}
              {isDowngrade && (
                <>
                  <li className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-slate-600">
                      {t('billing.upgradeModal.whatChanges.feeIncrease', { current: currentInfo.platformFee, new: newInfo.platformFee })}
                    </span>
                  </li>
                  {currentInfo.features
                    .filter((f) => !newInfo.features.includes(f))
                    .map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-slate-600">{t('billing.upgradeModal.whatChanges.loseFeature', { feature })}</span>
                      </li>
                    ))}
                </>
              )}
            </ul>
          </div>

          {/* Billing Info */}
          <div className="p-4 bg-slate-50 rounded-lg mb-6">
            <h3 className="font-semibold text-slate-900 mb-2">{t('billing.upgradeModal.billingDetails.title')}</h3>
            {isUpgrade ? (
              <div className="space-y-2 text-sm text-slate-600">
                {hasFirstSale ? (
                  <>
                    <p>{t('billing.upgradeModal.billingDetails.upgradeImmediate')}</p>
                    <p>
                      {t('billing.upgradeModal.billingDetails.upgradeProrated', { amount: (priceDiff / 100).toFixed(2) })}
                    </p>
                  </>
                ) : (
                  <>
                    <p>{t('billing.upgradeModal.billingDetails.upgradeImmediate')}</p>
                    <p className="text-indigo-600 font-medium">
                      {t('billing.upgradeModal.billingDetails.firstSaleNotMade', { amount: (newPlan.price_monthly_cents / 100).toFixed(0) })}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-sm text-slate-600">
                <p>{t('billing.upgradeModal.billingDetails.downgradePeriodEnd')}</p>
                <p>{t('billing.upgradeModal.billingDetails.downgradeAccessContinues')}</p>
              </div>
            )}
          </div>

          {/* Downgrade Warning */}
          {isDowngrade && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">{t('billing.upgradeModal.downgradeWarning.title')}</p>
                  <p className="text-sm text-amber-700 mt-1">
                    {t('billing.upgradeModal.downgradeWarning.message', { planName: newInfo.name })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 px-4 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('billing.upgradeModal.cancelButton')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              flex-1 py-3 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2
              ${
                isUpgrade
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }
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
