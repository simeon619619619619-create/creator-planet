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
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      {/* Language Switcher - Fixed top right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher variant="minimal" className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg" />
      </div>
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo variant="dark" size="lg" showText={false} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('auth.welcomeBack')}</h1>
          <p className="text-slate-500 mt-2">{t('auth.signInTo')}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              {t('auth.emailAddress')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={t('auth.emailPlaceholder')}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
          <p className="text-slate-600">
            {t('auth.noAccount')}{' '}
            <button
              onClick={handleToggleForm}
              className="text-indigo-500 hover:text-indigo-600 font-semibold"
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
