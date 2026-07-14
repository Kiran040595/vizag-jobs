import WhatsAppContactLink from '../WhatsAppContactLink';
import {
  formatApplicationStatus,
  formatApplicationTime,
  getApplicationResumeUrl,
} from '../../services/jobApplications';

const STATUS_OPTIONS = ['submitted', 'viewed', 'shortlisted', 'rejected'];

export default function JobApplicationCard({ application, onStatusChange, canUpdateStatus = true }) {
  const snapshot = application.profileSnapshot || {};

  const handleViewResume = async () => {
    const url = await getApplicationResumeUrl(application);
    if (!url) {
      throw new Error('Resume is not available.');
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleStatusChange = async (event) => {
    if (!onStatusChange) {
      return;
    }
    await onStatusChange(application.id, event.target.value);
  };

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{snapshot.fullName || 'Applicant'}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {[snapshot.degree, snapshot.branch, snapshot.graduationYear].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-sm text-slate-600">{snapshot.college || ''}</p>
        </div>
        <p className="text-xs text-slate-500">Applied {formatApplicationTime(application.submittedAt)}</p>
      </div>

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
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-800">
            <span>{snapshot.phone || 'Not provided'}</span>
            {snapshot.phone ? <WhatsAppContactLink phone={snapshot.phone} /> : null}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</dt>
          <dd className="mt-0.5 text-slate-800">
            {Array.isArray(snapshot.skills) && snapshot.skills.length > 0
              ? snapshot.skills.join(', ')
              : 'Not provided'}
          </dd>
        </div>
        {application.coverNote ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cover note</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">{application.coverNote}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            handleViewResume().catch((error) => {
              window.alert(error instanceof Error ? error.message : 'Could not open resume.');
            });
          }}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          View resume
        </button>
        {canUpdateStatus ? (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span className="font-semibold">Status</span>
            <select
              value={application.status}
              onChange={handleStatusChange}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatApplicationStatus(status)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {formatApplicationStatus(application.status)}
          </span>
        )}
      </div>
    </article>
  );
}
