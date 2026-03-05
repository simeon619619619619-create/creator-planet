// ============================================================================
// TBI APPLICATION MODAL
// Handles the complete TBI application flow
// ============================================================================
//
// This modal:
// 1. Shows the calculator
// 2. Collects customer data (if not already saved)
// 3. Submits application to TBI
// 4. Shows success/redirect state
//
// Usage:
//   <TBIApplicationModal
//     isOpen={isOpen}
//     onClose={handleClose}
//     productType="community"
//     productId="comm-123"
//     productName="My Community"
//     amountCents={50000}
//     scheme={selectedScheme}
//     onSuccess={handleSuccess}
//   />
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, CheckCircle, AlertCircle, Loader2, Shield, User, Mail, Phone, CreditCard } from 'lucide-react';
import { TBICustomerData, TBIInstallmentScheme, TBIApplicationStatus } from '../tbiTypes';
import { createTBICheckout, formatInstallmentDisplay, getTBIStatusLabel } from '../tbiService';
import { TBICalculator } from './TBICalculator';
import { useAuth } from '../../../core/contexts/AuthContext';

interface TBIApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productType: 'community' | 'course';
  productId: string;
  productName: string;
  amountCents: number;
  initialScheme?: TBIInstallmentScheme;
  onSuccess?: () => void;
}

type ModalStep = 'calculator' | 'customer-form' | 'submitting' | 'success' | 'error';

