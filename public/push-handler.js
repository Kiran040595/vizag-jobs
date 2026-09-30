/* global clients */

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data?.text?.() || 'New job on Vizag Jobs' };
  }

  const title = payload.title || 'New job on Vizag Jobs';
  const options = {
    body: payload.body || payload.preview || 'A new job was just published.',
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/icon-192x192.png',
    tag: payload.tag || 'vizag-job-alert',
    renotify: true,
    data: {
      url: payload.url || payload.linkPath || '/jobs',
      jobId: payload.jobId || null,
      dispatchId: payload.dispatchId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const rawUrl = data.url || '/jobs';
  const parsedUrl = new URL(rawUrl, self.location.origin);
  if (!parsedUrl.searchParams.get('utm_source')) {
    parsedUrl.searchParams.set('utm_source', 'web_push');
  }
  if (data.dispatchId && !parsedUrl.searchParams.get('notif_id')) {
    parsedUrl.searchParams.set('notif_id', String(data.dispatchId));
  }
  if (data.jobId && !parsedUrl.searchParams.get('job_id')) {
    parsedUrl.searchParams.set('job_id', String(data.jobId));
  }
  const absoluteUrl = parsedUrl.href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
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
    }),
  );
});

