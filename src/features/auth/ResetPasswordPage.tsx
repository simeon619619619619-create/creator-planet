import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { supabase } from '../../core/supabase/client';
import { Logo } from '../../shared/Logo';
import LanguageSwitcher from '../../shared/LanguageSwitcher';

const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const { updatePassword, session, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [isWaitingForRecovery, setIsWaitingForRecovery] = useState(true);
  const recoveryHandled = useRef(false);

  // Detect recovery flow and wait for Supabase to process the token
  useEffect(() => {
    // Check URL hash for recovery indicators (Supabase appends #access_token=...&type=recovery)
    const hash = window.location.hash;
    const hasRecoveryParams = hash.includes('type=recovery') || hash.includes('type=magiclink');

    // Listen for PASSWORD_RECOVERY event from Supabase auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && !recoveryHandled.current) {
        recoveryHandled.current = true;
        setIsRecoveryReady(true);
        setIsWaitingForRecovery(false);
      }
    });

    // Timeout: if recovery token exchange doesn't complete within 10s, show error
    // (Supabase default SMTP limits to 2 emails/hour, so token may never arrive)
    const timeout = hasRecoveryParams ? setTimeout(() => {
      if (!recoveryHandled.current && !session) {
        setIsWaitingForRecovery(false);
        setIsRecoveryReady(false);
      }
    }, 10000) : null;

    // If session already exists (e.g., page was refreshed after recovery), allow form
    if (session) {
      setIsRecoveryReady(true);
      setIsWaitingForRecovery(false);
    } else if (!hasRecoveryParams && !authLoading) {
      // No recovery params in URL and auth is done loading - redirect to login
      setIsWaitingForRecovery(false);
      navigate('/login');
    }

    return () => {
      subscription.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  }, [session, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await updatePassword(password);

      if (updateError) {
        setError(updateError.message);
      } else {
        setIsSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setError(t('auth.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Simple Header */}
      <header className="border-b border-[#1F1F1F] bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo variant="light" size="md" showText={false} />
          </Link>
          <LanguageSwitcher variant="minimal" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          {/* Loading State - waiting for recovery token */}
          {isWaitingForRecovery ? (
            <div className="text-center">
              <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#A0A0A0]">{t('common.loading')}</p>
            </div>
          ) : !isRecoveryReady && !isSuccess ? (
            <div className="text-center">
              <div className="mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-[#EF4444] mt-0.5 flex-shrink-0" size={20} />
                <p className="text-[#EF4444] text-sm">{t('auth.invalidRecoveryLink')}</p>
              </div>
              <Link to="/login" className="text-white hover:text-[#A0A0A0] font-medium">
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
          <>
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#FAFAFA] mb-2">
              {t('auth.resetPasswordTitle')}
            </h1>
            <p className="text-[#A0A0A0]">{t('auth.resetPasswordSubtitle')}</p>
          </div>

          {/* Success Message */}
          {isSuccess ? (
            <div className="text-center">
              <div className="mb-6 p-4 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg flex items-start gap-3">
                <CheckCircle className="text-[#22C55E] mt-0.5 flex-shrink-0" size={20} />
                <p className="text-[#22C55E] text-sm">{t('auth.passwordResetSuccess')}</p>
              </div>
              <Link
                to="/login"
                className="text-white hover:text-[#A0A0A0] font-medium"
              >
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-[#EF4444] mt-0.5 flex-shrink-0" size={20} />
                  <p className="text-[#EF4444] text-sm">{error}</p>
                </div>
              )}

              {/* Reset Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[#A0A0A0] mb-2">
                    {t('auth.newPassword')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-12 pr-12 py-4 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555] text-base"
                      placeholder="••••••••"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#A0A0A0] mb-2">
                    {t('auth.confirmPassword')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-12 pr-12 py-4 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555] text-base"
                      placeholder="••••••••"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-white hover:bg-[#E0E0E0] text-black font-bold py-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    t('auth.resetPassword')
                  )}
                </button>
              </form>

              {/* Back to Login Link */}
              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="text-[#A0A0A0] hover:text-[#FAFAFA] text-sm"
                >
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </>
          )}
          </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
