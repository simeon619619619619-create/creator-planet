// =============================================================================
// PackageCard Component
// Displays a DWY package with features and apply button
// =============================================================================

import { useTranslation } from 'react-i18next';
import type { DwyPackage } from '../dwyTypes';

interface PackageCardProps {
  package: DwyPackage;
  hasApplication: boolean;
  onApply: () => void;
}

export function PackageCard({ package: pkg, hasApplication, onApply }: PackageCardProps) {
  const { t } = useTranslation();
  const isGrowthPartner = pkg.tier === 'growth_partner';

  return (
    <div
      className={`relative rounded-2xl border-2 p-8 transition-shadow  ${
        isGrowthPartner
          ? 'border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section,#0A0A0A)]'
          : 'border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section,#0A0A0A)]'
      }`}
    >
      {/* Highlight badge */}
      {pkg.highlight_text && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] text-sm font-medium px-4 py-1 rounded-full">
            {pkg.highlight_text}
          </span>
        </div>
      )}

      {/* Package header */}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-[var(--fc-section-text,#FAFAFA)] mb-2">{pkg.name}</h3>
        <p className="text-[var(--fc-section-muted,#A0A0A0)]">{pkg.tagline}</p>
      </div>

      {/* Price display */}
      {pkg.price_display && (
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-[var(--fc-section-text,#FAFAFA)]">{pkg.price_display}</div>
          {pkg.price_note && (
            <p className="text-sm text-[var(--fc-section-muted,#666666)] mt-1">{pkg.price_note}</p>
          )}
        </div>
      )}

      {/* Description */}
      {pkg.description && (
        <p className="text-[var(--fc-section-muted,#A0A0A0)] text-center mb-8">{pkg.description}</p>
      )}

      {/* Features list */}
      <div className="space-y-4 mb-8">
        {pkg.features.map((feature, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#22C55E]/10 flex items-center justify-center mt-0.5">
              <svg
                className="w-3 h-3 text-[#22C55E]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <div className="font-medium text-[var(--fc-section-text,#FAFAFA)]">{feature.title}</div>
              <div className="text-sm text-[var(--fc-section-muted,#666666)]">{feature.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Slots indicator */}
      {pkg.slots_available !== null && pkg.slots_available <= 5 && (
        <div className="text-center mb-4">
          <span className="text-sm text-[#EAB308] font-medium">
            {pkg.slots_available === 0
              ? t('dwyPackages.packageCard.slotsFullWaitlist')
              : t(pkg.slots_available === 1 ? 'dwyPackages.packageCard.slotsAvailable' : 'dwyPackages.packageCard.slotsAvailablePlural', { count: pkg.slots_available })}
          </span>
        </div>
      )}

      {/* Apply button */}
      <button
        onClick={onApply}
        disabled={hasApplication || pkg.slots_available === 0}
        className={`w-full py-3 rounded-lg font-semibold transition-colors ${
          hasApplication
            ? 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#666666)] cursor-not-allowed'
            : pkg.slots_available === 0
              ? 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#666666)] cursor-not-allowed'
              : isGrowthPartner
                ? 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] hover:bg-[#E0E0E0]'
                : 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] hover:bg-[#E0E0E0]'
        }`}
      >
        {hasApplication
          ? t('dwyPackages.packageCard.applicationSubmitted')
          : pkg.slots_available === 0
            ? t('dwyPackages.packageCard.joinWaitlist')
            : t('dwyPackages.packageCard.applyNow')}
      </button>
    </div>
  );
}

export default PackageCard;
