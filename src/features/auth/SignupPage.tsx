import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Mail, Lock, AlertCircle, CheckCircle, Eye, EyeOff, Phone } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { UserRole } from '../../core/types';
import { Logo } from '../../shared/Logo';
import LanguageSwitcher from '../../shared/LanguageSwitcher';

const SignupPage: React.FC = () => {
  const { t } = useTranslation();
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('return');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated (includes auto-confirm after signup)
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
    setSuccess(false);

    // Validation
    if (fullName.trim().length < 2) {
      setError('Please enter your full name');
      return;
    }

    if (!phone.trim() || phone.trim().length < 6) {
      setError('Моля, въведете валиден телефонен номер');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError } = await signUp(email, password, fullName, role, marketingOptIn, phone);

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess(true);
        // Clear form
        setFullName('');
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
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
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#FAFAFA] mb-2">
              {t('auth.signupTitle')}
            </h1>
            <p className="text-[#A0A0A0]">{t('auth.signupSubtitle')}</p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg flex items-start gap-3">
              <CheckCircle className="text-[#22C55E] mt-0.5 flex-shrink-0" size={20} />
              <div>
                <p className="text-[#22C55E] text-sm font-medium">{t('common.success')}!</p>
                <p className="text-[#22C55E] text-xs mt-1">
                  {t('auth.accountCreatedRedirecting')}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-[#EF4444] mt-0.5 flex-shrink-0" size={20} />
              <p className="text-[#EF4444] text-sm">{error}</p>
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name Field */}
            <div>
              <label htmlFor="fullName" className="sr-only">
                {t('auth.fullName')}
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-[#0A0A0A] border border-[#1F1F1F] rounded text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555] text-base"
                  placeholder={t('auth.fullName')}
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>
            </div>

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

            {/* Phone Field */}
            <div>
              <label htmlFor="phone" className="sr-only">
                Телефон
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-[#0A0A0A] border border-[#1F1F1F] rounded text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555] text-base"
                  placeholder="Телефонен номер *"
                  disabled={isLoading}
                  autoComplete="tel"
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

            {/* Role Selection */}
            <div className="pt-2">
              <label className="block text-sm font-medium text-[#A0A0A0] mb-3">
                {t('auth.iAmA')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`p-3 border-2 rounded transition-all text-left ${
                    role === 'student'
                      ? 'border-white bg-[#151515]'
                      : 'border-[#1F1F1F] hover:border-[#333333]'
                  }`}
                  disabled={isLoading}
                >
                  <div className="font-semibold text-[#FAFAFA] text-sm">{t('auth.student')}</div>
                  <div className="text-xs text-[#666666] mt-0.5">{t('auth.studentDesc')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('creator')}
                  className={`p-3 border-2 rounded transition-all text-left ${
                    role === 'creator'
                      ? 'border-white bg-[#151515]'
                      : 'border-[#1F1F1F] hover:border-[#333333]'
                  }`}
                  disabled={isLoading}
                >
                  <div className="font-semibold text-[#FAFAFA] text-sm">{t('auth.creator')}</div>
                  <div className="text-xs text-[#666666] mt-0.5">{t('auth.creatorDescShort')}</div>
                </button>
              </div>
            </div>

            {/* Marketing Opt-in */}
            <div className="flex items-start gap-3 pt-2">
              <input
                id="marketing"
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="mt-1 h-4 w-4 text-white border-[#1F1F1F] rounded focus:ring-white/10 bg-[#0A0A0A]"
                disabled={isLoading}
              />
              <label htmlFor="marketing" className="text-sm text-[#A0A0A0]">
                {t('auth.marketingOptIn')}
              </label>
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
                t('common.signUp')
              )}
            </button>
          </form>

          {/* Terms Text */}
          <p className="text-xs text-[#666666] text-center mt-4">
            {t('auth.termsAgreement')}{' '}
            <a href="#" className="text-[#FAFAFA] hover:underline">
              {t('nav.terms')}
            </a>{' '}
            {t('common.and')}{' '}
            <a href="#" className="text-[#FAFAFA] hover:underline">
              {t('nav.privacy')}
            </a>
            .
          </p>

          {/* Login Link */}
          <div className="mt-8 text-center border-t border-[#1F1F1F] pt-6">
            <p className="text-[#A0A0A0]">
              {t('auth.hasAccount')}{' '}
              <Link
                to={returnUrl ? `/login?return=${encodeURIComponent(returnUrl)}` : '/login'}
                className="text-[#FAFAFA] hover:text-white font-bold underline"
              >
                {t('common.logIn')}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SignupPage;
