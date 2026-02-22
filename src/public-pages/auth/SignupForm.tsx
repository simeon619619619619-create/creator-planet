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

  // Redirect if already authenticated - role-based redirect
  useEffect(() => {
    if (user && !success) {
      if (returnUrl) {
        navigate(decodeURIComponent(returnUrl));
      } else {
        // Role-based redirect: creators -> /dashboard, students -> /courses
        navigate(getDefaultRedirectPath(userRole));
      }
    }
  }, [user, userRole, success, returnUrl, navigate]);

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
      const { error: signUpError } = await signUp(email, password, fullName, role);

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
          <h1 className="text-2xl font-bold text-slate-900">{t('auth.joinCreatorClub')}</h1>
          <p className="text-slate-500 mt-2">{t('auth.createAccountToStart')}</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="text-green-700 text-sm font-medium">{t('auth.accountCreated')}</p>
              <p className="text-green-600 text-xs mt-1">
                {t('auth.checkEmail')}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name Field */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-2">
              {t('auth.fullName')}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={t('auth.fullNamePlaceholder')}
                disabled={isLoading}
              />
            </div>
          </div>

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

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
              {t('auth.confirmPassword')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              {t('auth.iAmA')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('creator')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  role === 'creator'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                disabled={isLoading}
              >
                <div className="font-semibold text-slate-900">{t('auth.creator')}</div>
                <div className="text-xs text-slate-500 mt-1">{t('auth.creatorDesc')}</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  role === 'student'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                disabled={isLoading}
              >
                <div className="font-semibold text-slate-900">{t('auth.student')}</div>
                <div className="text-xs text-slate-500 mt-1">{t('auth.studentDesc')}</div>
              </button>
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
          <p className="text-slate-600">
            {t('auth.alreadyHaveAccount')}{' '}
            <button
              onClick={handleToggleForm}
              className="text-indigo-500 hover:text-indigo-600 font-semibold"
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
