import { supabase } from '../../core/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker?.ready;
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(profileId: string): Promise<boolean> {
  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const keys = subscription.toJSON();
    const endpoint = subscription.endpoint;

    // Remove any existing subscriptions for this endpoint (other accounts on shared browser)
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .neq('profile_id', profileId);

    // Upsert the subscription for this user
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        profile_id: profileId,
        endpoint,
        p256dh: keys.keys?.p256dh ?? '',
        auth: keys.keys?.auth ?? '',
        user_agent: navigator.userAgent,
      },
      { onConflict: 'profile_id,endpoint' }
    );

    if (error) {
      console.error('Failed to save push subscription:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(profileId: string): Promise<boolean> {
  try {
    const subscription = await getExistingSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;

      // Unsubscribe from browser first (source of truth)
      await subscription.unsubscribe();

      // Then clean up DB record
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('profile_id', profileId)
        .eq('endpoint', endpoint);

      if (error) {
        console.error('Failed to delete push subscription from DB:', error);
      }
    }
    return true;
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
    return false;
  }
}
