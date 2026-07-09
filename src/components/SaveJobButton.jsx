import BookmarkIcon from './BookmarkIcon';
import { useSavedJob } from '../lib/useSavedJob';

const VARIANT_CLASSES = {
  card: {
    base: 'absolute right-3 top-3 z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 sm:right-4 sm:top-4',
    saved: 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100',
    unsaved: 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-slate-100 hover:text-blue-600',
  },
  detail: {
    base: 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 sm:px-4',
    saved: 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100',
    unsaved: 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  },
};

export default function SaveJobButton({
  jobId,
  jobSnapshot,
  jobTitle = 'this job',
  variant = 'card',
  className = '',
}) {
  const { saved, toggle } = useSavedJob(jobId, jobSnapshot);
  const styles = VARIANT_CLASSES[variant] || VARIANT_CLASSES.card;
  const label = saved ? `Remove ${jobTitle} from saved jobs` : `Save ${jobTitle}`;
  const title = saved ? 'Saved — click to remove' : 'Save job for later';

  return (
    <button
      type="button"
      onClick={toggle}
      className={`${styles.base} ${saved ? styles.saved : styles.unsaved} ${className}`}
      aria-label={label}
      aria-pressed={saved}
      title={title}
    >
      <BookmarkIcon filled={saved} className={variant === 'detail' ? 'h-4.5 w-4.5' : 'h-5 w-5'} />
      {variant === 'detail' ? <span>{saved ? 'Saved' : 'Save job'}</span> : null}
    </button>
  );
}
