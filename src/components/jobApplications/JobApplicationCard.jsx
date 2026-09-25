import { useState } from 'react';
import PhoneDialLink from '../PhoneDialLink';
import WhatsAppContactLink from '../WhatsAppContactLink';
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
} from '../../lib/whatsappContact';
import { pushToast } from '../../lib/toast';

const STATUS_OPTIONS = ADMIN_STATUS_OPTIONS;

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

export default function JobApplicationCard({
  application,
  onStatusChange,
  onApplicationUpdate,
  canUpdateStatus = true,
}) {
  const snapshot = application.profileSnapshot || {};
  const [recruiterNotes, setRecruiterNotes] = useState(application.recruiterNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  // Scheduler Form State
  const [scheduledAt, setScheduledAt] = useState(
    application.interviewScheduledAt
      ? new Date(application.interviewScheduledAt).toISOString().slice(0, 16)
      : '',
  );
  const [mode, setMode] = useState(application.interviewMode || 'in_person');
  const [location, setLocation] = useState(application.interviewLocation || '');
  const [instructions, setInstructions] = useState(application.interviewInstructions || '');

  const handleViewResume = async () => {
    const url = await getApplicationResumeUrl(application);
    if (!url) {
      throw new Error('Resume is not available.');
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleStatusChange = async (event) => {
    if (!onStatusChange) return;
    const nextStatus = event.target.value;
    await onStatusChange(application.id, nextStatus);
  };

  const handleSaveNotes = async () => {
    try {
      setIsSavingNotes(true);
      const updated = await updateApplicationRecruiterNotes({
        applicationId: application.id,
        recruiterNotes,
      });
      if (onApplicationUpdate) {
        onApplicationUpdate(updated);
      }
      pushToast({ message: 'Recruiter notes saved.', type: 'success' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save recruiter notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleConfirmSchedule = async (e) => {
    e.preventDefault();
    if (!scheduledAt) {
      alert('Please choose an interview date and time.');
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
      });

      if (onApplicationUpdate) {
        onApplicationUpdate(updated);
      }
      if (onStatusChange) {
        await onStatusChange(application.id, 'interview_scheduled');
      }

      setShowScheduler(false);
      pushToast({
        message: 'Interview scheduled and status set to Interview Scheduled.',
        type: 'success',
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not schedule interview.');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelInterview = async () => {
    if (!window.confirm('Are you sure you want to cancel this scheduled interview?')) {
      return;
    }

    try {
      const updated = await cancelApplicationInterview({ applicationId: application.id });
      if (onApplicationUpdate) {
        onApplicationUpdate(updated);
      }
      pushToast({ message: 'Scheduled interview cancelled.', type: 'info' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not cancel interview.');
    }
  };

  const handleSendWhatsAppPass = () => {
    if (!snapshot.phone) {
      alert('Candidate has no phone number recorded.');
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
      candidateName: snapshot.fullName || 'Candidate',
      jobTitle: application.job?.title || 'Job Opening',
      companyName: application.job?.company || 'Company',
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

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-slate-950">{snapshot.fullName || 'Applicant'}</h3>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyle}`}
            >
              {formatApplicationStatus(application.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {[snapshot.degree, snapshot.branch, snapshot.graduationYear].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{snapshot.college || ''}</p>
        </div>
        <p className="text-xs text-slate-500">Applied {formatApplicationTime(application.submittedAt)}</p>
      </div>

      {/* Details Grid */}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
          <dd className="mt-0.5 break-all text-slate-800">
            {snapshot.contactEmail ? (
              <a href={`mailto:${snapshot.contactEmail}`} className="text-cyan-700 hover:underline">
                {snapshot.contactEmail}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone / WhatsApp</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-800">
            <span className="font-medium">{snapshot.phone || 'Not provided'}</span>
            {snapshot.phone ? (
              <>
                <PhoneDialLink phone={snapshot.phone} />
                <WhatsAppContactLink phone={snapshot.phone} />
              </>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qualification</dt>
          <dd className="mt-0.5 text-slate-800">
            {[snapshot.degree, snapshot.branch, snapshot.graduationYear].filter(Boolean).join(' · ') ||
              'Not provided'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fresher</dt>
          <dd className="mt-0.5 text-slate-800">{snapshot.isFresher ? 'Yes' : 'No'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</dt>
          <dd className="mt-0.5 text-slate-800">
            {Array.isArray(snapshot.skills) && snapshot.skills.length > 0
              ? snapshot.skills.join(', ')
              : 'Not provided'}
          </dd>
        </div>
        {Array.isArray(snapshot.certifications) && snapshot.certifications.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Certifications</dt>
            <dd className="mt-0.5 text-slate-800">{snapshot.certifications.join(', ')}</dd>
          </div>
        ) : null}
        {application.coverNote ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cover note</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">{application.coverNote}</dd>
          </div>
        ) : null}
      </dl>

      {/* Recruiter Private Notes Section */}
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
            <NoteIcon />
            <span>Recruiter Notes (Private)</span>
          </div>
          <span className="text-[11px] font-medium text-amber-700">Internal only</span>
        </div>
        <textarea
          rows={2}
          value={recruiterNotes}
          onChange={(e) => setRecruiterNotes(e.target.value)}
          placeholder="e.g. Telephonic round done. Good communication skills, expects 18k salary, ready to join immediately..."
          className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-2.5 text-xs text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 sm:text-sm"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={isSavingNotes || recruiterNotes === (application.recruiterNotes || '')}
            className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-amber-700 disabled:opacity-50"
          >
            {isSavingNotes ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>

      {/* Interview Scheduling Box */}
      <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-900">
            <CalendarIcon />
            <span>Client Interview</span>
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
          <div className="mt-2.5 rounded-xl border border-indigo-100 bg-white p-3 shadow-2xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {new Date(application.interviewScheduledAt).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
                <p className="mt-0.5 text-xs font-medium text-indigo-800">
                  Mode:{' '}
                  {application.interviewMode === 'virtual'
                    ? 'Virtual (Google Meet / Zoom)'
                    : application.interviewMode === 'telephonic'
                      ? 'Telephonic Interview'
                      : 'In-Person (Walk-In / Office)'}
                </p>
                {application.interviewLocation ? (
                  <p className="mt-1 text-xs text-slate-700">
                    <span className="font-semibold">Venue / Link:</span>{' '}
                    {application.interviewLocation}
                  </p>
                ) : null}
                {application.interviewInstructions ? (
                  <p className="mt-1 text-xs text-slate-600">
                    <span className="font-semibold">Instructions:</span>{' '}
                    {application.interviewInstructions}
                  </p>
                ) : null}
              </div>

              {snapshot.phone ? (
                <button
                  type="button"
                  onClick={handleSendWhatsAppPass}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700"
                  title="Send pre-filled interview pass to candidate on WhatsApp"
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
          <form onSubmit={handleConfirmSchedule} className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-white p-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Interview Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Interview Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
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
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Instructions for Candidate</label>
              <input
                type="text"
                placeholder="e.g. Carry 2 copies of resume, ask for HR Rahul at reception"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowScheduler(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isScheduling}
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
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

      {/* Actions & Status footer */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          {application.resumePath ? (
            <button
              type="button"
              onClick={() => {
                handleViewResume().catch((error) => {
                  window.alert(error instanceof Error ? error.message : 'Could not open resume.');
                });
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              View resume
            </button>
          ) : (
            <span className="rounded-2xl border border-dashed border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400">
              No resume attached
            </span>
          )}
        </div>

        {canUpdateStatus ? (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span className="font-semibold text-xs uppercase tracking-wider text-slate-500">Pipeline Stage</span>
            <select
              value={application.status}
              onChange={handleStatusChange}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatApplicationStatus(status)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle}`}>
            {formatApplicationStatus(application.status)}
          </span>
        )}
      </div>
    </article>
  );
}
