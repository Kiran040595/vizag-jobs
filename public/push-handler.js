/* global clients */

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data?.text?.() || 'New job on Vizag Jobs' };
  }

  const title = payload.title || 'New job on Vizag Jobs';
  const dispatchId = payload.dispatchId || payload.data?.dispatchId || null;
  const jobId = payload.jobId || payload.data?.jobId || null;
  const targetUrl = payload.url || payload.linkPath || '/jobs';

  const options = {
    body: payload.body || payload.preview || 'A new job was just published.',
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/icon-192x192.png',
    tag: payload.tag || (dispatchId ? `job-alert-${dispatchId}` : 'vizag-job-alert'),
    renotify: true,
    data: {
      url: targetUrl,
      dispatchId,
      jobId,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification?.data || {};
  const targetUrl = notificationData.url || '/jobs';
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  const trackPromise = (async () => {
    try {
      if (notificationData.dispatchId || notificationData.jobId) {
        await fetch('/api/track-notification-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dispatchId: notificationData.dispatchId,
            jobId: notificationData.jobId,
          }),
        });
      }
    } catch {
      // Ignore background tracking network failure
    }
  })();

  const navigatePromise = clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate?.(absoluteUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
      return undefined;
    });

  event.waitUntil(Promise.all([trackPromise, navigatePromise]));
});
