import { Link, useLocation } from 'react-router-dom';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { buildStudentAuthPath } from '../lib/studentApplyRedirect';
import { pushToast } from '../lib/toast';

const buttonBase =
  'inline-flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2';

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

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      pushToast({ message: 'Could not sign out. Please try again.', type: 'error' });
    }
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
          className="max-w-[7.5rem] truncate rounded-xl border border-cyan-200 bg-cyan-50 px-2.5 py-2 text-xs font-semibold text-cyan-800 sm:max-w-[10rem]"
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
          className="rounded-xl bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white"
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
            className={`${buttonBase} justify-center border border-cyan-200 bg-cyan-50 text-center text-cyan-800 hover:bg-cyan-100`}
          >
            {profileLabel}
          </Link>
          <button
            type="button"
            onClick={async () => {
              await handleSignOut();
              handleNavigate();
            }}
            className={`${buttonBase} justify-center border border-slate-200 text-center text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
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
          className={`${buttonBase} border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100`}
        >
          {profileLabel}
        </Link>
        <button
          type="button"
          onClick={() => handleSignOut()}
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
          className={`${buttonBase} justify-center border border-slate-200 text-center text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
        >
          Sign in
        </Link>
        <Link
          to={registerPath}
          onClick={handleNavigate}
          className={`${buttonBase} justify-center bg-slate-900 text-center text-white hover:bg-slate-800`}
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
        className={`${buttonBase} bg-slate-900 text-white hover:bg-slate-800`}
      >
        Sign up
      </Link>
    </div>
  );
}
