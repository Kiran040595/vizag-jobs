/** Clear legacy service workers that can serve stale index.html after deploys. */
export const unregisterLegacyServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => {
          const scriptUrl = registration.active?.scriptURL || registration.installing?.scriptURL || '';
          return /\/service-worker\.js(\?|$)/.test(scriptUrl);
        })
        .map((registration) => registration.unregister()),
    );
  } catch (error) {
    console.warn('[PWA] Could not unregister legacy service worker:', error);
  }
};

/** Reload once when a stale JS chunk fails to load after deployment. */
export const registerStaleAssetRecovery = () => {
  const reloadKey = 'vizagjobs:stale-asset-reload';

  const shouldReload = () => {
    try {
      if (sessionStorage.getItem(reloadKey) === '1') {
        return false;
      }
      sessionStorage.setItem(reloadKey, '1');
      return true;
    } catch {
      return true;
    }
  };

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    if (shouldReload()) {
      window.location.reload();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason || '');
    if (/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(message)) {
      event.preventDefault();
      if (shouldReload()) {
        window.location.reload();
      }
    }
  });
};
