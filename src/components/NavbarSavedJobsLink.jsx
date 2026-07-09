import { Link } from 'react-router-dom';
import { useSavedJobsList } from '../lib/useSavedJob';
import BookmarkIcon from './BookmarkIcon';

export default function NavbarSavedJobsLink({ className = '', onClick }) {
  const savedJobs = useSavedJobsList();
  const count = savedJobs.length;

  return (
    <Link
      to="/saved-jobs"
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 ${className}`}
      aria-label={count > 0 ? `Saved jobs (${count})` : 'Saved jobs'}
      title="Saved jobs"
    >
      <BookmarkIcon filled={count > 0} />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-slate-950">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  );
}
