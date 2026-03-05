import React, { useState, FormEvent } from 'react';
import {
  Mail,
  User,
  ChevronDown,
  ArrowRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import {
  submitWaitlist,
  WaitlistSubmission,
  WaitlistResult,
} from '../waitlistService';

interface WaitlistSectionProps {
  onSuccess?: (data: WaitlistResult) => void;
  onError?: (error: WaitlistResult) => void;
}

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const INTEREST_OPTIONS = [
  { value: 'creator', label: 'Creator' },
  { value: 'coach', label: 'Coach' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'student', label: 'Student' },
  { value: 'other', label: 'Other' },
] as const;

export default function WaitlistSection({
  onSuccess,
  onError,
}: WaitlistSectionProps) {
  const [formState, setFormState] = useState<FormState>('idle');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [interest, setInterest] = useState<WaitlistSubmission['interest']>('creator');
  const [errorMessage, setErrorMessage] = useState('');

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateEmail = (email: string): boolean => {
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');

    // Validate email
    if (!email || !validateEmail(email)) {
      setFormState('error');
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setFormState('submitting');

    const submission: WaitlistSubmission = {
      email: email.trim(),
      name: name.trim() || undefined,
      interest,
      source: 'landing_page',
    };

    try {
      const result = await submitWaitlist(submission);

      if (result.success) {
        setFormState('success');
        onSuccess?.(result);
        // Reset form after 3 seconds
        setTimeout(() => {
          setEmail('');
          setName('');
          setInterest('creator');
          setFormState('idle');
        }, 3000);
      } else {
        setFormState('error');
        setErrorMessage(result.message);
        onError?.(result);
      }
    } catch (error) {
      setFormState('error');
      setErrorMessage('An unexpected error occurred. Please try again.');
      onError?.({
        success: false,
        message: 'Unexpected error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <section className="py-20 px-4 bg-[#0A0A0A] border-t border-[#1F1F1F] text-white">
      <div className="max-w-2xl mx-auto text-center">
        {formState === 'success' ? (
          // Success State
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-[#22C55E]" />
              </div>
            </div>
            <h2 className="text-4xl font-bold">You're on the list!</h2>
            <p className="text-xl text-[#A0A0A0]">
              We'll notify you as soon as Founders Club launches.
            </p>
          </div>
        ) : (
          // Form State
          <>
            <div className="mb-8">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Join the Waitlist
              </h2>
              <p className="text-xl text-[#A0A0A0]">
                Be the first to know when Founders Club launches. Get early
                access and exclusive perks.
              </p>
            </div>

            {/* Error Banner */}
            {formState === 'error' && errorMessage && (
              <div className="mb-6 p-4 bg-[#EF4444]/20 border border-[#EF4444]/30 rounded-lg flex items-center gap-3 text-left">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Mail className="w-5 h-5 text-[#666666]" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={formState === 'submitting'}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#151515] text-[#FAFAFA] placeholder-[#666666] border border-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-white/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Name Field */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <User className="w-5 h-5 text-[#666666]" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  disabled={formState === 'submitting'}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#151515] text-[#FAFAFA] placeholder-[#666666] border border-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-white/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Interest Dropdown */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-5 h-5 text-[#666666]" />
                </div>
                <select
                  value={interest}
                  onChange={(e) =>
                    setInterest(e.target.value as WaitlistSubmission['interest'])
                  }
                  disabled={formState === 'submitting'}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#151515] text-[#FAFAFA] border border-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555] transition-all disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
                >
                  {INTEREST_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      I'm a {option.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-5 h-5 text-[#666666]" />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={formState === 'submitting'}
                className="w-full bg-white hover:bg-[#E0E0E0] text-black px-8 py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                {formState === 'submitting' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : (
                  <>
                    <span>Join Waitlist</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-sm text-[#666666]">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
