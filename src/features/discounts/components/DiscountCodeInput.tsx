/**
 * Discount Code Input
 *
 * Component for students to enter and validate discount codes
 * before checkout. Shows the discounted price when valid.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { validateDiscountCode } from '../discountService';
import { formatCents } from '../discountTypes';
import type { DiscountValidationResponse } from '../discountTypes';

interface DiscountCodeInputProps {
  communityId?: string;
  courseId?: string;
  originalPriceCents: number;
  currency?: string;
  onValidCode: (code: string, discount: DiscountValidationResponse) => void;
  onClear: () => void;
}

export function DiscountCodeInput({
  communityId,
  courseId,
  originalPriceCents,
  currency = 'EUR',
  onValidCode,
  onClear,
}: DiscountCodeInputProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validatedDiscount, setValidatedDiscount] = useState<DiscountValidationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!code.trim()) {
      setError(t('discounts.input.validation.empty'));
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const result = await validateDiscountCode(code.trim(), communityId, courseId);

      if (result.valid) {
        setValidatedDiscount(result);
        onValidCode(code.trim(), result);
      } else {
        setError(result.error || t('discounts.input.validation.invalid'));
        setValidatedDiscount(null);
      }
    } catch {
      setError(t('discounts.input.validation.defaultError'));
      setValidatedDiscount(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleClear = () => {
    setCode('');
    setValidatedDiscount(null);
    setError(null);
    onClear();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  // If discount is applied, show success state
  if (validatedDiscount) {
    return (
      <div className="rounded-lg border border-[#22C55E]/20 bg-[#22C55E]/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22C55E]/10">
              <Check className="h-4 w-4 text-[#22C55E]" />
            </div>
            <div>
              <p className="font-medium text-[#22C55E]">
                {t('discounts.input.success.label', { discount: validatedDiscount.discountPercent })}
              </p>
              <p className="text-sm text-[#22C55E]">
                {t('discounts.input.success.code', {
                  code: code.toUpperCase(),
                  duration: validatedDiscount.durationMonths === null
                    ? t('discounts.duration.forever')
                    : validatedDiscount.durationMonths === 1
                      ? t('discounts.duration.firstMonth')
                      : t('discounts.duration.months', { count: validatedDiscount.durationMonths })
                })}
              </p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="rounded-lg p-2 text-[#22C55E] hover:bg-[#22C55E]/10"
            title={t('discounts.input.expanded.removeTitle')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Price breakdown */}
        <div className="mt-3 border-t border-[#22C55E]/20 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#22C55E]">{t('discounts.input.success.originalPrice')}</span>
            <span className="text-[#22C55E] line-through">
              {formatCents(originalPriceCents, currency)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#22C55E]">{t('discounts.input.success.discount')}</span>
            <span className="text-[#22C55E]">
              -{formatCents(validatedDiscount.discountAmountCents || 0, currency)}
            </span>
          </div>
          <div className="mt-1 flex justify-between font-medium">
            <span className="text-[#22C55E]">{t('discounts.input.success.youPay')}</span>
            <span className="text-[#22C55E]">
              {formatCents(validatedDiscount.finalPriceCents || 0, currency)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Collapsed state - just a link to expand
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 text-sm text-[#FAFAFA] hover:text-[#A0A0A0]"
      >
        <Tag className="h-4 w-4" />
        {t('discounts.input.collapsed.label')}
        <ChevronDown className="h-4 w-4" />
      </button>
    );
  }

  // Expanded state - input form
  return (
    <div className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[#A0A0A0]">
          <Tag className="h-4 w-4" />
          {t('discounts.input.expanded.label')}
        </div>
        <button
          onClick={() => {
            setIsExpanded(false);
            setCode('');
            setError(null);
          }}
          className="text-[#666666] hover:text-[#A0A0A0]"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('discounts.input.expanded.placeholder')}
          disabled={isValidating}
          className="flex-1 rounded-lg border border-[#1F1F1F] px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-[#555555] focus:ring-white/10 disabled:bg-[#1F1F1F]"
        />
        <button
          onClick={handleApply}
          disabled={isValidating || !code.trim()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-white hover:bg-[#E0E0E0] disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : t('discounts.input.expanded.applyButton')}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-[#EF4444]">{error}</p>
      )}
    </div>
  );
}
