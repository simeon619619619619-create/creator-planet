import { useState, useCallback, useEffect } from 'react';
import type { OnboardingSession, OnboardingAnswers } from '../onboardingTypes';

const STORAGE_KEY = 'creator_onboarding_session';

// Generate a unique session ID
const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `onb_${timestamp}${randomPart}`;
};

// Create initial empty answers
const createEmptyAnswers = (): OnboardingAnswers => ({
  niche: null,
  nicheOther: null,
  stage: null,
  audienceSize: null,
  painPoint: null,
  painPointOther: null,
  goal: null,
  currentTools: [],
  revenueGoal: null,
});

// Create a new session
const createNewSession = (): OnboardingSession => ({
  sessionId: generateSessionId(),
  startedAt: new Date().toISOString(),
  answers: createEmptyAnswers(),
  completedAt: null,
});

export const useOnboardingSession = () => {
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OnboardingSession;
        setSession(parsed);
      } else {
        // Create new session
        const newSession = createNewSession();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
        setSession(newSession);
      }
    } catch (err) {
      console.error('Error loading onboarding session:', err);
      // Create new session on error
      const newSession = createNewSession();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save session to localStorage
  const saveSession = useCallback((updatedSession: OnboardingSession) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
      setSession(updatedSession);
    } catch (err) {
      console.error('Error saving onboarding session:', err);
    }
  }, []);

  // Update a single answer
  const updateAnswer = useCallback(
    <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
      if (!session) return;

      const updatedSession: OnboardingSession = {
        ...session,
        answers: {
          ...session.answers,
          [key]: value,
        },
      };
      saveSession(updatedSession);
    },
    [session, saveSession]
  );

  // Update multiple answers at once
  const updateAnswers = useCallback(
    (updates: Partial<OnboardingAnswers>) => {
      if (!session) return;

      const updatedSession: OnboardingSession = {
        ...session,
        answers: {
          ...session.answers,
          ...updates,
        },
      };
      saveSession(updatedSession);
    },
    [session, saveSession]
  );

  // Mark session as completed
  const completeSession = useCallback(() => {
    if (!session) return;

    const updatedSession: OnboardingSession = {
      ...session,
      completedAt: new Date().toISOString(),
    };
    saveSession(updatedSession);
  }, [session, saveSession]);

  // Reset session (start fresh)
  const resetSession = useCallback(() => {
    const newSession = createNewSession();
    saveSession(newSession);
  }, [saveSession]);

  // Clear session from localStorage (after successful signup)
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
    } catch (err) {
      console.error('Error clearing onboarding session:', err);
    }
  }, []);

  // Get session data for API submission
  const getSessionData = useCallback(() => {
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      ...session.answers,
    };
  }, [session]);

  return {
    session,
    isLoading,
    updateAnswer,
    updateAnswers,
    completeSession,
    resetSession,
    clearSession,
    getSessionData,
  };
};

export default useOnboardingSession;
