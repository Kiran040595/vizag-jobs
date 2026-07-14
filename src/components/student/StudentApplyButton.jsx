import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { applyButtonLabel, isInternalApplyJob } from '../../lib/jobApplyMode';
import {
  buildInternalApplyPath,
  buildStudentAuthPath,
  stashPendingApplyJobId,
  stashPendingApplyUrl,
} from '../../lib/studentApplyRedirect';

export default function StudentApplyButton({
  applyLink,
  applyMode,
  jobId,
  jobPath,
  alreadyApplied = false,
  className = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700',
  label,
}) {
  const navigate = useNavigate();
  const { isLoading, isStudent, profileComplete, session } = useStudentAuth();
  const internalApply = isInternalApplyJob({ applyMode });
  const canApply = internalApply || Boolean(applyLink);

  if (!canApply) {
    return null;
  }

  const authQuery = buildStudentAuthPath({
    pathname: jobPath,
    apply: true,
  });

  const buttonLabel =
    label || (alreadyApplied ? 'Application submitted' : applyButtonLabel({ applyMode }));

  const handleClick = () => {
    if (isLoading || alreadyApplied) {
      return;
    }

    if (session && isStudent && profileComplete) {
      if (internalApply) {
        navigate(buildInternalApplyPath(jobId, jobPath));
        return;
      }

      window.open(applyLink, '_blank', 'noopener,noreferrer');
      return;
    }

    if (internalApply) {
      stashPendingApplyJobId(jobId);
    } else {
      stashPendingApplyUrl(applyLink);
    }

    if (session && isStudent && !profileComplete) {
      navigate(`/student/profile${authQuery}`);
      return;
    }

    navigate(`/student/register${authQuery}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading || alreadyApplied}
      className={`${className}${alreadyApplied ? ' cursor-default bg-emerald-600 hover:bg-emerald-600' : ''}`}
    >
      {buttonLabel}
    </button>
  );
}
