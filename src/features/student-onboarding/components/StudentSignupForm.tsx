// =============================================================================
// Student Signup Form
// Embedded signup form for the student onboarding flow
// =============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle,
  BookOpen,
  Users,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../../core/contexts/AuthContext';

interface StudentSignupFormProps {
  onSignupSuccess: () => void;
  onBack: () => void;
}

const StudentSignupForm: React.FC<StudentSignupFormProps> = ({
  onSignupSuccess,
  onBack,
}) => {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (password !== confirmPassword) {
      setError(t('studentOnboarding.signup.errors.passwordsDontMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('studentOnboarding.signup.errors.passwordTooShort'));
      return;
    }

    if (!fullName.trim()) {
      setError(t('studentOnboarding.signup.errors.enterFullName'));
      return;
    }

    setIsLoading(true);

    try {
      // Sign up as student
      const { error: signUpError } = await signUp(email, password, fullName.trim(), 'student');

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess(true);
        // Call success handler after a brief delay to show success message
        setTimeout(() => {
          onSignupSuccess();
        }, 1500);
      }
    } catch (err) {
      setError(t('studentOnboarding.signup.errors.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInClick = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 flex items-center justify-center p-3">
      <div className="w-full max-w-sm">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-3 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('studentOnboarding.signup.back')}
        </button>

        {/* Main card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-5 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <User className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white">{t('studentOnboarding.signup.title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('studentOnboarding.signup.subtitle')}</p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-2">
              <CheckCircle className="text-emerald-400 mt-0.5 flex-shrink-0" size={16} />
              <div>
                <p className="text-emerald-300 text-xs font-medium">{t('studentOnboarding.signup.successTitle')}</p>
                <p className="text-emerald-400/80 text-[11px] mt-0.5">
                  {t('studentOnboarding.signup.successMessage')}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-xs font-medium text-slate-300 mb-1">
                {t('studentOnboarding.signup.fullName')}
              </label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder={t('studentOnboarding.signup.fullNamePlaceholder')}
                  disabled={isLoading || success}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1">
                {t('studentOnboarding.signup.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder={t('studentOnboarding.signup.emailPlaceholder')}
                  disabled={isLoading || success}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1">
                {t('studentOnboarding.signup.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder={t('studentOnboarding.signup.passwordPlaceholder')}
                  disabled={isLoading || success}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300 mb-1">
                {t('studentOnboarding.signup.confirmPassword')}
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder={t('studentOnboarding.signup.confirmPasswordPlaceholder')}
                  disabled={isLoading || success}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || success}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 text-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('studentOnboarding.signup.creatingAccount')}
                </>
              ) : success ? (
                <>
                  <CheckCircle size={16} />
                  {t('studentOnboarding.signup.accountCreated')}
                </>
              ) : (
                t('studentOnboarding.signup.createAccount')
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-4 text-center">
            <p className="text-slate-400 text-xs">
              {t('studentOnboarding.signup.alreadyHaveAccount')}{' '}
              <button
                onClick={handleSignInClick}
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
              >
                {t('studentOnboarding.signup.signIn')}
              </button>
            </p>
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-4 flex justify-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400/70" />
            <span>{t('studentOnboarding.signup.accessCourses')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Users className="w-3.5 h-3.5 text-emerald-400/70" />
            <span>{t('studentOnboarding.signup.joinCommunities')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Trophy className="w-3.5 h-3.5 text-emerald-400/70" />
            <span>{t('studentOnboarding.signup.earnRewards')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSignupForm;
