import { registerSW } from 'virtual:pwa-register';

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

/**
 * Register the Vite PWA service worker and check for updates often.
 * Mobile installed PWAs otherwise keep the old shell until a browser SW refresh
 * window (can be many hours) because they rarely hard-reload.
 */
export const registerPwaAutoUpdate = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        const checkForUpdate = () => {
          registration.update().catch(() => {});
        };

        // Installed PWAs often resume from background without a full reload.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            checkForUpdate();
          }
        });
        window.addEventListener('focus', checkForUpdate);

        // Poll while the app stays open.
        window.setInterval(checkForUpdate, 15 * 60 * 1000);
      },
    });
  } catch (error) {
    console.warn('[PWA] Could not register service worker updates:', error);
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
