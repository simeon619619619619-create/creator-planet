import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  getPushPermissionState,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  registerServiceWorker,
} from '../pushService';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

export function usePushNotifications(profileId: string | undefined): UsePushNotificationsReturn {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getPushPermissionState()
  );

  const isSupported = isPushSupported();

  useEffect(() => {
    if (!isSupported || !profileId) {
      setIsLoading(false);
      return;
    }

    // Register SW on mount
    registerServiceWorker();

    // Check existing subscription
    getExistingSubscription().then((sub) => {
      setIsSubscribed(!!sub);
      setIsLoading(false);
    });
  }, [isSupported, profileId]);

  const subscribe = useCallback(async () => {
    if (!profileId) return false;
    setIsLoading(true);
    const success = await subscribeToPush(profileId);
    if (success) {
      setIsSubscribed(true);
      setPermission('granted');
    } else {
      setPermission(getPushPermissionState());
    }
    setIsLoading(false);
    return success;
  }, [profileId]);

  const unsubscribe = useCallback(async () => {
    if (!profileId) return false;
    setIsLoading(true);
    const success = await unsubscribeFromPush(profileId);
    if (success) {
      setIsSubscribed(false);
    }
    setIsLoading(false);
    return success;
  }, [profileId]);

  return { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe };
}
