import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, AlertCircle, Eye, EyeOff, CheckCircle, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { Logo } from '../../shared/Logo';
import LanguageSwitcher from '../../shared/LanguageSwitcher';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { signIn, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('return');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      if (returnUrl) {
        navigate(decodeURIComponent(returnUrl));
      } else {
        navigate('/app');
      }
    }
  }, [user, returnUrl, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setError(signInError.message);
      }
      // Redirect happens automatically via useEffect when user state changes
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);

    try {
      const { error: resetError } = await resetPassword(forgotEmail);

      if (resetError) {
        setForgotError(resetError.message);
      } else {
        setForgotSuccess(true);
      }
    } catch (err) {
      setForgotError(t('auth.unexpectedError'));
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotPassword = () => {
    setForgotEmail(email); // Pre-fill with login email
    setForgotError(null);
    setForgotSuccess(false);
    setShowForgotPassword(true);
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotError(null);
    setForgotSuccess(false);
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
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#FAFAFA] mb-2">
              {t('auth.loginTitle')}
            </h1>
            <p className="text-[#A0A0A0]">{t('auth.loginSubtitle')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-[#EF4444] mt-0.5 flex-shrink-0" size={20} />
              <p className="text-[#EF4444] text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="sr-only">
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-[#0A0A0A] border border-[#1F1F1F] rounded text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555] text-base"
                  placeholder={t('auth.email')}
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="sr-only">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-12 py-4 bg-[#0A0A0A] border border-[#1F1F1F] rounded text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555] text-base"
                  placeholder={t('auth.password')}
                  disabled={isLoading}
                  autoComplete="current-password"
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

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                className="text-sm text-white hover:text-[#A0A0A0] font-medium"
                onClick={openForgotPassword}
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white hover:bg-[#E0E0E0] text-black font-bold py-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('common.logIn')
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-8 text-center border-t border-[#1F1F1F] pt-6">
            <p className="text-[#A0A0A0]">
              {t('auth.noAccount')}{' '}
              <Link
                to={returnUrl ? `/signup?return=${encodeURIComponent(returnUrl)}` : '/signup'}
                className="text-white hover:text-[#A0A0A0] font-bold underline"
              >
                {t('common.signUp')}
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0A0A0A] rounded-2xl border border-[#1F1F1F] w-full max-w-md p-6 relative">
            {/* Close Button */}
            <button
              onClick={closeForgotPassword}
              className="absolute top-4 right-4 text-[#666666] hover:text-[#A0A0A0]"
            >
              <X size={24} />
            </button>

            {forgotSuccess ? (
              /* Success State */
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-[#22C55E]" size={32} />
                </div>
                <h2 className="text-xl font-bold text-[#FAFAFA] mb-2">
                  {t('auth.checkYourEmail')}
                </h2>
                <p className="text-[#A0A0A0] mb-6">
                  {t('auth.resetEmailSent', { email: forgotEmail })}
                </p>
                <button
                  onClick={closeForgotPassword}
                  className="w-full bg-white hover:bg-[#E0E0E0] text-black font-bold py-3 rounded-lg transition-colors"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            ) : (
              /* Form State */
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#FAFAFA] mb-2">
                    {t('auth.forgotPasswordTitle')}
                  </h2>
                  <p className="text-[#A0A0A0] text-sm">
                    {t('auth.forgotPasswordSubtitle')}
                  </p>
                </div>

                {/* Error Message */}
                {forgotError && (
                  <div className="mb-4 p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg flex items-start gap-2">
                    <AlertCircle className="text-[#EF4444] mt-0.5 flex-shrink-0" size={18} />
                    <p className="text-[#EF4444] text-sm">{forgotError}</p>
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="sr-only">
                      {t('auth.email')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-3 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                        placeholder={t('auth.email')}
                        disabled={forgotLoading}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-white hover:bg-[#E0E0E0] text-black font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      t('auth.sendResetLink')
                    )}
                  </button>
                </form>

                <button
                  onClick={closeForgotPassword}
                  className="w-full mt-3 text-[#A0A0A0] hover:text-[#FAFAFA] text-sm font-medium flex items-center justify-center gap-1"
                >
                  <ArrowLeft size={16} />
                  {t('auth.backToLogin')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
