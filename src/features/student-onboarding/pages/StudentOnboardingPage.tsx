// =============================================================================
// Student Onboarding Page
// Main orchestrator for the student onboarding questionnaire flow
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useStudentOnboardingSession } from '../hooks/useStudentOnboardingSession';
import { STUDENT_ONBOARDING_QUESTIONS } from '../studentOnboardingQuestions';
import OnboardingQuestion from '../../creator-onboarding/components/OnboardingQuestion';
import StudentPreviewScreen from '../components/StudentPreviewScreen';
import StudentSummaryScreen from '../components/StudentSummaryScreen';
import StudentSignupForm from '../components/StudentSignupForm';
import type { StudentOnboardingStep, StudentOnboardingAnswers } from '../studentOnboardingTypes';

const StudentOnboardingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    session,
    answers,
    updateAnswer,
    completeSession,
    clearSession,
    getSessionData,
  } = useStudentOnboardingSession();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [step, setStep] = useState<StudentOnboardingStep>('questions');
  const [isSyncing, setIsSyncing] = useState(false);

  // If user is already logged in, redirect to courses/student home
  useEffect(() => {
    if (user && profile) {
      navigate('/courses');
    }
  }, [user, profile, navigate]);

  // Get current question (already has translation keys embedded)
  const currentQuestion = STUDENT_ONBOARDING_QUESTIONS[currentQuestionIndex];
  const totalQuestions = STUDENT_ONBOARDING_QUESTIONS.length;

  // Get current answer
  const getCurrentAnswer = useCallback(() => {
    const key = currentQuestion.id as keyof StudentOnboardingAnswers;
    return answers[key];
  }, [answers, currentQuestion]);

  // Get "other" value for questions that support it
  const getOtherValue = useCallback(() => {
    if (!currentQuestion.otherFieldId) return null;
    const otherKey = currentQuestion.otherFieldId as keyof StudentOnboardingAnswers;
    return answers[otherKey] as string | null;
  }, [answers, currentQuestion]);

  // Handle answer selection
  const handleAnswer = useCallback(
    (value: string | string[]) => {
      const key = currentQuestion.id as keyof StudentOnboardingAnswers;
      updateAnswer(key, value as any);
    },
    [currentQuestion, updateAnswer]
  );

  // Handle "other" text input
  const handleOtherChange = useCallback(
    (value: string) => {
      if (!currentQuestion.otherFieldId) return;
      const otherKey = currentQuestion.otherFieldId as keyof StudentOnboardingAnswers;
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
    async () => {
      setIsSyncing(true);
      try {
        // Clear localStorage
        clearSession();
        // Redirect to courses/student home
        navigate('/courses');
      } catch (error) {
        console.error('Error during signup completion:', error);
        clearSession();
        navigate('/courses');
      } finally {
        setIsSyncing(false);
      }
    },
    [clearSession, navigate]
  );

  // Syncing state
  if (isSyncing) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">{t('studentOnboarding.settingUp')}</p>
        </div>
      </div>
    );
  }

  // Render based on current step
  if (step === 'preview') {
    return (
      <StudentPreviewScreen
        interest={answers.interest}
        interestOther={answers.interestOther}
        onContinue={handlePreviewContinue}
      />
    );
  }

  if (step === 'summary') {
    return (
      <StudentSummaryScreen
        interest={answers.interest}
        interestOther={answers.interestOther}
        goal={answers.goal}
        challenge={answers.challenge}
        challengeOther={answers.challengeOther}
        learningStyle={answers.learningStyle}
        onCreateAccount={handleCreateAccount}
      />
    );
  }

  if (step === 'signup') {
    return (
      <StudentSignupForm
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

export default StudentOnboardingPage;
