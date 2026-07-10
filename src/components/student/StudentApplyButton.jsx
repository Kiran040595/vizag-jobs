import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { buildStudentAuthPath, stashPendingApplyUrl } from '../../lib/studentApplyRedirect';

export default function StudentApplyButton({
  applyLink,
  jobPath,
  className = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700',
  label = 'Apply Now',
}) {
  const navigate = useNavigate();
  const { isLoading, isStudent, profileComplete, session } = useStudentAuth();

  if (!applyLink) {
    return null;
  }

  const authQuery = buildStudentAuthPath({
    pathname: jobPath,
    apply: true,
  });

  const handleClick = () => {
    if (isLoading) {
      return;
    }

    if (session && isStudent && profileComplete) {
      window.open(applyLink, '_blank', 'noopener,noreferrer');
      return;
    }

    stashPendingApplyUrl(applyLink);

    if (session && isStudent && !profileComplete) {
      navigate(`/student/profile${authQuery}`);
      return;
    }

    navigate(`/student/register${authQuery}`);
  };

  return (
    <button type="button" onClick={handleClick} disabled={isLoading} className={className}>
      {label}
    </button>
  );
}
