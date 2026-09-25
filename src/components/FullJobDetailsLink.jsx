import { Link } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useEmployerAuth } from '../hooks/useEmployerAuth';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { buildStudentAuthPath } from '../lib/studentApplyRedirect';

/**
 * "Full Job Details" CTA — guests go to sign in / sign up with return URL;
 * signed-in students, admins, and employers open the job page directly.
 */
export default function FullJobDetailsLink({
  jobPath,
  children = 'Full Job Details',
  className = 'block w-full rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
}) {
  const { isLoading: studentLoading, isStudent, session } = useStudentAuth();
  const { isLoading: adminLoading, isAdmin } = useAdminAuth();
  const { isLoading: employerLoading, isEmployer } = useEmployerAuth();

  const isLoading = studentLoading || adminLoading || employerLoading;
  const canViewFullDetails = isAdmin || isEmployer || (Boolean(session) && isStudent);

  const targetPath =
    canViewFullDetails || isLoading
      ? jobPath
      : `/student/login${buildStudentAuthPath({ pathname: jobPath })}`;

  return (
    <Link to={targetPath} className={className}>
      {children}
    </Link>
  );
}
