import { useEffect, useState } from 'react';
import { subscribeToasts } from '../lib/toast';

const TYPE_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-slate-200 bg-white text-slate-800',
};

export default function ToastViewport() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      setToasts((current) => [...current, toast]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, toast.durationMs || 4200);
    });
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[70] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
