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

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if one exists
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
