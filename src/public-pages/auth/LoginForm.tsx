import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { getDefaultRedirectPath } from '../../App';
import { Logo } from '../../shared/Logo';
import LanguageSwitcher from '../../shared/LanguageSwitcher';

interface LoginFormProps {
  onToggleForm?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onToggleForm }) => {
  const { t } = useTranslation();
  const { signIn, user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('return');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated - role-based redirect
  useEffect(() => {
    if (user) {
      if (returnUrl) {
        navigate(decodeURIComponent(returnUrl));
      } else {
        // Role-based redirect: creators -> /dashboard, students -> /courses
        navigate(getDefaultRedirectPath(role));
      }
    }
  }, [user, role, returnUrl, navigate]);

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

  const handleToggleForm = () => {
    if (onToggleForm) {
      onToggleForm();
    } else {
      // Navigate to signup with same return URL
      const signupUrl = returnUrl ? `/signup?return=${encodeURIComponent(returnUrl)}` : '/signup';
      navigate(signupUrl);
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
          <h1 className="text-2xl font-bold text-[#FAFAFA]">{t('auth.welcomeBack')}</h1>
          <p className="text-[#666666] mt-2">{t('auth.signInTo')}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-[#EF4444] mt-0.5 flex-shrink-0" size={20} />
            <p className="text-[#EF4444] text-sm">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* Forgot Password */}
          <div className="text-right">
            <a href="/reset-password" className="text-sm text-[#A0A0A0] hover:text-white transition-colors">
              {t('auth.forgotPassword') || 'Забравена парола?'}
            </a>
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
                {t('auth.signingIn')}
              </>
            ) : (
              <>
                <LogIn size={20} />
                {t('auth.signIn')}
              </>
            )}
          </button>
        </form>

        {/* Toggle to Signup */}
        <div className="mt-6 text-center">
          <p className="text-[#A0A0A0]">
            {t('auth.noAccount')}{' '}
            <button
              onClick={handleToggleForm}
              className="text-[#FAFAFA] hover:text-white font-semibold transition-colors duration-150"
            >
              {t('auth.signUp')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
