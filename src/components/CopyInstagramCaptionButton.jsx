import { useState } from 'react';
import { copyInstagramJobCaption } from '../lib/instagramJobCaption';
import { pushToast } from '../lib/toast';

/**
 * One-click copy of Instagram reel caption + job apply link.
 */
export default function CopyInstagramCaptionButton({
  job,
  className = 'rounded-2xl border border-pink-200 bg-pink-50 px-3.5 py-2 text-xs font-semibold text-pink-800 transition hover:bg-pink-100 disabled:opacity-60',
  label = 'Copy Instagram',
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);

  if (!job?.id && !job?.slug && !job?.title) {
    return null;
  }

  const handleClick = async () => {
    if (busy || disabled) {
      return;
    }

    setBusy(true);
    try {
      await copyInstagramJobCaption(job);
      pushToast({ message: 'Instagram caption copied. Paste it into your reel.', type: 'success' });
    } catch {
      pushToast({ message: 'Could not copy. Try again.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className={className}
      title="Copy a ready-to-paste Instagram caption with the job apply link"
    >
      {busy ? 'Copying…' : label}
    </button>
  );
}
