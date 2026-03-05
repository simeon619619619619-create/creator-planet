// Founders Club Push Notification Service Worker

self.addEventListener('push', (event) => {
  let data = { title: 'Founders Club', body: 'You have a new notification', url: '/' };

  try {
    data = event.data.json();
  } catch (e) {
    // fallback to defaults
  }

  const options = {
    body: data.body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.type || 'default',
    renotify: true,
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/';

  // Only allow same-origin or relative URLs (prevent open-redirect)
  let targetUrl;
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    if (parsed.origin !== self.location.origin) {
      targetUrl = '/';
    } else {
      targetUrl = parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    targetUrl = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// Handle subscription expiry/rotation
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((newSub) => {
        // Re-registration handled on next app visit via usePushNotifications hook
        return newSub;
      })
  );
});
