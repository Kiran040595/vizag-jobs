import { useState } from 'react';
import { copyInstagramJobCaption } from '../lib/instagramJobCaption';
import {
  INSTAGRAM_BIO_JOBS_PATH,
  getInstagramBioJobsDisplayUrl,
} from '../lib/instagramBioJobsPath';
import { pushToast } from '../lib/toast';
import { toggleAdminJobInstagram } from '../services/adminJobs';

/**
 * One-click copy of Instagram reel caption + job apply link.
 * Also marks the job for the /jobs/latest bio page when it is not already listed.
 */
export default function CopyInstagramCaptionButton({
  job,
  className = 'rounded-2xl border border-pink-200 bg-pink-50 px-3.5 py-2 text-xs font-semibold text-pink-800 transition hover:bg-pink-100 disabled:opacity-60',
  label = 'Copy Instagram',
  disabled = false,
  onInstagramMarked,
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
      const bioUrl = getInstagramBioJobsDisplayUrl();

      const alreadyInstagram = Boolean(job.isInstagram ?? job.is_instagram);
      if (job.id && !alreadyInstagram) {
        try {
          await toggleAdminJobInstagram(job.id, true);
          onInstagramMarked?.(true);
          pushToast({
            message: `Caption copied. Job added to ${bioUrl} for your Instagram bio.`,
            type: 'success',
            durationMs: 6500,
          });
        } catch {
          pushToast({
            message: `Caption copied. Put ${bioUrl} in your bio, and tap Insta on this job if it is missing from ${INSTAGRAM_BIO_JOBS_PATH}.`,
            type: 'success',
            durationMs: 6500,
          });
        }
      } else {
        pushToast({
          message: `Caption copied. Paste into your reel. Bio link: ${bioUrl}`,
          type: 'success',
          durationMs: 5000,
        });
      }
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
      title={`Copy a ready-to-paste Instagram caption and list this job on ${INSTAGRAM_BIO_JOBS_PATH}`}
    >
      {busy ? 'Copying…' : label}
    </button>
  );
}
