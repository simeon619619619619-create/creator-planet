// =============================================================================
// useStudentOnboardingSession Hook
// Manages student onboarding session state with localStorage persistence
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import type {
  StudentOnboardingSession,
  StudentOnboardingAnswers,
} from '../studentOnboardingTypes';
import { getEmptyAnswers, generateSessionId } from '../studentOnboardingQuestions';

const STORAGE_KEY = 'student_onboarding_session';

const createNewSession = (): StudentOnboardingSession => ({
  sessionId: generateSessionId(),
  startedAt: new Date().toISOString(),
  answers: getEmptyAnswers(),
  completedAt: null,
});

export const useStudentOnboardingSession = () => {
  const [session, setSession] = useState<StudentOnboardingSession>(() => {
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as StudentOnboardingSession;
          // If session is older than 24 hours, start fresh
          const sessionAge = Date.now() - new Date(parsed.startedAt).getTime();
          if (sessionAge < 24 * 60 * 60 * 1000) {
            return parsed;
          }
        } catch {
          // Invalid stored data, start fresh
        }
      }
    }
    return createNewSession();
  });

  // Persist to localStorage on changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  // Update a single answer
  const updateAnswer = useCallback(
    <K extends keyof StudentOnboardingAnswers>(
      key: K,
      value: StudentOnboardingAnswers[K]
    ) => {
      setSession(prev => ({
        ...prev,
        answers: {
          ...prev.answers,
          [key]: value,
        },
      }));
    },
    []
  );

  // Update multiple answers at once
  const updateAnswers = useCallback(
    (updates: Partial<StudentOnboardingAnswers>) => {
      setSession(prev => ({
        ...prev,
        answers: {
          ...prev.answers,
          ...updates,
        },
      }));
    },
    []
  );

  // Mark session as completed
  const completeSession = useCallback(() => {
    setSession(prev => ({
      ...prev,
      completedAt: new Date().toISOString(),
    }));
  }, []);

  // Clear session (after successful signup)
  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(createNewSession());
  }, []);

  // Get flattened session data for API submission
  const getSessionData = useCallback(() => {
    return {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      ...session.answers,
    };
  }, [session]);

  return {
    session,
    answers: session.answers,
    sessionId: session.sessionId,
    updateAnswer,
    updateAnswers,
    completeSession,
    clearSession,
    getSessionData,
  };
};
