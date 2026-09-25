const listeners = new Set();

export const subscribeToasts = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const pushToast = ({ message, type = 'info', durationMs = 4200 }) => {
  if (!message) {
    return;
  }

  const toast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    type,
    durationMs,
  };

  listeners.forEach((listener) => {
    listener(toast);
  });
};
