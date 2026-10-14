import { useEffect, useRef } from 'react';

/** Native dialog provides focus containment and makes the background inert. */
export function useNativeModal(open) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);
  return ref;
}
