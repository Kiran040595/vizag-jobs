import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchJobApplications,
  getApplicationResumeUrl,
} from '../../services/jobApplications';
import {
  fetchJobApplyClicks,
  fetchStudentProfileRowsByUserIds,
} from '../../services/jobApplyClicks';
import {
  formatApplicationStatus,
  getApplicationStatusStyle,
} from '../../lib/applicationStatus';
import { mapStudentProfileRow } from '../../lib/adminStudentProfile';
import { mergeApplicationsWithApplyClicks } from '../../lib/applyClickExport';
import { buildInterviewWhatsAppPassUrl } from '../../lib/whatsappContact';
import ApplicationExportDialog from '../jobApplications/ApplicationExportDialog';
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

const CalendarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5 text-purple-700 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);



export default function JobApplicantsModal({
  jobId,
  jobTitle = 'Job',
  companyName = '',
  isOpen = false,
  onClose,
}) {
  const [applicants, setApplicants] = useState([]);
  const [exportRows, setExportRows] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
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

        const appUserIds = rows.map((app) => app.studentUserId).filter(Boolean);
        const clickUserIds = clicks.map((c) => c.user_id).filter(Boolean);
        const profileMap = await fetchStudentProfileRowsByUserIds([...appUserIds, ...clickUserIds]);
        const mappedProfiles = new Map(
          [...profileMap.entries()].map(([userId, row]) => [userId, mapStudentProfileRow(row)]),
        );

        const formattedApps = rows.map((app) => {
          const snapshot = app.profileSnapshot || {};
          const live = mappedProfiles.get(app.studentUserId);
          return {
            id: app.id,
            isExternal: false,
            fullName: snapshot.fullName || live?.fullName || 'Student Applicant',
            phone: snapshot.phone || live?.phone || '',
            email: snapshot.contactEmail || live?.contactEmail || '',
            education: [
              snapshot.degree || live?.degree,
              snapshot.branch || live?.branch,
              snapshot.graduationYear || live?.graduationYear,
            ]
              .filter(Boolean)
              .join(' · '),
            college: snapshot.college || live?.college || '',
            status: app.status,
            resumePath: app.resumePath,
            submittedAt: app.submittedAt,
            coverNote: app.coverNote || '',
            recruiterNotes: app.recruiterNotes || '',
            interviewScheduledAt: app.interviewScheduledAt || null,
            interviewMode: app.interviewMode || 'in-person',
            interviewLocation: app.interviewLocation || '',
            interviewInstructions: app.interviewInstructions || '',
            rawApplication: app,
          };
        });

        const appliedUserIds = new Set(appUserIds);
        const formattedClicks = clicks
          .filter((c) => !c.user_id || !appliedUserIds.has(c.user_id))
          .map((click) => {
            const live = click.user_id ? mappedProfiles.get(click.user_id) : null;
            const isRegistered = Boolean(click.user_id);
            return {
              id: click.id,
              isExternal: true,
              fullName: live?.fullName || (isRegistered ? 'Registered Student' : 'External Visitor'),
              phone: live?.phone || '',
              email: live?.contactEmail || '',
              education: [live?.degree, live?.branch, live?.graduationYear]
                .filter(Boolean)
                .join(' · '),
              college: live?.college || '',
              status: 'external_click',
              resumePath: null,
              submittedAt: click.created_at,
              coverNote: isRegistered
                ? 'Clicked Apply (Redirected to official/company application link)'
                : 'Anonymous visitor clicked Apply (Redirected to official application link)',
              recruiterNotes: '',
              interviewScheduledAt: null,
              interviewMode: 'in-person',
              interviewLocation: '',
              interviewInstructions: '',
              rawApplication: null,
            };
          });

        const combined = [...formattedApps, ...formattedClicks];
        const excelRows = mergeApplicationsWithApplyClicks(rows, clicks, profileMap);

        if (!ignore) {
          setApplicants(combined);
          setExportRows(excelRows);
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
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-4"
      onClick={exportOpen ? undefined : onClose}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {applicants.length} {applicants.length === 1 ? 'Applicant / Click' : 'Applicants / Clicks'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Admin View
                  </span>
                  <button
                    type="button"
                    onClick={() => setExportOpen(true)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-indigo-500"
                  >
                    Download Excel
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {applicants.map((item) => {
                  const statusClass =
                    item.status === 'external_click'
                      ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
                      : getApplicationStatusStyle(item.status);

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

                      {/* Interview Details & WhatsApp Pass (if scheduled) */}
                      {item.interviewScheduledAt ? (
                        <div className="mt-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white">
                                <CalendarIcon />
                              </span>
                              <div>
                                <span className="font-bold text-indigo-950">
                                  Interview: {new Date(item.interviewScheduledAt).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })}
                                </span>
                                <span className="ml-2 inline-flex items-center rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                                  {item.interviewMode === 'online' ? 'Online / Remote' : 'In-Person'}
                                </span>
                              </div>
                            </div>
                            {item.phone ? (
                              <a
                                href={buildInterviewWhatsAppPassUrl({
                                  phone: item.phone,
                                  candidateName: item.fullName,
                                  jobTitle,
                                  companyName,
                                  interviewScheduledAt: item.interviewScheduledAt,
                                  interviewMode: item.interviewMode,
                                  interviewLocation: item.interviewLocation,
                                  interviewInstructions: item.interviewInstructions,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
                              >
                                <span>Send WhatsApp Pass</span>
                              </a>
                            ) : null}
                          </div>
                          {item.interviewLocation ? (
                            <p className="mt-1.5 text-slate-700">
                              <span className="font-semibold text-slate-900">Venue / Link: </span>
                              {item.interviewLocation}
                            </p>
                          ) : null}
                          {item.interviewInstructions ? (
                            <p className="mt-1 text-slate-600">
                              <span className="font-semibold text-slate-800">Instructions: </span>
                              {item.interviewInstructions}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Recruiter Private Notes */}
                      {item.recruiterNotes ? (
                        <div className="mt-2.5 rounded-lg border border-purple-200 bg-purple-50/60 p-2.5 text-xs text-purple-950">
                          <div className="flex items-center gap-1.5 font-semibold text-purple-900">
                            <LockIcon />
                            <span>Private Recruiter Note</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-slate-700">{item.recruiterNotes}</p>
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
          <div className="flex flex-wrap items-center gap-2">
            {exportRows.length > 0 ? (
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                Download Excel
              </button>
            ) : null}
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
    </div>
      <ApplicationExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        applications={exportRows}
        job={{ id: jobId, title: jobTitle, company: companyName }}
      />
    </>
  );
}
