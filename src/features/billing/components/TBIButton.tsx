// ============================================================================
// TBI BUTTON COMPONENT
// "Buy in Installments" button with TBI Bank styling
// ============================================================================
//
// This component renders the official TBI Bank "Buy in Installments" button
// with 4 predefined style variants. It displays the best installment option
// available for the product price.
//
// Usage:
//   <TBIButton
//     amountCents={50000}  // 500 EUR
//     productName="Course Name"
//     productType="course"
//     productId="course-123"
//     style="light"
//     onClick={handleClick}
//   />
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { TBIButtonProps, TBIInstallmentScheme, TBI_CONFIG } from '../tbiTypes';
import { qualifiesForTBI, getInstallmentSchemes, formatShortInstallment } from '../tbiService';

// TBI Logo URLs from CDN
const TBI_LOGOS = {
  white: 'https://cdn.tbibank.support/logo/tbi-bank-white.svg',
  dark: 'https://cdn.tbibank.support/logo/tbi-bank.svg',
  logo2: 'https://cdn.tbibank.support/logo/tbi-bank-logo2.svg',
} as const;

// Button style configurations
const BUTTON_STYLES = {
  light: {
    container: 'bg-orange-500 hover:bg-orange-600',
    text: 'text-white',
    logo: TBI_LOGOS.white,
    border: 'border-transparent',
  },
  dark: {
    container: 'bg-[#0A0A0A] border-2 border-orange-500 hover:bg-[#EAB308]/10',
    text: 'text-[#FAFAFA]',
    logo: TBI_LOGOS.dark,
    border: 'border-orange-500',
  },
  outline: {
    container: 'bg-[#0A0A0A]/90 backdrop-blur border-2 border-white hover:bg-[#0A0A0A]',
    text: 'text-[#FAFAFA]',
    logo: TBI_LOGOS.dark,
    border: 'border-white',
  },
  minimal: {
    container: 'bg-[#0A0A0A] hover:bg-[#0A0A0A]',
    text: 'text-white',
    logo: TBI_LOGOS.logo2,
    border: 'border-transparent',
  },
};

export function TBIButton({
  amountCents,
  currency = 'EUR',
  productName,
  productType,
  productId,
  onClick,
  disabled = false,
  className = '',
  style = 'light',
}: TBIButtonProps) {
  const [schemes, setSchemes] = useState<TBIInstallmentScheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if amount qualifies for TBI
  const isEligible = qualifiesForTBI(amountCents);

  // Fetch installment schemes on mount
  useEffect(() => {
    if (!isEligible) return;

    let mounted = true;
    
    const fetchSchemes = async () => {
      setLoading(true);
      setError(null);
      
      const result = await getInstallmentSchemes({ amountCents });
      
      if (!mounted) return;
      
      if (result.success && result.schemes && result.schemes.length > 0) {
        // Sort by period (ascending) and get the middle option
        const sorted = result.schemes.sort((a, b) => a.period - b.period);
        setSchemes(sorted);
      } else {
        setError(result.error || null);
      }
      
      setLoading(false);
    };

    fetchSchemes();
    
    return () => { mounted = false; };
  }, [amountCents, isEligible]);

  // Get the best scheme to display (prefer 6 installments for display)
  const displayScheme = schemes.find(s => s.period === 6) || schemes[2] || schemes[0];

  const handleClick = useCallback(() => {
    if (disabled || loading) return;
    onClick?.();
  }, [disabled, loading, onClick]);

  // Don't render if below minimum amount
  if (!isEligible) {
    return null;
  }

  const styleConfig = BUTTON_STYLES[style];

  return (
    <div className={`w-full ${className}`}>
      <button
        onClick={handleClick}
        disabled={disabled || loading}
        className={`
          relative w-full rounded-lg overflow-hidden
          transition-all duration-200 ease-out
          ${styleConfig.container}
          ${styleConfig.border}
          ${disabled || loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer  hover:scale-[1.02]'}
        `}
      >
        <div className="px-4 py-3 flex flex-col items-center justify-center gap-1">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className={`text-sm font-medium ${styleConfig.text}`}>
                Зареждане...
              </span>
            </div>
          )}

          {/* Content */}
          {!loading && !error && displayScheme && (
            <>
              {/* Main line: "Buy with TBI" */}
              <div className={`flex items-center gap-1.5 text-sm font-medium ${styleConfig.text}`}>
                <span>Купи с</span>
                <img
                  src={styleConfig.logo}
                  alt="TBI Bank"
                  className="h-4 w-auto object-contain"
                />
              </div>
              
              {/* Installment info */}
              <div className={`text-xs ${styleConfig.text} opacity-90`}>
                {formatShortInstallment(
                  displayScheme.period,
                  displayScheme.monthly_amount_cents,
                  currency
                )}
              </div>
            </>
          )}

          {/* Error state - show generic message */}
          {!loading && (error || !displayScheme) && (
            <div className={`flex items-center gap-1.5 text-sm font-medium ${styleConfig.text}`}>
              <span>Купи на вноски с</span>
              <img
                src={styleConfig.logo}
                alt="TBI Bank"
                className="h-4 w-auto object-contain"
              />
            </div>
          )}
        </div>
      </button>

      {/* Minimum amount indicator (optional) */}
      {amountCents < TBI_CONFIG.minAmountCents && (
        <p className="text-xs text-[#666666] mt-1 text-center">
          Минимум {TBI_CONFIG.minAmountCents / 100} {currency} за вноски
        </p>
      )}
    </div>
  );
}

