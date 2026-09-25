import { NavLink } from 'react-router-dom';
import { useAppliedJobsCount } from '../hooks/useAppliedJobsCount';
import { APPLIED_JOBS_PATH } from '../lib/studentAppliedJobsPath';

const getDesktopClassName = ({ isActive }) =>
  `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`;

const getMobileClassName = ({ isActive }) =>
  `inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700 hover:bg-slate-50 hover:text-cyan-600'
  }`;

export default function NavbarAppliedJobsLink({ variant = 'desktop', onClick }) {
  const count = useAppliedJobsCount();

  return (
    <NavLink
      to={APPLIED_JOBS_PATH}
      onClick={onClick}
      className={variant === 'mobile' ? getMobileClassName : getDesktopClassName}
    >
      <span>Applied Jobs</span>
      {count > 0 ? (
        <span className="rounded-full bg-cyan-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-950">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </NavLink>
  );
}