export function TBIApplicationModal({
  isOpen,
  onClose,
  productType,
  productId,
  productName,
  amountCents,
  initialScheme,
  onSuccess,
}: TBIApplicationModalProps) {
  const { profile } = useAuth();
  
  // Step state
  const [step, setStep] = useState<ModalStep>(initialScheme ? 'customer-form' : 'calculator');
  
  // Selection state
  const [selectedScheme, setSelectedScheme] = useState<TBIInstallmentScheme | undefined>(initialScheme);
  
  // Form state
  const [customerData, setCustomerData] = useState<TBICustomerData>({
    first_name: profile?.full_name?.split(' ')[0] || '',
    last_name: profile?.full_name?.split(' ').slice(1).join(' ') || '',
    email: profile?.email || '',
    phone: '',
    egn: '',
  });
  
  // Submission state
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(initialScheme ? 'customer-form' : 'calculator');
      setSelectedScheme(initialScheme);
      setError(null);
      setApplicationId(null);
      setCustomerData({
        first_name: profile?.full_name?.split(' ')[0] || '',
        last_name: profile?.full_name?.split(' ').slice(1).join(' ') || '',
        email: profile?.email || '',
        phone: '',
        egn: '',
      });
    }
  }, [isOpen, initialScheme, profile]);

  const handleSchemeSelect = useCallback((scheme: TBIInstallmentScheme) => {
    setSelectedScheme(scheme);
    setStep('customer-form');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedScheme || !profile) return;

    setLoading(true);
    setError(null);
    setStep('submitting');

    try {
      const successUrl = `${window.location.origin}/tbi/success`;
      const cancelUrl = `${window.location.origin}/tbi/cancel`;

      const result = await createTBICheckout({
        productType,
        productId,
        productName,
        amountCents,
        schemeId: selectedScheme.scheme_id,
        customer: customerData,
        successUrl,
        cancelUrl,
      });

      if (result.success && result.applicationId) {
        setApplicationId(result.applicationId);

        // Redirect to TBI if URL provided
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }

        setStep('success');
        onSuccess?.();
      } else {
        setError(result.error || 'Failed to create application');
        setStep('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [selectedScheme, profile, productType, productId, productName, amountCents, customerData, onSuccess]);

  const handleClose = useCallback(() => {
    // Don't close while submitting
    if (step === 'submitting') return;
    onClose();
  }, [step, onClose]);

  // Validate form
  const isFormValid = () => {
    const { first_name, last_name, email, phone, egn } = customerData;
    return (
      first_name.trim() &&
      last_name.trim() &&
      email.includes('@') &&
      phone.length >= 10 &&
      egn.length === 10
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#0A0A0A] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="https://cdn.tbibank.support/logo/tbi-bank-white.svg"
              alt="TBI Bank"
              className="h-6 w-auto"
            />
            <span className="text-white font-semibold">Купи на вноски</span>
          </div>
          <button
            onClick={handleClose}
            disabled={step === 'submitting'}
            className="p-1 hover:bg-[#0A0A0A]/20 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Step 1: Calculator */}
          {step === 'calculator' && (
            <TBICalculator
              amountCents={amountCents}
              onSchemeSelect={handleSchemeSelect}
              selectedSchemeId={selectedScheme?.scheme_id}
            />
          )}

          {/* Step 2: Customer Form */}
          {step === 'customer-form' && selectedScheme && (
            <div className="space-y-4">
              {/* Selected scheme summary */}
              <div className="bg-[#EAB308]/10 rounded-lg p-4 border border-[#EAB308]/20">
                <p className="text-sm text-[#A0A0A0] mb-1">Избрана схема:</p>
                <p className="font-semibold text-[#EAB308]">
                  {formatInstallmentDisplay(selectedScheme.period, selectedScheme.monthly_amount_cents, 'EUR')}
                </p>
                <button
                  onClick={() => setStep('calculator')}
                  className="text-xs text-[#EAB308] hover:text-[#EAB308] mt-2 underline"
                >
                  Промени схемата
                </button>
              </div>

              {/* Form fields */}
              <div className="space-y-3">
                <h3 className="font-medium text-[#FAFAFA] flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Лични данни
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-[#A0A0A0] mb-1">Име</label>
                    <input
                      type="text"
                      value={customerData.first_name}
                      onChange={(e) => setCustomerData({ ...customerData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                      placeholder="Иван"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#A0A0A0] mb-1">Фамилия</label>
                    <input
                      type="text"
                      value={customerData.last_name}
                      onChange={(e) => setCustomerData({ ...customerData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                      placeholder="Иванов"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#A0A0A0] mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    Имейл
                  </label>
                  <input
                    type="email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                    placeholder="ivan@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#A0A0A0] mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                    placeholder="0888123456"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#A0A0A0] mb-1 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    ЕГН
                  </label>
                  <input
                    type="text"
                    value={customerData.egn}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setCustomerData({ ...customerData, egn: value });
                    }}
                    className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                    placeholder="0000000000"
                    maxLength={10}
                  />
                  <p className="text-xs text-[#666666] mt-1">
                    Необходимо е за проверка на кредитната история
                  </p>
                </div>
              </div>

              {/* Security note */}
              <div className="flex items-start gap-2 text-xs text-[#666666] bg-[#0A0A0A] p-3 rounded-lg">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Данните ви се предават сигурно към TBI Bank. С натискане на бутона се съгласявате с{' '}
                  <a href="#" className="text-[#EAB308] hover:underline">общите условия</a>.
                </span>
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={!isFormValid()}
                className="
                  w-full py-3 px-4 rounded-lg font-medium
                  bg-gradient-to-r from-orange-500 to-orange-600
                  text-white
                  hover:from-orange-600 hover:to-orange-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                  transition-all duration-200
                "
              >
                <span>Продължи към TBI Bank</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 3: Submitting */}
          {step === 'submitting' && (
            <div className="py-8 text-center">
              <Loader2 className="w-12 h-12 text-[#EAB308] animate-spin mx-auto mb-4" />
              <h3 className="font-semibold text-[#FAFAFA] mb-2">Обработка на кандидатурата...</h3>
              <p className="text-sm text-[#A0A0A0]">
                Свързваме се с TBI Bank. Моля, изчакайте.
              </p>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="py-6 text-center">
              <CheckCircle className="w-16 h-16 text-[#22C55E] mx-auto mb-4" />
              <h3 className="font-semibold text-[#FAFAFA] mb-2">Кандидатурата е изпратена!</h3>
              <p className="text-sm text-[#A0A0A0] mb-4">
                TBI Bank ще се свърже с вас на <strong>{customerData.phone}</strong> за потвърждение.
              </p>
              <div className="bg-[#0A0A0A] rounded-lg p-4 text-sm">
                <p className="text-[#A0A0A0]">Номер на кандидатура:</p>
                <p className="font-mono font-semibold text-[#FAFAFA]">{applicationId}</p>
              </div>
              <button
                onClick={handleClose}
                className="mt-6 px-6 py-2 bg-white text-black rounded-lg hover:bg-[#E0E0E0] transition-colors"
              >
                Разбрах
              </button>
            </div>
          )}

          {/* Step 5: Error */}
          {step === 'error' && (
            <div className="py-6 text-center">
              <AlertCircle className="w-16 h-16 text-[#EF4444] mx-auto mb-4" />
              <h3 className="font-semibold text-[#FAFAFA] mb-2">Възникна грешка</h3>
              <p className="text-sm text-[#A0A0A0] mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setStep('customer-form')}
                  className="px-4 py-2 text-[#EAB308] hover:bg-[#EAB308]/10 rounded-lg transition-colors"
                >
                  Опитай отново
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-[#1F1F1F] text-[#A0A0A0] rounded-lg hover:bg-[#1F1F1F] transition-colors"
                >
                  Затвори
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
