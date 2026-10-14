const RECENT_ERRORS = new Set();
let sessionReportCount = 0;
const MAX_SESSION_REPORTS = 5;

// Ignore known benign browser noise / extension errors
const IGNORE_PATTERNS = [
  /ResizeObserver loop/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /^Script error\.?$/i,
];

function getErrorFingerprint(error, url) {
  const msg = error?.message || String(error || '');
  const stackTop = String(error?.stack || '').split('\n').slice(0, 2).join('|');
  return `${url}::${msg}::${stackTop}`;
}

export function shouldIgnoreError(error) {
  if (!error) return true;
  const msg = typeof error === 'string' ? error : error.message || '';
  const stack = error.stack || '';

  return IGNORE_PATTERNS.some((pattern) => pattern.test(msg) || pattern.test(stack));
}

export function reportClientError({ error, errorInfo = null, context = 'unhandled' }) {
  if (typeof window === 'undefined') return;
  if (shouldIgnoreError(error)) return;

  if (sessionReportCount >= MAX_SESSION_REPORTS) {
    return;
  }

  const currentUrl = window.location.href;
  const fingerprint = getErrorFingerprint(error, currentUrl);

  if (RECENT_ERRORS.has(fingerprint)) {
    return; // Already reported this exact error in this session
  }

  RECENT_ERRORS.add(fingerprint);
  sessionReportCount += 1;

  const payload = {
    message: error?.message || (typeof error === 'string' ? error : 'Unknown error'),
    stack: error?.stack || '',
    componentStack: errorInfo?.componentStack || '',
    context,
    url: currentUrl,
    pathname: window.location.pathname,
    userAgent: navigator.userAgent || 'unknown',
    screen: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
  };

  try {
    const jsonStr = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      navigator.sendBeacon('/api/report-error', blob);
    } else {
      fetch('/api/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr,
        keepalive: true,
      }).catch(() => {
        // Silent fail on network error reporting
      });
    }
  } catch {
    // Failsafe: never crash the reporting mechanism itself
  }
}

export function initGlobalErrorListeners() {
  if (typeof window === 'undefined') return () => {};

  const handleWindowError = (event) => {
    // Only catch true unhandled errors, not cancelled image/script loads
    if (event.error) {
      reportClientError({
        error: event.error,
        context: 'window.onerror',
      });
    } else if (event.message) {
      reportClientError({
        error: new Error(event.message),
        context: 'window.onerror_message',
      });
    }
  };

  const handleUnhandledRejection = (event) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled Promise Rejection'));
    reportClientError({
      error,
      context: 'unhandledrejection',
    });
  };

  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleWindowError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}
