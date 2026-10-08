import { useState } from 'react';
import {
  ADMIN_STATUS_OPTIONS,
  formatApplicationStatus,
} from '../../lib/applicationStatus';
import {
  formatApplicationTime,
  getApplicationResumeUrl,
} from '../../services/jobApplications';
import { buildWhatsAppContactUrl } from '../../lib/whatsappContact';
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

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
    <path d="M20.52 3.48A11.89 11.89 0 0 0 12.07 0C5.5 0 .14 5.36.14 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.26-1.64a11.9 11.9 0 0 0 5.8 1.49h.01c6.56 0 11.92-5.36 11.92-11.94 0-3.19-1.24-6.19-3.47-8.43zm-8.45 18.39h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.98.99-3.63-.23-.37a9.89 9.89 0 0 1-1.52-5.32c0-5.46 4.45-9.91 9.92-9.91 2.65 0 5.14 1.03 7.01 2.9 1.87 1.88 2.9 4.37 2.9 7.02 0 5.46-4.46 9.92-9.94 9.92zm5.44-7.43c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" />
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

const DocumentIcon = () => (
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
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export default function JobApplicationTable({
  applications = [],
  onStatusChange,
  job = null,
  onSelectCandidate,
}) {
  const [openingResumeId, setOpeningResumeId] = useState(null);

  const handleOpenResume = async (application) => {
    try {
      setOpeningResumeId(application.id);
      const url = await getApplicationResumeUrl(application);
      if (!url) {
        throw new Error('Resume file link is not available.');
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not open resume.');
    } finally {
      setOpeningResumeId(null);
    }
  };

  const handleStageSelect = async (application, nextStatus) => {
    if (!onStatusChange) return;
    try {
      await onStatusChange(application.id, nextStatus, {
        jobId: application.jobId || job?.id,
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

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3.5">Candidate</th>
              <th scope="col" className="px-5 py-3.5">Contact / WhatsApp</th>
              <th scope="col" className="px-5 py-3.5">Education</th>
              <th scope="col" className="px-5 py-3.5">Skills</th>
              <th scope="col" className="px-5 py-3.5">Resume</th>
              <th scope="col" className="px-5 py-3.5">Pipeline Stage</th>
              <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {applications.map((app) => {
              const snapshot = app.profileSnapshot || {};
              const name = snapshot.fullName || 'Candidate';
              const initials = getInitials(name);
              const gradient = getAvatarGradient(name);
              const isResumeLoading = openingResumeId === app.id;

              const jobTitle = job?.title || app.job?.title || 'Open Position';
              const companyName = job?.company || app.job?.company || 'our company';
              const whatsappUrl = snapshot.phone
                ? buildWhatsAppContactUrl(
                    snapshot.phone,
                    `Hello ${name},\n\nWe reviewed your application for *${jobTitle}* at *${companyName}* on Vizag Jobs. We would like to connect with you regarding the next steps in our hiring process.`,
                  )
                : null;

              return (
                <tr key={app.id} className="transition hover:bg-slate-50/60">
                  {/* Candidate Identity */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-xs font-black text-white shadow-xs`}
                      >
                        {initials}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          {typeof snapshot.isFresher === 'boolean' ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
                              {snapshot.isFresher ? 'Fresher' : 'Exp'}
                            </span>
                          ) : null}
                          <span>Applied {formatApplicationTime(app.submittedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Contact / WhatsApp */}
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5">
                      {snapshot.phone ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${snapshot.phone}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-cyan-700"
                            title={`Call ${snapshot.phone}`}
                          >
                            <PhoneIcon />
                            <span>{snapshot.phone}</span>
                          </a>
                          {whatsappUrl ? (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md bg-emerald-600 p-1 text-white shadow-2xs transition hover:bg-emerald-700"
                              title="Chat on WhatsApp"
                            >
                              <WhatsAppIcon />
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No phone</span>
                      )}
                      {snapshot.contactEmail ? (
                        <a
                          href={`mailto:${snapshot.contactEmail}`}
                          className="max-w-[170px] truncate text-xs text-slate-500 hover:text-slate-800"
                          title={snapshot.contactEmail}
                        >
                          {snapshot.contactEmail}
                        </a>
                      ) : null}
                    </div>
                  </td>

                  {/* Education */}
                  <td className="px-5 py-4 text-xs text-slate-700">
                    <div className="font-medium text-slate-900">
                      {[snapshot.degree, snapshot.branch].filter(Boolean).join(' · ') || 'Not specified'}
                    </div>
                    {snapshot.college ? (
                      <div className="max-w-[200px] truncate text-slate-500">{snapshot.college}</div>
                    ) : null}
                    {snapshot.graduationYear ? (
                      <div className="text-[11px] text-slate-400">Batch {snapshot.graduationYear}</div>
                    ) : null}
                  </td>

                  {/* Skills */}
                  <td className="px-5 py-4">
                    {Array.isArray(snapshot.skills) && snapshot.skills.length > 0 ? (
                      <div className="flex max-w-[200px] flex-wrap gap-1">
                        {snapshot.skills.slice(0, 3).map((s, i) => (
                          <span
                            key={`${s}-${i}`}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                          >
                            {s}
                          </span>
                        ))}
                        {snapshot.skills.length > 3 ? (
                          <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            +{snapshot.skills.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {/* Resume */}
                  <td className="px-5 py-4">
                    {app.resumePath ? (
                      <button
                        type="button"
                        onClick={() => handleOpenResume(app)}
                        disabled={isResumeLoading}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-50"
                      >
                        <DocumentIcon />
                        <span>{isResumeLoading ? 'Opening…' : 'PDF CV'}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No CV</span>
                    )}
                  </td>

                  {/* Pipeline Stage Dropdown */}
                  <td className="px-5 py-4">
                    <select
                      value={app.status}
                      onChange={(e) => handleStageSelect(app, e.target.value)}
                      className={`rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:border-cyan-500 focus:outline-none`}
                    >
                      {app.status === 'external_click' ? (
                        <option value="external_click">Applied / New Click</option>
                      ) : null}
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {formatApplicationStatus(st)}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Actions: View Details / Notes */}
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectCandidate?.(app)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Details & Notes
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
