import { useState } from 'react';
import {
  ADMIN_STATUS_OPTIONS,
  formatApplicationStatus,
  getApplicationStatusStyle,
} from '../../lib/applicationStatus';
import {
  formatApplicationTime,
  getApplicationResumeUrl,
  updateApplicationRecruiterNotes,
  scheduleApplicationInterview,
  cancelApplicationInterview,
} from '../../services/jobApplications';
import {
  buildInterviewWhatsAppPassUrl,
  buildWhatsAppContactUrl,
} from '../../lib/whatsappContact';
import { pushToast } from '../../lib/toast';

const STATUS_OPTIONS = ADMIN_STATUS_OPTIONS;

const getInitials = (name) => {
  if (!name) return 'AP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarGradient = (name) => {
  const gradients = [
    'from-cyan-600 to-blue-700',
    'from-emerald-600 to-teal-700',
    'from-indigo-600 to-purple-700',
    'from-violet-600 to-fuchsia-700',
    'from-amber-600 to-orange-700',
    'from-rose-600 to-pink-700',
  ];
  let hash = 0;
  const str = name || 'candidate';
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % gradients.length;
  }
  return gradients[hash] || gradients[0];
};

const CalendarIcon = () => (
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
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const NoteIcon = () => (
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
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M20.52 3.48A11.89 11.89 0 0 0 12.07 0C5.5 0 .14 5.36.14 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.26-1.64a11.9 11.9 0 0 0 5.8 1.49h.01c6.56 0 11.92-5.36 11.92-11.94 0-3.19-1.24-6.19-3.47-8.43zm-8.45 18.39h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.98.99-3.63-.23-.37a9.89 9.89 0 0 1-1.52-5.32c0-5.46 4.45-9.91 9.92-9.91 2.65 0 5.14 1.03 7.01 2.9 1.87 1.88 2.9 4.37 2.9 7.02 0 5.46-4.46 9.92-9.94 9.92zm5.44-7.43c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" />
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

const MailIcon = () => (
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
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const PhoneIcon = () => (
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
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export default function JobApplicationCard({
  application,
  onStatusChange,
  onApplicationUpdate,
  canUpdateStatus = true,
  job = null,
}) {
  const snapshot = application.profileSnapshot || {};
  const [recruiterNotes, setRecruiterNotes] = useState(application.recruiterNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showNotes, setShowNotes] = useState(Boolean(application.recruiterNotes));
  const [showScheduler, setShowScheduler] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isOpeningResume, setIsOpeningResume] = useState(false);

  // Scheduler Form State
  const [scheduledAt, setScheduledAt] = useState(
    application.interviewScheduledAt
      ? new Date(application.interviewScheduledAt).toISOString().slice(0, 16)
      : '',
  );
  const [mode, setMode] = useState(application.interviewMode || 'in_person');
  const [location, setLocation] = useState(application.interviewLocation || '');
  const [instructions, setInstructions] = useState(application.interviewInstructions || '');

  const resolvedJob = job || application.job || null;
  const candidateName = snapshot.fullName || 'Candidate';
  const jobTitle = resolvedJob?.title || 'Open Position';
  const companyName = resolvedJob?.company || 'our company';

  const directWhatsAppUrl = snapshot.phone
    ? buildWhatsAppContactUrl(
        snapshot.phone,
        `Hello ${candidateName},\n\nWe reviewed your application for *${jobTitle}* at *${companyName}* on Vizag Jobs.\n\nWe would like to connect with you regarding the next steps in our hiring process. Please let us know your availability for a quick discussion.`,
      )
    : null;

  const handleViewResume = async () => {
    try {
      setIsOpeningResume(true);
      const url = await getApplicationResumeUrl(application);
      if (!url) {
        throw new Error('Resume file link is not available.');
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not open resume.');
    } finally {
      setIsOpeningResume(false);
    }
  };

  const handleStatusSelectChange = async (event) => {
    if (!onStatusChange) return;
    const nextStatus = event.target.value;
    try {
      await onStatusChange(application.id, nextStatus, {
        jobId: application.jobId || resolvedJob?.id,
        studentUserId: application.studentUserId,
      });
      pushToast({
        message: `Status updated to ${formatApplicationStatus(nextStatus)}.`,
        type: 'success',
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not update status.');
    }
  };

  const handleQuickStageClick = async (nextStatus) => {
    if (!onStatusChange) return;
    try {
      await onStatusChange(application.id, nextStatus, {
        jobId: application.jobId || resolvedJob?.id,
        studentUserId: application.studentUserId,
      });
      pushToast({
        message: `Candidate moved to ${formatApplicationStatus(nextStatus)}.`,
        type: 'success',
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not update stage.');
    }
  };

  const handleSaveNotes = async () => {
    try {
      setIsSavingNotes(true);
      const updated = await updateApplicationRecruiterNotes({
        applicationId: application.id,
        recruiterNotes,
        jobId: application.jobId || resolvedJob?.id,
        studentUserId: application.studentUserId,
      });
      if (onApplicationUpdate) {
        onApplicationUpdate(updated);
      }
      pushToast({ message: 'Recruiter notes saved.', type: 'success' });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not save recruiter notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleConfirmSchedule = async (e) => {
    e.preventDefault();
    if (!scheduledAt) {
      window.alert('Please choose an interview date and time.');
      return;
    }

    try {
      setIsScheduling(true);
      const updated = await scheduleApplicationInterview({
        applicationId: application.id,
        interviewScheduledAt: scheduledAt,
        interviewMode: mode,
        interviewLocation: location,
        interviewInstructions: instructions,
        status: 'interview_scheduled',
        jobId: application.jobId || resolvedJob?.id,
        studentUserId: application.studentUserId,
      });

      if (onApplicationUpdate) {
        onApplicationUpdate(updated);
      }
      if (onStatusChange) {
        await onStatusChange(application.id, 'interview_scheduled', {
          jobId: application.jobId || resolvedJob?.id,
          studentUserId: application.studentUserId,
        });
      }

      setShowScheduler(false);
      pushToast({
        message: 'Interview scheduled and status set to Interview Scheduled.',
        type: 'success',
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not schedule interview.');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelInterview = async () => {
    if (!window.confirm('Are you sure you want to cancel this scheduled interview?')) {
      return;
    }

    try {
      const updated = await cancelApplicationInterview({
        applicationId: application.id,
        jobId: application.jobId || resolvedJob?.id,
        studentUserId: application.studentUserId,
      });
      if (onApplicationUpdate) {
        onApplicationUpdate(updated);
      }
      pushToast({ message: 'Scheduled interview cancelled.', type: 'info' });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not cancel interview.');
    }
  };

  const handleSendWhatsAppPass = () => {
    if (!snapshot.phone) {
      window.alert('Candidate has no phone number recorded.');
      return;
    }

    const dateObj = application.interviewScheduledAt
      ? new Date(application.interviewScheduledAt)
      : null;

    const interviewDate = dateObj
      ? dateObj.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    const interviewTime = dateObj
      ? dateObj.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';

    const url = buildInterviewWhatsAppPassUrl(snapshot.phone, {
      candidateName,
      jobTitle,
      companyName,
      interviewDate,
      interviewTime,
      mode: application.interviewMode || 'in_person',
      location: application.interviewLocation || '',
      instructions: application.interviewInstructions || '',
    });

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const statusStyle = getApplicationStatusStyle(application.status);
  const initials = getInitials(snapshot.fullName);
  const avatarGradient = getAvatarGradient(snapshot.fullName);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
      {/* Top Header Card Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Candidate Avatar & Identity */}
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGradient} text-base font-black text-white shadow-xs`}
          >
            {initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-slate-950">{candidateName}</h3>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyle}`}
              >
                {formatApplicationStatus(application.status)}
              </span>
              {typeof snapshot.isFresher === 'boolean' ? (
                <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                  {snapshot.isFresher ? 'Fresher' : 'Experienced'}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              {[snapshot.degree, snapshot.branch, snapshot.graduationYear ? `Class of ${snapshot.graduationYear}` : null]
                .filter(Boolean)
                .join(' · ')}
              {snapshot.college ? <span className="text-slate-500"> • {snapshot.college}</span> : null}
            </p>
          </div>
        </div>

        {/* Right side: Timestamp & Source */}
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:text-right">
          <p className="text-xs font-medium text-slate-500">
            Applied {formatApplicationTime(application.submittedAt)}
          </p>
          {application.source === 'external_click' ? (
            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/60">
              Direct Student Apply
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800 border border-blue-200/60">
              Portal Application
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Recruiter Instant Contact & Resume Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Phone & Direct Call */}
            {snapshot.phone ? (
              <a
                href={`tel:${snapshot.phone}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
                title={`Call ${snapshot.phone}`}
              >
                <PhoneIcon />
                <span>{snapshot.phone}</span>
              </a>
            ) : (
              <span className="text-xs text-slate-400">No phone provided</span>
            )}

            {/* Direct WhatsApp Outreach */}
            {directWhatsAppUrl ? (
              <a
                href={directWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700"
                title="Message candidate on WhatsApp"
              >
                <WhatsAppIcon />
                <span>WhatsApp Candidate</span>
              </a>
            ) : null}

            {/* Email link */}
            {snapshot.contactEmail ? (
              <a
                href={`mailto:${snapshot.contactEmail}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
                title={`Email ${snapshot.contactEmail}`}
              >
                <MailIcon />
                <span className="max-w-[160px] truncate sm:max-w-[220px]">{snapshot.contactEmail}</span>
              </a>
            ) : null}
          </div>

          {/* Resume Action */}
          <div>
            {application.resumePath ? (
              <button
                type="button"
                onClick={handleViewResume}
                disabled={isOpeningResume}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-cyan-500 disabled:opacity-50"
              >
                <DocumentIcon />
                <span>{isOpeningResume ? 'Opening resume…' : 'View Resume (PDF)'}</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-400">
                <DocumentIcon />
                <span>No resume attached</span>
              </span>
            )}
          </div>
        </div>

        {/* Candidate Skills & Cover Note */}
        <div className="mt-4 space-y-3">
          {Array.isArray(snapshot.skills) && snapshot.skills.length > 0 ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Key Skills</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {snapshot.skills.map((skill, index) => (
                  <span
                    key={`${skill}-${index}`}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100/70 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {application.coverNote ? (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 text-sm whitespace-pre-wrap break-words text-slate-700">
              <span className="font-bold text-slate-800">Application details: </span>
              {application.coverNote}
            </div>
          ) : null}
        </div>

        {/* Recruiter Workspace: Interview Scheduler & Private Notes */}
        <div className="mt-5 space-y-3">
          {/* Interview Banner / Schedule Section */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-950">
                <CalendarIcon />
                <span>Interview Round</span>
              </div>
              {application.interviewScheduledAt && !showScheduler ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScheduler(true)}
                    className="text-xs font-semibold text-indigo-700 hover:underline"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelInterview}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>

            {/* If Interview is confirmed */}
            {application.interviewScheduledAt && !showScheduler ? (
              <div className="mt-2.5 rounded-xl border border-indigo-100 bg-white p-3.5 shadow-2xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {new Date(application.interviewScheduledAt).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-indigo-800">
                      Mode:{' '}
                      {application.interviewMode === 'virtual'
                        ? 'Virtual (Google Meet / Zoom)'
                        : application.interviewMode === 'telephonic'
                          ? 'Telephonic Interview'
                          : 'In-Person (Walk-In / Office)'}
                    </p>
                    {application.interviewLocation ? (
                      <p className="mt-1 text-xs text-slate-700">
                        <span className="font-bold">Venue / Link:</span> {application.interviewLocation}
                      </p>
                    ) : null}
                    {application.interviewInstructions ? (
                      <p className="mt-0.5 text-xs text-slate-600">
                        <span className="font-bold">Instructions:</span> {application.interviewInstructions}
                      </p>
                    ) : null}
                  </div>

                  {snapshot.phone ? (
                    <button
                      type="button"
                      onClick={handleSendWhatsAppPass}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700"
                      title="Send formal interview invitation pass to candidate on WhatsApp"
                    >
                      <WhatsAppIcon />
                      <span>Send WhatsApp Pass</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* If Scheduler Form is open */}
            {showScheduler ? (
              <form onSubmit={handleConfirmSchedule} className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-white p-3.5 shadow-2xs">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Interview Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Interview Mode</label>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    >
                      <option value="in_person">In-Person (Walk-In / Office)</option>
                      <option value="virtual">Virtual (Google Meet / Zoom)</option>
                      <option value="telephonic">Telephonic</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Venue Address or Meeting Link</label>
                  <input
                    type="text"
                    placeholder="e.g. 3rd Floor, Tech Hub, Siripuram, Visakhapatnam or https://meet.google.com/xyz"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Instructions for Candidate</label>
                  <input
                    type="text"
                    placeholder="e.g. Carry 2 copies of resume, ask for HR at reception"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowScheduler(false)}
                    className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isScheduling}
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isScheduling ? 'Scheduling…' : 'Confirm & Schedule'}
                  </button>
                </div>
              </form>
            ) : null}

            {!application.interviewScheduledAt && !showScheduler ? (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">No interview scheduled yet.</span>
                <button
                  type="button"
                  onClick={() => setShowScheduler(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs transition hover:bg-indigo-50"
                >
                  <CalendarIcon />
                  <span>Schedule Interview</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* Recruiter Private Notes */}
          <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-950">
                <NoteIcon />
                <span>Private Recruiter Notes</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className="text-xs font-semibold text-amber-800 hover:underline"
              >
                {showNotes ? 'Collapse note' : recruiterNotes ? 'View note' : '+ Add note'}
              </button>
            </div>

            {showNotes ? (
              <div className="mt-2.5">
                <textarea
                  rows={2}
                  value={recruiterNotes}
                  onChange={(e) => setRecruiterNotes(e.target.value)}
                  placeholder="e.g. Telephonic round done. Strong communication, expects 20k/mo, ready to join immediately..."
                  className="w-full rounded-xl border border-amber-200 bg-white p-2.5 text-xs text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 sm:text-sm"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes || recruiterNotes === (application.recruiterNotes || '')}
                    className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isSavingNotes ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              </div>
            ) : recruiterNotes ? (
              <p className="mt-1.5 truncate text-xs text-amber-900/80 italic">"{recruiterNotes}"</p>
            ) : null}
          </div>
        </div>

        {/* Footer Pipeline Stage Controller */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          {/* Quick Stage Action Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Actions:</span>
            {application.status === 'applied' || application.status === 'external_click' ? (
              <button
                type="button"
                onClick={() => handleQuickStageClick('screened')}
                className="rounded-xl border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 transition hover:bg-purple-100"
              >
                ✓ Shortlist / Screen
              </button>
            ) : null}
            {application.status !== 'interview_scheduled' ? (
              <button
                type="button"
                onClick={() => setShowScheduler(true)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
              >
                📅 Schedule Interview
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleQuickStageClick('hired')}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                ★ Mark Hired
              </button>
            )}
            {application.status !== 'rejected' ? (
              <button
                type="button"
                onClick={() => handleQuickStageClick('rejected')}
                className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                ✕ Reject
              </button>
            ) : null}
          </div>

          {/* Full Pipeline Stage Selector Dropdown */}
          {canUpdateStatus ? (
            <div className="flex items-center gap-2">
              <label htmlFor={`stage-select-${application.id}`} className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pipeline Stage:
              </label>
              <select
                id={`stage-select-${application.id}`}
                value={application.status}
                onChange={handleStatusSelectChange}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 sm:text-sm"
              >
                {application.status === 'external_click' ? (
                  <option value="external_click">Applied / New Click</option>
                ) : null}
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatApplicationStatus(status)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle}`}>
              {formatApplicationStatus(application.status)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
