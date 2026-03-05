import { useState, useEffect, useCallback } from 'react';
import type { NotificationPreferences } from '../notificationPreferencesService';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../notificationPreferencesService';

interface UseNotificationPreferencesReturn {
  prefs: NotificationPreferences | null;
  isLoading: boolean;
  isSaving: boolean;
  updatePreference: (key: keyof NotificationPreferences, value: boolean) => Promise<void>;
}

export function useNotificationPreferences(
  profileId: string | undefined
): UseNotificationPreferencesReturn {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    getNotificationPreferences(profileId).then((data) => {
      setPrefs(data);
      setIsLoading(false);
    });
  }, [profileId]);

  const updatePreference = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      if (!profileId || !prefs) return;

      // Optimistic update
      setPrefs((prev) => (prev ? { ...prev, [key]: value } : null));
      setIsSaving(true);

      const success = await updateNotificationPreferences(profileId, { [key]: value });
      if (!success) {
        // Revert on failure
        setPrefs((prev) => (prev ? { ...prev, [key]: !value } : null));
      }

      setIsSaving(false);
    },
    [profileId, prefs]
  );

  return { prefs, isLoading, isSaving, updatePreference };
}
