import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { UserRole } from '../../core/types';
import { getDefaultRedirectPath } from '../../App';
import { Logo } from '../../shared/Logo';
import LanguageSwitcher from '../../shared/LanguageSwitcher';

interface SignupFormProps {
  onToggleForm?: () => void;
}

const SignupForm: React.FC<SignupFormProps> = ({ onToggleForm }) => {
  const { t } = useTranslation();
  const { signUp, user, role: userRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('return');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        // Role-based redirect: creators -> /dashboard, students -> /courses
        navigate(getDefaultRedirectPath(userRole));
      }
    }
  }, [user, userRole, returnUrl, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError } = await signUp(email, password, fullName, role, false, undefined, returnUrl ? decodeURIComponent(returnUrl) : undefined);

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess(true);
        // Clear form
        setFullName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleForm = () => {
    if (onToggleForm) {
      onToggleForm();
    } else {
      // Navigate to login with same return URL
      const loginUrl = returnUrl ? `/login?return=${encodeURIComponent(returnUrl)}` : '/login';
      navigate(loginUrl);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      {/* Language Switcher - Fixed top right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher variant="minimal" className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg" />
      </div>

      <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl w-full max-w-md p-8">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo variant="light" size="lg" showText={false} />
          </div>
          <h1 className="text-2xl font-bold text-[#FAFAFA]">{t('auth.joinFoundersClub')}</h1>
          <p className="text-[#666666] mt-2">{t('auth.createAccountToStart')}</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg flex items-start gap-3">
            <Mail className="text-[#22C55E] mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="text-[#22C55E] text-sm font-medium">{t('auth.accountCreated')}</p>
              <p className="text-[#22C55E]/80 text-xs mt-1">
                {t('auth.checkEmailToConfirm', { defaultValue: 'Изпратихме ви имейл за потвърждение. Моля, проверете пощата си и кликнете на линка, за да активирате акаунта си.' })}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-[#EF4444] mt-0.5 flex-shrink-0" size={20} />
            <p className="text-[#EF4444] text-sm">{error}</p>
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name Field */}
          <div>
            <label htmlFor="fullName" className="block text-xs font-medium text-[#A0A0A0] mb-2">
              {t('auth.fullName')}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10 transition-colors duration-150"
                placeholder={t('auth.fullNamePlaceholder')}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-[#A0A0A0] mb-2">
              {t('auth.emailAddress')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10 transition-colors duration-150"
                placeholder={t('auth.emailPlaceholder')}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-[#A0A0A0] mb-2">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10 transition-colors duration-150"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-[#A0A0A0] mb-2">
              {t('auth.confirmPassword')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" size={20} />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10 transition-colors duration-150"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-medium text-[#A0A0A0] mb-3">
              {t('auth.iAmA')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('creator')}
                className={`p-4 border-2 rounded-lg transition-all duration-150 ${
                  role === 'creator'
                    ? 'border-white bg-white/5'
                    : 'border-[#1F1F1F] hover:border-[#333333]'
                }`}
                disabled={isLoading}
              >
                <div className="font-semibold text-[#FAFAFA]">{t('auth.creator')}</div>
                <div className="text-xs text-[#666666] mt-1">{t('auth.creatorDesc')}</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`p-4 border-2 rounded-lg transition-all duration-150 ${
                  role === 'student'
                    ? 'border-white bg-white/5'
                    : 'border-[#1F1F1F] hover:border-[#333333]'
                }`}
                disabled={isLoading}
              >
                <div className="font-semibold text-[#FAFAFA]">{t('auth.student')}</div>
                <div className="text-xs text-[#666666] mt-1">{t('auth.studentDesc')}</div>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white hover:bg-[#E0E0E0] text-black font-semibold py-3 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                {t('auth.creatingAccount')}
              </>
            ) : (
              <>
                <UserPlus size={20} />
                {t('auth.createAccount')}
              </>
            )}
          </button>
        </form>

        {/* Toggle to Login */}
        <div className="mt-6 text-center">
          <p className="text-[#A0A0A0]">
            {t('auth.alreadyHaveAccount')}{' '}
            <button
              onClick={handleToggleForm}
              className="text-[#FAFAFA] hover:text-white font-semibold transition-colors duration-150"
            >
              {t('auth.signIn')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupForm;
