// =============================================================================
// CoursePurchaseModal Component
// Payment modal for purchasing paid courses
// =============================================================================

import { useState, useEffect } from 'react';
import { X, Loader2, CreditCard, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { createSalePaymentIntent } from '../../billing';
import { DbCourse } from '../../../core/supabase/database.types';

// Initialize Stripe outside component to avoid recreating on each render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

interface CoursePurchaseModalProps {
  course: DbCourse & { price_cents?: number };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  buyerId: string;
}

export function CoursePurchaseModal({
  course,
  isOpen,
  onClose,
  onSuccess,
  buyerId,
}: CoursePurchaseModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const priceInCents = course.price_cents || 0;
  const priceDisplay = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceInCents / 100);

  useEffect(() => {
    if (!isOpen || priceInCents <= 0) return;

    const initPayment = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await createSalePaymentIntent(
          course.creator_id,
          buyerId,
          {
            type: 'course',
            id: course.id,
            name: course.title,
            price: priceInCents,
          }
        );

        if (!result.success || !result.clientSecret) {
          throw new Error(result.error || 'Failed to initialize payment');
        }

        setClientSecret(result.clientSecret);
      } catch (err) {
        console.error('Payment init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
      } finally {
        setIsLoading(false);
      }
    };

    initPayment();
  }, [isOpen, course, buyerId, priceInCents]);

  if (!isOpen) return null;

  const elementsOptions: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#FAFAFA',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '8px',
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0A] rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1F1F1F]">
          <div>
            <h2 className="text-xl font-bold text-[#FAFAFA]">Purchase Course</h2>
            <p className="text-sm text-[#666666] mt-1">{course.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#666666] hover:text-[#A0A0A0] hover:bg-[#1F1F1F] rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Price Summary */}
          <div className="bg-[#0A0A0A] rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-[#A0A0A0]">Course price</span>
              <span className="text-xl font-bold text-[#FAFAFA]">{priceDisplay}</span>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#FAFAFA] mb-3" />
              <p className="text-[#666666]">Preparing secure checkout...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex items-start gap-3 p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl mb-6">
              <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#EF4444]">Payment setup failed</p>
                <p className="text-sm text-[#EF4444] mt-1">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-sm text-[#EF4444] underline mt-2"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Payment Form */}
          {clientSecret && !isLoading && !error && (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <CheckoutForm
                course={course}
                priceDisplay={priceDisplay}
                onSuccess={onSuccess}
                onClose={onClose}
              />
            </Elements>
          )}

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-[#666666]">
            <ShieldCheck size={14} />
            <span>Secure payment powered by Stripe</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Checkout Form Component (uses Stripe Elements context)
// =============================================================================

function CheckoutForm({
  course,
  priceDisplay,
  onSuccess,
  onClose,
}: {
  course: DbCourse;
  priceDisplay: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/courses/${course.id}?payment=success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setPaymentError(error.message || 'Payment failed. Please try again.');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setPaymentSuccess(true);
        // Wait a moment to show success, then call onSuccess
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setPaymentError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-[#22C55E]" />
        </div>
        <h3 className="text-lg font-semibold text-[#FAFAFA] mb-2">Payment Successful!</h3>
        <p className="text-[#666666] text-center">
          You now have access to <span className="font-medium">{course.title}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {paymentError && (
        <div className="flex items-start gap-2 p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg mt-4">
          <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
          <p className="text-sm text-[#EF4444]">{paymentError}</p>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="flex-1 px-4 py-3 border border-[#1F1F1F] rounded-xl font-medium text-[#A0A0A0] hover:bg-[#0A0A0A] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-3 rounded-xl font-medium hover:bg-[#E0E0E0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard size={18} />
              Pay {priceDisplay}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default CoursePurchaseModal;