// ============================================================================
// COMPACT VARIANT
// For use in smaller spaces (cards, list items)
// ============================================================================

export function TBIButtonCompact({
  amountCents,
  currency = 'EUR',
  onClick,
  disabled = false,
  className = '',
}: Omit<TBIButtonProps, 'productName' | 'productType' | 'productName'>) {
  const [bestScheme, setBestScheme] = useState<TBIInstallmentScheme | null>(null);
  const [loading, setLoading] = useState(false);

  const isEligible = qualifiesForTBI(amountCents);

  useEffect(() => {
    if (!isEligible) return;

    let mounted = true;
    
    const fetchSchemes = async () => {
      setLoading(true);
      const result = await getInstallmentSchemes({ amountCents });
      
      if (!mounted) return;
      
      if (result.success && result.schemes && result.schemes.length > 0) {
        const sorted = result.schemes.sort((a, b) => a.period - b.period);
        setBestScheme(sorted[2] || sorted[0]); // Prefer 6 installments
      }
      
      setLoading(false);
    };

    fetchSchemes();
    
    return () => { mounted = false; };
  }, [amountCents, isEligible]);

  if (!isEligible) return null;

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5
        bg-orange-500
        text-white text-xs font-medium rounded-md
        transition-all duration-200
        hover:bg-orange-600 hover:border-[#333333]
        ${disabled || loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {loading ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Зареждане...</span>
        </>
      ) : (
        <>
          <span>Купи с</span>
          <img
            src={TBI_LOGOS.white}
            alt="TBI"
            className="h-3 w-auto"
          />
          {bestScheme && (
            <span className="opacity-90">
              • {bestScheme.period} x {(bestScheme.monthly_amount_cents / 100).toFixed(0)} {currency}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ============================================================================
// TEXT-ONLY VARIANT
// For inline use (e.g., next to price)
// ============================================================================

export function TBIInstallmentText({
  amountCents,
  currency = 'EUR',
  className = '',
}: {
  amountCents: number;
  currency?: string;
  className?: string;
}) {
  const [bestScheme, setBestScheme] = useState<TBIInstallmentScheme | null>(null);

  const isEligible = qualifiesForTBI(amountCents);

  useEffect(() => {
    if (!isEligible) return;

    let mounted = true;
    
    const fetchSchemes = async () => {
      const result = await getInstallmentSchemes({ amountCents });
      
      if (!mounted) return;
      
      if (result.success && result.schemes && result.schemes.length > 0) {
        const sorted = result.schemes.sort((a, b) => a.period - b.period);
        setBestScheme(sorted[2] || sorted[0]);
      }
    };

    fetchSchemes();
    
    return () => { mounted = false; };
  }, [amountCents, isEligible]);

  if (!isEligible || !bestScheme) return null;

  return (
    <span className={`text-sm text-[#EAB308] font-medium ${className}`}>
      или {bestScheme.period} x {(bestScheme.monthly_amount_cents / 100).toFixed(2)} {currency} с{' '}
      <span className="inline-flex items-center gap-0.5">
        <img
          src={TBI_LOGOS.dark}
          alt="TBI Bank"
          className="h-3.5 w-auto inline"
        />
      </span>
    </span>
  );
}
