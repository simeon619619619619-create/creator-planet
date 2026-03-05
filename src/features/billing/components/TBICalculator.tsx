// ============================================================================
// TBI CALCULATOR COMPONENT
// Displays available installment schemes and allows selection
// ============================================================================

import { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { TBICalculatorProps, TBIInstallmentScheme } from '../tbiTypes';
import { getInstallmentSchemes, formatInstallmentDisplay } from '../tbiService';

export function TBICalculator({
  amountCents,
  currency = 'EUR',
  onSchemeSelect,
  selectedSchemeId,
  className = '',
}: TBICalculatorProps) {
  const [schemes, setSchemes] = useState<TBIInstallmentScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSchemeId, setExpandedSchemeId] = useState<number | null>(null);

  // Fetch schemes on mount
  useEffect(() => {
    let mounted = true;

    const fetchSchemes = async () => {
      setLoading(true);
      setError(null);

      const result = await getInstallmentSchemes({ amountCents });

      if (!mounted) return;

      if (result.success && result.schemes) {
        // Sort by period (ascending)
        const sorted = result.schemes.sort((a, b) => a.period - b.period);
        setSchemes(sorted);
        
        // Auto-expand first scheme or selected scheme
        if (selectedSchemeId) {
          setExpandedSchemeId(selectedSchemeId);
        } else if (sorted.length > 0) {
          setExpandedSchemeId(sorted[0].scheme_id);
        }
      } else {
        setError(result.error || 'Failed to load installment options');
      }

      setLoading(false);
    };

    fetchSchemes();

    return () => { mounted = false; };
  }, [amountCents, selectedSchemeId]);

  const handleSchemeSelect = (scheme: TBIInstallmentScheme) => {
    onSchemeSelect?.(scheme);
  };

  const toggleExpand = (schemeId: number) => {
    setExpandedSchemeId(expandedSchemeId === schemeId ? null : schemeId);
  };

  if (loading) {
    return (
      <div className={`bg-[#0A0A0A] rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center gap-2 text-[#666666]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Зареждане на вноски...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-[#EF4444]/10 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-[#EF4444]">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (schemes.length === 0) {
    return (
      <div className={`bg-[#0A0A0A] rounded-lg p-4 ${className}`}>
        <p className="text-sm text-[#666666] text-center">
          Няма налични схеми за вноски за тази сума
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 text-[#A0A0A0]">
        <img
          src="https://cdn.tbibank.support/logo/tbi-bank.svg"
          alt="TBI Bank"
          className="h-5 w-auto"
        />
        <span className="font-medium">Възможности за изплащане</span>
      </div>

      {/* Total amount display */}
      <div className="bg-[#EAB308]/10 rounded-lg p-3 text-center">
        <span className="text-sm text-[#A0A0A0]">Обща сума: </span>
        <span className="font-semibold text-[#EAB308]">
          {(amountCents / 100).toFixed(2)} {currency}
        </span>
      </div>

      {/* Scheme list */}
      <div className="space-y-2">
        {schemes.map((scheme) => {
          const isSelected = selectedSchemeId === scheme.scheme_id;
          const isExpanded = expandedSchemeId === scheme.scheme_id;
          return (
            <div
              key={scheme.scheme_id}
              className={`
                border-2 rounded-lg transition-all duration-200 overflow-hidden
                ${isSelected 
                  ? 'border-orange-500 bg-[#EAB308]/10/50' 
                  : 'border-[#1F1F1F] hover:border-orange-300 bg-[#0A0A0A]'
                }
              `}
            >
              {/* Header row */}
              <button
                onClick={() => handleSchemeSelect(scheme)}
                className="w-full p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {/* Selection indicator */}
                  <div
                    className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center
                      ${isSelected 
                        ? 'border-orange-500 bg-[#EAB308]/100' 
                        : 'border-[#1F1F1F]'
                      }
                    `}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>

                  {/* Scheme info */}
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#FAFAFA]">
                        {scheme.period} вноски
                      </span>
                      {scheme.name && (
                        <span className="px-2 py-0.5 bg-[#1F1F1F] text-[#A0A0A0] text-xs font-medium rounded-full">
                          {scheme.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#A0A0A0]">
                      {formatInstallmentDisplay(scheme.period, scheme.monthly_amount_cents, currency)}
                    </p>
                  </div>
                </div>

                {/* Expand toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(scheme.scheme_id);
                  }}
                  className="p-1 hover:bg-[#1F1F1F] rounded-full transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#666666]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#666666]" />
                  )}
                </button>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0">
                  <div className="pl-8 space-y-2 text-sm">
                    {/* APR info */}
                    <div className="flex justify-between text-[#A0A0A0]">
                      <span>ГПР (годишен процент на разходите):</span>
                      <span className="font-medium">{scheme.apr}%</span>
                    </div>

                    {/* Interest rate (NIR) */}
                    <div className="flex justify-between text-[#A0A0A0]">
                      <span>Лихвен процент (ГЛП):</span>
                      <span className="font-medium">
                        {scheme.nir > 0 ? `${scheme.nir}%` : '0% (без лихва)'}
                      </span>
                    </div>

                    {/* Total amount */}
                    <div className="flex justify-between text-[#A0A0A0]">
                      <span>Обща дължима сума:</span>
                      <span className="font-medium">
                        {(scheme.total_amount_cents / 100).toFixed(2)} {currency}
                      </span>
                    </div>

                    {/* Monthly payment */}
                    <div className="flex justify-between text-[#EAB308] font-medium pt-2 border-t border-[#EAB308]/20">
                      <span>Месечна вноска:</span>
                      <span>
                        {(scheme.monthly_amount_cents / 100).toFixed(2)} {currency}
                      </span>
                    </div>

                    {/* Info note */}
                    <div className="flex items-start gap-1.5 text-xs text-[#666666] mt-2">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        Крайната сума се определя от TBI Bank след преглед на вашата кредитна история.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-[#666666] text-center">
        TBI Bank ще се свърже с вас за потвърждение на кандидатурата
      </p>
    </div>
  );
}
