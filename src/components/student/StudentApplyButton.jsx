import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { applyButtonLabel, isInternalApplyJob } from '../../lib/jobApplyMode';
import {
  buildInternalApplyPath,
  buildStudentAuthPath,
  stashPendingApplyJobId,
  stashPendingApplyJobMeta,
  stashPendingApplyUrl,
} from '../../lib/studentApplyRedirect';
import StudentAuthRequiredAlert from './StudentAuthRequiredAlert';

export default function StudentApplyButton({
  applyLink,
  applyMode,
  jobId,
  jobPath,
  jobTitle = '',
  jobCompany = '',
  alreadyApplied = false,
  className = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700',
  label,
}) {
  const navigate = useNavigate();
  const { isLoading, isStudent, profileComplete, session } = useStudentAuth();
  const [showAuthAlert, setShowAuthAlert] = useState(false);
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
    label || (alreadyApplied ? 'Applied' : applyButtonLabel({ applyMode }));

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

    stashPendingApplyJobMeta({
      jobId,
      title: jobTitle,
      company: jobCompany,
      jobPath,
    });

    if (session && isStudent && !profileComplete) {
      navigate(`/student/profile${authQuery}`);
      return;
    }

    setShowAuthAlert(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || alreadyApplied}
        className={`${className}${alreadyApplied ? ' cursor-default bg-emerald-600 hover:bg-emerald-600' : ''}`}
      >
        {buttonLabel}
      </button>

      {showAuthAlert ? (
        <StudentAuthRequiredAlert
          returnPath={jobPath}
          jobTitle={jobTitle}
          jobCompany={jobCompany}
          intent="apply"
          source="apply_button"
          apply
        />
      ) : null}
    </>
  );
}
