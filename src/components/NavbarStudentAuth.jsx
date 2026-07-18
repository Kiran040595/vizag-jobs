import { Link, useLocation } from 'react-router-dom';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { buildStudentAuthPath } from '../lib/studentApplyRedirect';

const buttonBase =
  'rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2';

export default function NavbarStudentAuth({ variant = 'desktop', onNavigate }) {
  const location = useLocation();
  const { isLoading, isStudent, profile, session, signOut } = useStudentAuth();

  const returnPath = `${location.pathname}${location.search}`;
  const authQuery = buildStudentAuthPath({ pathname: returnPath });
  const loginPath = `/student/login${authQuery}`;
  const registerPath = `/student/register${authQuery}`;

  const handleNavigate = () => {
    onNavigate?.();
  };

  if (isLoading) {
    return null;
  }

  if (variant === 'mobileHeader') {
    if (session && isStudent) {
      const profileLabel = profile?.full_name?.trim() || 'Profile';
      return (
        <Link
          to="/student/profile"
          onClick={handleNavigate}
          className="max-w-[7.5rem] truncate rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-xs font-semibold text-indigo-700 sm:max-w-[10rem]"
          title={profileLabel}
        >
          {profileLabel}
        </Link>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <Link
          to={loginPath}
          onClick={handleNavigate}
          className="rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700"
        >
          Sign in
        </Link>
        <Link
          to={registerPath}
          onClick={handleNavigate}
          className="rounded-xl bg-indigo-600 px-2.5 py-2 text-xs font-semibold text-white"
        >
          Sign up
        </Link>
      </div>
    );
  }

  if (session && isStudent) {
    const profileLabel = profile?.full_name?.trim() || 'My profile';

    if (variant === 'mobile') {
      return (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3">
          <Link
            to="/student/profile"
            onClick={handleNavigate}
            className={`${buttonBase} border border-indigo-200 bg-indigo-50 text-center text-indigo-700 hover:bg-indigo-100`}
          >
            {profileLabel}
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              handleNavigate();
            }}
            className={`${buttonBase} border border-slate-200 text-center text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
          >
            Sign out
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Link
          to="/student/profile"
          className={`${buttonBase} border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
        >
          {profileLabel}
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className={`${buttonBase} border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
        >
          Sign out
        </button>
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3">
        <Link
          to={loginPath}
          onClick={handleNavigate}
          className={`${buttonBase} border border-slate-200 text-center text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
        >
          Sign in
        </Link>
        <Link
          to={registerPath}
          onClick={handleNavigate}
          className={`${buttonBase} bg-indigo-600 text-center text-white hover:bg-indigo-700`}
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        to={loginPath}
        className={`${buttonBase} border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
      >
        Sign in
      </Link>
      <Link
        to={registerPath}
        className={`${buttonBase} bg-indigo-600 text-white hover:bg-indigo-700`}
      >
        Sign up
      </Link>
    </div>
  );
}
