import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { checkAndTrackNotificationClick } from '../lib/notificationClickTracker';

/**
 * Automatically scrolls window to top on route navigation.
 * Essential for mobile SPA navigation where browser retains scroll position.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Avoid resetting if there is an in-page hash anchor (e.g. #faq)
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
    void checkAndTrackNotificationClick();
  }, [pathname, search]);

  return null;
}

