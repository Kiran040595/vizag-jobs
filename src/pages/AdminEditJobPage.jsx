import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import AdminJobForm from '../components/admin/AdminJobForm';
import LinkCompanyModal from '../components/admin/LinkCompanyModal';
import { deserializeJobForForm, fetchAdminJobById, getAdminJobsListPath } from '../services/adminJobs';
import { fetchAdminEmployerProfiles } from '../services/adminEmployers';
import { fetchJobApplicationCounts } from '../services/jobApplications';

export default function AdminEditJobPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [employers, setEmployers] = useState([]);
  const [applicationCount, setApplicationCount] = useState(0);
  const [isLinking, setIsLinking] = useState(false);
  const [linkNotice, setLinkNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadJob = async () => {
      try {
        const [jobData, employerRows, counts] = await Promise.all([
          fetchAdminJobById(jobId),
          fetchAdminEmployerProfiles().catch(() => []),
          fetchJobApplicationCounts([jobId]).catch(() => ({})),
        ]);

        if (ignore) {
          return;
        }

        setJob(jobData);
        setEmployers(employerRows.filter((row) => row.isActive));
        setApplicationCount(counts[jobId] || 0);
        setLoadError('');
      } catch (error) {
        if (ignore) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Could not load the selected job.');
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadJob();

    return () => {
      ignore = true;
    };
  }, [jobId]);

  return (
    <AdminShell
      title="Edit existing job"
      description="Update an older listing on its own route without reopening the new-job page."
    >
      <SEO title="Edit Job | Vizag Jobs Admin" description="Edit an existing Vizag Jobs listing." canonical={`/admin/jobs/${jobId}/edit`} />

      <div className="mx-auto max-w-4xl">
        {isLoading ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
            <LoadingSpinner message="Loading job for editing..." />
          </section>
        ) : null}

        {!isLoading && loadError ? (
          <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
            {loadError}
          </section>
        ) : null}

        {linkNotice ? (
          <section className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-xs">
            {linkNotice}
          </section>
        ) : null}

        {!isLoading && job ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:px-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <path d="M9 22v-4h6v4" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Company Ownership
                  </span>
                  <p className="text-sm font-bold text-slate-900">
                    {job.created_by ? (
                      (() => {
                        const matched = employers.find(
                          (emp) => (emp.userId || emp.user_id) === job.created_by
                        );
                        return matched
                          ? `${matched.companyName} (Linked Employer)`
                          : `Employer ID: ${job.created_by.slice(0, 8)}…`;
                      })()
                    ) : (
                      <span className="text-slate-600">Admin-owned</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLinking(true)}
                className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 hover:border-violet-300 shadow-xs"
              >
                🔗 {job.created_by ? 'Reassign / Unlink Company' : 'Link with Company'}
              </button>
            </div>

            <AdminJobForm
              key={job.id}
              mode="edit"
              jobId={job.id}
              initialValues={deserializeJobForForm(job)}
              draftStorageKey={`vizagjobs:admin-edit-job-draft:${job.id}`}
              onCancel={() => navigate(getAdminJobsListPath(job))}
              onSaved={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        ) : null}

        {isLinking && job ? (
          <LinkCompanyModal
            job={job}
            employers={employers}
            applicationCount={applicationCount}
            isOpen={isLinking}
            onClose={() => setIsLinking(false)}
            onLinked={(updatedJob, message) => {
              setJob(updatedJob);
              if (message) {
                setLinkNotice(message);
              }
            }}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}
