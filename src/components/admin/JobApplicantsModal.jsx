import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  fetchJobApplications,
  getApplicationResumeUrl,
} from '../../services/jobApplications';
import { fetchJobApplyClicks } from '../../services/jobApplyClicks';
import { formatApplicationStatus } from '../../lib/applicationStatus';
import PhoneDialLink from '../PhoneDialLink';
import WhatsAppContactLink from '../WhatsAppContactLink';
import LoadingSpinner from '../LoadingSpinner';

const CloseIcon = () => (
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const UserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5 text-indigo-600"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MailIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 shrink-0 text-slate-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const PhoneIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 shrink-0 text-slate-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const DocumentIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const STATUS_BADGE_CLASSES = {
  submitted: 'border-blue-200 bg-blue-50 text-blue-700',
  viewed: 'border-amber-200 bg-amber-50 text-amber-700',
  shortlisted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  withdrawn: 'border-slate-200 bg-slate-100 text-slate-600',
  external_click: 'border-cyan-200 bg-cyan-50 text-cyan-800',
};

export default function JobApplicantsModal({
  jobId,
  jobTitle = 'Job',
  companyName = '',
  isOpen = false,
  onClose,
}) {
  const [applicants, setApplicants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingResumeId, setOpeningResumeId] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !jobId) return undefined;

    let ignore = false;
    setIsLoading(true);
    setError('');

    const loadApplicants = async () => {
      try {
        // Load both on-platform applications and unique external apply clicks
        const [rows, clicks] = await Promise.all([
          fetchJobApplications(jobId).catch((err) => {
            console.warn('Could not fetch internal applications:', err);
            return [];
          }),
          fetchJobApplyClicks(jobId).catch((err) => {
            console.warn('Could not fetch external apply clicks:', err);
            return [];
          }),
        ]);

        // Collect all user IDs to look up student profiles
        const appUserIds = rows.map((app) => app.studentUserId).filter(Boolean);
        const clickUserIds = clicks.map((c) => c.user_id).filter(Boolean);
        const allUserIds = Array.from(new Set([...appUserIds, ...clickUserIds]));

        let profileMap = new Map();
        if (allUserIds.length > 0 && supabase) {
          const { data: profiles, error: profileErr } = await supabase
            .from('student_profiles')
            .select('user_id, full_name, phone, contact_email, college, degree, branch, graduation_year')
            .in('user_id', allUserIds);

          if (!profileErr && Array.isArray(profiles)) {
            profileMap = new Map(profiles.map((p) => [p.user_id, p]));
          }
        }

        // 1. Format on-platform applications
        const formattedApps = rows.map((app) => {
          const snapshot = app.profileSnapshot || {};
          const live = profileMap.get(app.studentUserId);
          return {
            id: app.id,
            isExternal: false,
            fullName: snapshot.fullName || live?.full_name || 'Student Applicant',
            phone: snapshot.phone || live?.phone || '',
            email: snapshot.contactEmail || live?.contact_email || '',
            education: [
              snapshot.degree || live?.degree,
              snapshot.branch || live?.branch,
              snapshot.graduationYear || live?.graduation_year,
            ]
              .filter(Boolean)
              .join(' · '),
            college: snapshot.college || live?.college || '',
            status: app.status,
            resumePath: app.resumePath,
            submittedAt: app.submittedAt,
            coverNote: app.coverNote || '',
            rawApplication: app,
          };
        });

        // 2. Format external apply clicks (deduplicating users who also submitted an on-platform application)
        const appliedUserIds = new Set(appUserIds);
        const formattedClicks = clicks
          .filter((c) => !c.user_id || !appliedUserIds.has(c.user_id))
          .map((click) => {
            const live = click.user_id ? profileMap.get(click.user_id) : null;
            const isRegistered = Boolean(click.user_id);
            return {
              id: click.id,
              isExternal: true,
              fullName: live?.full_name || (isRegistered ? 'Registered Student' : 'External Visitor'),
              phone: live?.phone || '',
              email: live?.contact_email || '',
              education: [live?.degree, live?.branch, live?.graduation_year]
                .filter(Boolean)
                .join(' · '),
              college: live?.college || '',
              status: 'external_click',
              resumePath: null,
              submittedAt: click.created_at,
              coverNote: isRegistered
                ? 'Clicked Apply (Redirected to official/company application link)'
                : 'Anonymous visitor clicked Apply (Redirected to official application link)',
              rawApplication: null,
            };
          });

        const combined = [...formattedApps, ...formattedClicks];

        if (!ignore) {
          setApplicants(combined);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load applicant records.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadApplicants();

    return () => {
      ignore = true;
    };
  }, [isOpen, jobId]);

  if (!isOpen) return null;

  const handleResumeClick = async (application) => {
    if (!application) return;
    try {
      setOpeningResumeId(application.id);
      const url = await getApplicationResumeUrl(application);
      if (!url) {
        throw new Error('Resume file not available.');
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (resumeErr) {
      alert(resumeErr instanceof Error ? resumeErr.message : 'Could not open resume.');
    } finally {
      setOpeningResumeId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="applicants-modal-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
                <UserIcon />
              </span>
              <h2
                id="applicants-modal-title"
                className="truncate text-base font-bold text-slate-900 sm:text-lg"
              >
                Applicants for {jobTitle}
              </h2>
            </div>
            {companyName ? (
              <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
                {companyName}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Close dialog"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {isLoading ? (
            <div className="py-12">
              <LoadingSpinner message="Loading applicant details…" />
            </div>
          ) : error ? (
            <div className="my-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center">
              <p className="text-sm font-semibold text-rose-700">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsLoading(true);
                  fetchJobApplications(jobId)
                    .then(setApplicants)
                    .catch((e) => setError(e.message))
                    .finally(() => setIsLoading(false));
                }}
                className="mt-3 inline-flex rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Retry
              </button>
            </div>
          ) : applicants.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <UserIcon />
              </div>
              <p className="text-base font-bold text-slate-800">No applicant records found yet</p>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                When students apply on VizagJobs or click to apply externally, their contact details will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {applicants.length} {applicants.length === 1 ? 'Applicant / Click' : 'Applicants / Clicks'}
                </span>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Admin View
                </span>
              </div>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {applicants.map((item) => {
                  const statusClass =
                    STATUS_BADGE_CLASSES[item.status] ||
                    'border-slate-200 bg-slate-50 text-slate-700';

                  const statusLabel =
                    item.status === 'external_click'
                      ? 'External Apply Click'
                      : formatApplicationStatus(item.status);

                  return (
                    <article key={item.id} className="p-4 transition hover:bg-slate-50/60 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-slate-950 sm:text-lg">
                            {item.fullName}
                          </h3>
                          {item.education || item.college ? (
                            <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
                              {[item.education, item.college].filter(Boolean).join(' | ')}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {/* Contact Info: Phone and Email */}
                      <div className="mt-3 grid gap-2.5 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                        {/* Phone */}
                        <div className="flex items-center justify-between gap-2 sm:justify-start">
                          <div className="flex min-w-0 items-center gap-2">
                            <PhoneIcon />
                            <div className="min-w-0">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Phone / WhatsApp
                              </span>
                              {item.phone ? (
                                <a
                                  href={`tel:${item.phone}`}
                                  className="truncate text-sm font-semibold text-slate-800 hover:text-blue-600 hover:underline"
                                >
                                  {item.phone}
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Not provided</span>
                              )}
                            </div>
                          </div>
                          {item.phone ? (
                            <div className="flex shrink-0 items-center gap-1.5">
                              <PhoneDialLink phone={item.phone} className="!h-7 !w-7" />
                              <WhatsAppContactLink phone={item.phone} className="!h-7 !w-7" />
                            </div>
                          ) : null}
                        </div>

                        {/* Email */}
                        <div className="flex min-w-0 items-center gap-2">
                          <MailIcon />
                          <div className="min-w-0">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Email Address
                            </span>
                            {item.email ? (
                              <a
                                href={`mailto:${item.email}`}
                                className="block truncate text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                                title={item.email}
                              >
                                {item.email}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Not provided</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Info: Cover Note & Resume */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        {item.resumePath && item.rawApplication ? (
                          <button
                            type="button"
                            onClick={() => handleResumeClick(item.rawApplication)}
                            disabled={openingResumeId === item.rawApplication.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                          >
                            <DocumentIcon />
                            <span>
                              {openingResumeId === item.rawApplication.id ? 'Opening…' : 'View Resume'}
                            </span>
                          </button>
                        ) : null}

                        {item.submittedAt ? (
                          <span className="text-xs text-slate-400">
                            {item.isExternal ? 'Clicked Apply on ' : 'Applied on '}
                            {new Date(item.submittedAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        ) : null}
                      </div>

                      {item.coverNote ? (
                        <div className="mt-2.5 rounded-lg border border-slate-100 bg-white p-2.5 text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">Note: </span>
                          <span className="whitespace-pre-wrap">{item.coverNote}</span>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 sm:px-6">
          <Link
            to={`/admin/jobs/${jobId}/applications`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            Open full application management page →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
