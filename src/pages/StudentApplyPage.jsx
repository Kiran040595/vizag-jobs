import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import StudentShell from '../components/student/StudentShell';
import StudentSessionRoute from '../components/student/StudentSessionRoute';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { fetchJobById } from '../services/jobs';
import { fetchMyApplicationForJob, formatApplicationStatus, submitJobApplication } from '../services/jobApplications';
import { getJobDetailPath } from '../lib/jobRoutes';
import { isInternalApplyJob } from '../lib/jobApplyMode';
import { displayCompanyName, displayLocation } from '../lib/jobDisplayLabels';
import { validateResumeFile } from '../services/studentResume';
import { pushToast } from '../lib/toast';
import { trackStudentFunnel } from '../lib/studentFunnelAnalytics';
import { clearPendingApplyJobMeta } from '../lib/studentApplyRedirect';
import { getJobGroupLink } from '../lib/jobGroupLink';
import ApplySuccessGroupModal from '../components/ApplySuccessGroupModal';

const INPUT_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

function StudentApplyContent() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, profileComplete } = useStudentAuth();
  const [job, setJob] = useState(null);
  const [existingApplication, setExistingApplication] = useState(null);
  const [coverNote, setCoverNote] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [useSavedResume, setUseSavedResume] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);

  const returnPath = searchParams.get('next') || (job ? getJobDetailPath(job) : '/jobs');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const [jobRow, application] = await Promise.all([
          fetchJobById(jobId),
          fetchMyApplicationForJob(jobId),
        ]);

        if (!ignore) {
          setJob(jobRow);
          setExistingApplication(application);
          setUseSavedResume(Boolean(profile?.resume_path));
          setError('');
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load this job.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [jobId, profile?.resume_path]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!profileComplete) {
      setError('Complete your student profile before applying.');
      return;
    }

    if (!isInternalApplyJob(job)) {
      setError('This job accepts applications on an external site.');
      return;
    }

    if (resumeFile) {
      const validationError = validateResumeFile(resumeFile);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await submitJobApplication({
        jobId,
        coverNote,
        resumeFile: useSavedResume ? null : resumeFile,
        existingResumePath: useSavedResume ? profile?.resume_path : null,
      });
      setNotice('Your application was submitted successfully.');
      pushToast({ message: 'Application submitted successfully.', type: 'success' });
      clearPendingApplyJobMeta();
      trackStudentFunnel('student_apply_submitted', { jobId });

      const groupLink = getJobGroupLink(job);
      if (groupLink) {
        setShowGroupModal(true);
      } else {
        setTimeout(() => {
          navigate(returnPath, { replace: true });
        }, 1200);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StudentShell
      title="Apply for job"
      description="Submit your profile for jobs posted directly on Vizag Jobs. You can optionally attach a resume."
    >
      <SEO title="Apply for job | Vizag Jobs" canonical={`/student/apply/${jobId}`} />

      <div className="mb-6">
        <Link to={returnPath} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          ← Back to job
        </Link>
      </div>

      {isLoading ? <LoadingSpinner message="Loading application form..." /> : null}

      {!isLoading && error && !job ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {!isLoading && job ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Applying for</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{job.title}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {displayCompanyName(job.company)} · {displayLocation(job.location)}
            </p>
          </section>

          {existingApplication ? (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800">
              <p>
                You already applied for this job on{' '}
                {new Date(existingApplication.submittedAt).toLocaleDateString()}.
              </p>
              <p className="mt-2 font-semibold">
                Current status: {formatApplicationStatus(existingApplication.status)}
              </p>
              <Link
                to="/student/applied-jobs"
                className="mt-3 inline-flex font-semibold text-emerald-900 underline hover:text-emerald-950"
              >
                View all applied jobs
              </Link>
            </section>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {!profileComplete ? (
                <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Complete your{' '}
                  <Link to="/student/profile" className="font-semibold underline">
                    student profile
                  </Link>{' '}
                  before applying.
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</p>
                  <p className="mt-1 text-sm text-slate-800">{profile?.full_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                  <p className="mt-1 text-sm text-slate-800">{profile?.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                  <p className="mt-1 text-sm text-slate-800">{profile?.contact_email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Education</p>
                  <p className="mt-1 text-sm text-slate-800">
                    {[profile?.degree, profile?.branch, profile?.graduation_year].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </div>

              <label className="mt-6 block">
                <span className="text-sm font-semibold text-slate-700">Cover note (optional)</span>
                <textarea
                  value={coverNote}
                  onChange={(event) => setCoverNote(event.target.value)}
                  className={`${INPUT_CLASS} min-h-[120px] resize-y`}
                  placeholder="Briefly explain why you are a good fit for this role."
                />
              </label>

              <div className="mt-6">
                <span className="text-sm font-semibold text-slate-700">Resume (optional)</span>
                {profile?.resume_path ? (
                  <label className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={useSavedResume}
                      onChange={(event) => {
                        setUseSavedResume(event.target.checked);
                        if (event.target.checked) {
                          setResumeFile(null);
                        }
                      }}
                      className="h-4 w-4"
                    />
                    Use my saved resume
                  </label>
                ) : null}
                {!useSavedResume ? (
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700"
                  />
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  PDF or Word document, up to 5 MB. You can apply without a resume if you prefer.
                </p>
              </div>

              {error ? (
                <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {notice}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !profileComplete}
                className="mt-6 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Submitting...' : 'Submit application'}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {showGroupModal && getJobGroupLink(job) ? (
        <ApplySuccessGroupModal
          jobTitle={job?.title || ''}
          jobCompany={displayCompanyName(job?.company)}
          groupLink={getJobGroupLink(job)}
          onClose={() => {
            setShowGroupModal(false);
            navigate(returnPath, { replace: true });
          }}
        />
      ) : null}
    </StudentShell>
  );
}

export default function StudentApplyPage() {
  return (
    <StudentSessionRoute>
      <StudentApplyContent />
    </StudentSessionRoute>
  );
}
