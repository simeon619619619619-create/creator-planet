import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useOnboardingSession } from '../hooks/useOnboardingSession';
import { onboardingQuestions } from '../onboardingQuestions';
import { syncOnboardingData } from '../onboardingService';
import OnboardingQuestion from '../components/OnboardingQuestion';
import PreviewScreen from '../components/PreviewScreen';
import SummaryScreen from '../components/SummaryScreen';
import InlineSignupForm from '../components/InlineSignupForm';
import type { OnboardingStep, OnboardingAnswers } from '../onboardingTypes';

const CreatorOnboardingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    session,
    isLoading: sessionLoading,
    updateAnswer,
    completeSession,
    clearSession,
    getSessionData,
  } = useOnboardingSession();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [step, setStep] = useState<OnboardingStep>('questions');
  const [isSyncing, setIsSyncing] = useState(false);

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user && profile) {
      navigate('/dashboard');
    }
  }, [user, profile, navigate]);

  // Get current question
  const currentQuestion = onboardingQuestions[currentQuestionIndex];
  const totalQuestions = onboardingQuestions.length;

  // Get current answer for the question
  const getCurrentAnswer = useCallback(() => {
    if (!session) return null;
    const key = currentQuestion.id as keyof OnboardingAnswers;
    const answer = session.answers[key];
    return answer;
  }, [session, currentQuestion]);

  // Get "other" value for questions that support it
  const getOtherValue = useCallback(() => {
    if (!session || !currentQuestion.otherFieldId) return null;
    const otherKey = currentQuestion.otherFieldId as keyof OnboardingAnswers;
    return session.answers[otherKey] as string | null;
  }, [session, currentQuestion]);

  // Handle answer selection
  const handleAnswer = useCallback(
    (value: string | string[]) => {
      const key = currentQuestion.id as keyof OnboardingAnswers;
      updateAnswer(key, value as any);
    },
    [currentQuestion, updateAnswer]
  );

  // Handle "other" text input
  const handleOtherChange = useCallback(
    (value: string) => {
      if (!currentQuestion.otherFieldId) return;
      const otherKey = currentQuestion.otherFieldId as keyof OnboardingAnswers;
      updateAnswer(otherKey, value as any);
    },
    [currentQuestion, updateAnswer]
  );

  // Navigate to next question or screen
  const handleNext = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Questions complete, go to preview
      completeSession();
      setStep('preview');
    }
  }, [currentQuestionIndex, totalQuestions, completeSession]);

  // Navigate to previous question
  const handleBack = useCallback(() => {
    if (step === 'signup') {
      setStep('summary');
    } else if (step === 'summary') {
      setStep('preview');
    } else if (step === 'preview') {
      setStep('questions');
      setCurrentQuestionIndex(totalQuestions - 1);
    } else if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [step, currentQuestionIndex, totalQuestions]);

  // Handle preview continue
  const handlePreviewContinue = useCallback(() => {
    setStep('summary');
  }, []);

  // Handle create account button
  const handleCreateAccount = useCallback(() => {
    setStep('signup');
  }, []);

  // Handle successful signup
  const handleSignupSuccess = useCallback(
    async (newUser: any) => {
      setIsSyncing(true);
      try {
        // Get session data and sync to database
        const sessionData = getSessionData();
        if (sessionData) {
          await syncOnboardingData(sessionData);
        }
        // Clear localStorage
        clearSession();
        // Redirect to dashboard
        navigate('/dashboard');
      } catch (error) {
        console.error('Error syncing onboarding data:', error);
        // Still navigate even if sync fails - we can retry later
        clearSession();
        navigate('/dashboard');
      } finally {
        setIsSyncing(false);
      }
    },
    [getSessionData, clearSession, navigate]
  );

  // Loading state
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Syncing state
  if (isSyncing) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">{t('onboarding.settingUp')}</p>
        </div>
      </div>
    );
  }

  // Render based on current step
  if (step === 'preview') {
    return (
      <PreviewScreen
        niche={session?.answers.niche || null}
        nicheOther={session?.answers.nicheOther || null}
        onContinue={handlePreviewContinue}
      />
    );
  }

  if (step === 'summary') {
    return (
      <SummaryScreen
        niche={session?.answers.niche || null}
        nicheOther={session?.answers.nicheOther || null}
        goal={session?.answers.goal || null}
        painPoint={session?.answers.painPoint || null}
        painPointOther={session?.answers.painPointOther || null}
        currentTools={session?.answers.currentTools || []}
        onCreateAccount={handleCreateAccount}
      />
    );
  }

  if (step === 'signup') {
    return (
      <InlineSignupForm
        onSignupSuccess={handleSignupSuccess}
        onBack={handleBack}
      />
    );
  }

  // Questions step
  return (
    <OnboardingQuestion
      question={currentQuestion}
      currentAnswer={getCurrentAnswer()}
      otherValue={getOtherValue()}
      onAnswer={handleAnswer}
      onOtherChange={handleOtherChange}
      onNext={handleNext}
      onBack={handleBack}
      canGoBack={currentQuestionIndex > 0}
      questionNumber={currentQuestionIndex + 1}
      totalQuestions={totalQuestions}
    />
  );
};

export default CreatorOnboardingPage;
