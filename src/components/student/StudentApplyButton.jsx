import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useEmployerAuth } from '../../hooks/useEmployerAuth';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { applyButtonLabel, isInternalApplyJob } from '../../lib/jobApplyMode.js';
import { isStaffApplicantSession } from '../../lib/staffApplyAccess.js';
import {
  formatApplicationStatus,
  normalizeApplicationStatus,
} from '../../lib/applicationStatus.js';
import {
  buildInternalApplyPath,
  buildStudentAuthPath,
  openExternalApplyLink,
  stashPendingApplyJobId,
  stashPendingApplyJobMeta,
  stashPendingApplyUrl,
} from '../../lib/studentApplyRedirect.js';
import StudentAuthRequiredAlert from './StudentAuthRequiredAlert.jsx';

export default function StudentApplyButton({
  applyLink,
  isQuickJob = false,
  applyMode,
  jobId,
  jobPath,
  jobTitle = '',
  jobCompany = '',
  alreadyApplied = false,
  applicationStatus = null,
  className = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700',
  label,
}) {
  const navigate = useNavigate();
  const { isLoading, isStudent, profileComplete, session } = useStudentAuth();
  const { isAdmin } = useAdminAuth();
  const { isEmployer } = useEmployerAuth();
  const [showAuthAlert, setShowAuthAlert] = useState(false);
  const internalApply = isInternalApplyJob({ applyMode });
  const canApply = internalApply || Boolean(applyLink);
  const staffApplicant = isStaffApplicantSession({ session, isStudent, isAdmin, isEmployer });

  if (!canApply) {
    return null;
  }

  const authQuery = buildStudentAuthPath({
    pathname: jobPath,
    apply: true,
  });

  const normalizedStatus = alreadyApplied ? normalizeApplicationStatus(applicationStatus) : null;
  const appliedLabel =
    normalizedStatus === 'viewed'
      ? 'Viewed'
      : formatApplicationStatus(normalizedStatus || 'applied');

  const buttonLabel =
    label || (alreadyApplied ? appliedLabel : applyButtonLabel({ applyMode }));

  const handleClick = () => {
    if (isQuickJob) { navigate(`/apply/${jobId}`); return; }
    if (isLoading || alreadyApplied) {
      return;
    }

    if (session && isStudent && profileComplete) {
      if (internalApply) {
        navigate(buildInternalApplyPath(jobId, jobPath));
        return;
      }

      openExternalApplyLink(applyLink, { jobTitle, jobId });
      return;
    }

    // Admin/employer are already signed in — don't show the guest login modal.
    if (staffApplicant) {
      if (internalApply) {
        navigate(buildInternalApplyPath(jobId, jobPath));
        return;
      }

      openExternalApplyLink(applyLink, { jobTitle, jobId });
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
        className={`${className}${
          alreadyApplied
            ? normalizedStatus === 'viewed'
              ? ' cursor-default bg-slate-800 text-white hover:bg-slate-800 ring-2 ring-slate-400/50'
              : ' cursor-default bg-emerald-600 text-white hover:bg-emerald-600'
            : ''
        }`}
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
          onDismiss={() => setShowAuthAlert(false)}
        />
      ) : null}
    </>
  );
}
