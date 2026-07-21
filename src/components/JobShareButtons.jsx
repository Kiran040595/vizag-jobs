import { useCallback, useMemo, useState } from 'react';
import { getJobDetailPath } from '../lib/jobRoutes';
import { toAbsoluteUrl } from '../lib/site';
import { displayCompanyName, displayLocation } from '../lib/jobDisplayLabels';
import { buildInstagramJobCaption } from '../lib/instagramJobCaption';
import { pushToast } from '../lib/toast';

const buildSharePayload = (job = {}) => {
  const path = getJobDetailPath(job);
  const url = toAbsoluteUrl(path);
  const company = displayCompanyName(job.company);
  const location = displayLocation(job.location);
  const title = `${job.title} at ${company}`;
  const text = `Check out this job opening: ${title} in ${location}. Apply here:`;
  const fullMessage = `${text} ${url}`;

  return { url, title, text, fullMessage };
};

const ShareButton = ({ children, label, href, onClick, accent = 'default' }) => {
  const accentClasses = {
    whatsapp: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
    telegram: 'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100',
    copy: 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
    default: 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  };

  const className = `inline-flex h-10 w-10 items-center justify-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 ${accentClasses[accent]}`;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
        aria-label={label}
        title={label}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label} title={label}>
      {children}
    </button>
  );
};

export default function JobShareButtons({ job }) {
  const [copyStatus, setCopyStatus] = useState('idle');
  const { url, title, text, fullMessage } = useMemo(() => buildSharePayload(job), [job]);

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullMessage);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }

    window.setTimeout(() => setCopyStatus('idle'), 2200);
  }, [fullMessage]);

  const handleCopyInstagram = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildInstagramJobCaption(job));
      pushToast({
        message: 'Caption copied. Use Link in bio: jobsinvizag.in/ig (mark job as Insta in admin).',
        type: 'success',
        durationMs: 6500,
      });
    } catch {
      pushToast({ message: 'Could not copy. Try again.', type: 'error' });
    }
  }, [job]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ title, text, url });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        handleCopy();
      }
    }
  }, [title, text, url, handleCopy]);

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  const copyLabel =
    copyStatus === 'copied' ? 'Link copied!' : copyStatus === 'error' ? 'Copy failed' : 'Copy link';

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Share this job">
      {canNativeShare ? (
        <ShareButton label="Share job" onClick={handleNativeShare}>
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5 15.4 17.5" />
            <path d="M15.4 6.5 8.6 10.5" />
          </svg>
        </ShareButton>
      ) : null}

      <ShareButton label="Share on WhatsApp" href={whatsappUrl} accent="whatsapp">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      </ShareButton>

      <ShareButton label="Share on Telegram" href={telegramUrl} accent="telegram">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      </ShareButton>

      <ShareButton label="Copy Instagram caption" onClick={handleCopyInstagram} accent="copy">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
          <path d="M7.5 2A5.5 5.5 0 0 0 2 7.5v9A5.5 5.5 0 0 0 7.5 22h9a5.5 5.5 0 0 0 5.5-5.5v-9A5.5 5.5 0 0 0 16.5 2h-9zm0 2h9A3.5 3.5 0 0 1 20 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5v-9A3.5 3.5 0 0 1 7.5 4zm9.25 1.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
        </svg>
      </ShareButton>

      <ShareButton label={copyLabel} onClick={handleCopy} accent="copy">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </ShareButton>
    </div>
  );
}
