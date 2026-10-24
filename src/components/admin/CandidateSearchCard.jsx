import { useState } from 'react';
import { formatStudentRegisteredAt } from '../../services/adminStudents';
import { createResumeSignedUrl } from '../../services/studentResume';
import { candidateSkillKey } from '../../lib/adminCandidateSearch';
import { formatSkillLabel } from '../../lib/studentProfileOptions';
import { studentRoleLabels } from '../../lib/studentRoles';

const STATUS = {
  eligible: 'Meets reviewed job requirements',
  needs_information: 'Job match: needs information',
  ineligible: 'Does not meet reviewed job requirements',
  unverified: 'Job requirements unverified',
};

export default function CandidateSearchCard({
  entry,
  filters,
  selected,
  onSelect,
  onSkill,
  onShare,
  onToggleActive,
  busy,
}) {
  const { student, reasons, eligibility, missingFacts } = entry;
  const [copied, setCopied] = useState(false);
  const [loadingResume, setLoadingResume] = useState(false);
  const experience =
    student.roleExperienceLabel ||
    (student.isFresher === true
      ? 'Fresher'
      : student.isFresher === false
        ? 'Experienced; duration not provided'
        : 'Experience not provided');

  const phoneDigits = student.phone ? student.phone.replace(/\D/g, '') : '';
  const waGreeting = encodeURIComponent(
    `Hello ${student.fullName}, we found your profile on VizagJobs for ${
      student.primaryTargetRole || 'job openings'
    }. Are you available for an interview discussion?`
  );

  const allSkills = (student.skills || []).map((sk) => String(sk).toLowerCase());
  const certsText = String(student.certificationsText || '').toLowerCase();
  const hasBike = allSkills.some((sk) => sk.includes('two wheeler') || sk.includes('driving'));
  const hasLicense = allSkills.some((sk) => sk.includes('license')) || certsText.includes('license');
  const hasTelugu = allSkills.some((sk) => sk.includes('telugu'));
  const hasEnglish = allSkills.some((sk) => sk.includes('english'));

  const handleViewResume = async () => {
    if (!student.resumePath) return;
    setLoadingResume(true);
    try {
      const url = await createResumeSignedUrl(student.resumePath, 604800);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Could not generate resume link.');
      }
    } catch (err) {
      alert(err?.message || 'Could not open resume.');
    } finally {
      setLoadingResume(false);
    }
  };

  const handleCopyContact = async () => {
    const summary = [
      `Name: ${student.fullName}`,
      `Phone: ${student.phone || 'Not provided'}`,
      `Email: ${student.contactEmail || 'Not provided'}`,
      `Seeking: ${student.primaryTargetRole || 'Not specified'}`,
      `Qualification: ${[student.degree, student.branch, student.graduationYear ? `Batch ${student.graduationYear}` : '', student.college].filter(Boolean).join(' · ')}`,
      `Skills: ${student.skills?.join(', ') || 'None'}`,
      student.resumePath ? `Resume: Attached (${student.resumePath})` : null,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  return (
    <article
      aria-label={`Candidate ${student.fullName || 'Unnamed'}`}
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
    >
      {/* Top Header: Name & Shortlist */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-slate-950 [overflow-wrap:anywhere]">
              {student.fullName || 'Name not provided'}
            </h2>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {!student.isActive && (
                <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  Deactivated
                </span>
              )}
              {!student.hasRegistrationConsents && (
                <span className="rounded-lg bg-rose-50 px-2 py-0.5 font-medium text-rose-800 border border-rose-200">
                  Consent pending
                </span>
              )}
              {!student.profileComplete && (
                <span className="rounded-lg bg-amber-50 px-2 py-0.5 font-medium text-amber-900 border border-amber-200">
                  Profile incomplete
                </span>
              )}
            </div>
          </div>

          {/* Job Seeking Banner */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-900">
              🎯 Seeking: {student.primaryTargetRole || studentRoleLabels(student)[0] || 'Any Role'}
            </span>
            {student.interestedRoles?.length > 0 && (
              <span className="text-xs text-slate-600 [overflow-wrap:anywhere]">
                Also open to:{' '}
                <strong className="text-slate-800">{student.interestedRoles.join(', ')}</strong>
              </span>
            )}
            {student.targetJobCategoryLabels?.length > 0 && (
              <span className="text-xs text-slate-500 [overflow-wrap:anywhere]">
                ({student.targetJobCategoryLabels.join(', ')})
              </span>
            )}
          </div>

          {/* Qualification & College */}
          <p className="mt-2 text-sm text-slate-800 [overflow-wrap:anywhere]">
            <span className="font-bold text-slate-900">
              🎓 {[student.degree || 'Qualification not provided', student.branch].filter(Boolean).join(' in ')}
            </span>
            {[
              student.graduationYear ? `Batch ${student.graduationYear}` : '',
              student.educationStatus === 'studying'
                ? '(Currently Studying)'
                : student.educationStatus === 'completed'
                  ? '(Completed)'
                  : '',
              student.college ? `at ${student.college}` : '',
            ]
              .filter(Boolean)
              .map((part, idx) => (
                <span key={idx} className="text-slate-600">
                  {' '}
                  · {part}
                </span>
              ))}
          </p>

          {/* Key Facts Badges */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            {student.isFresher === true ? (
              <span className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-900">
                🌱 Fresher
              </span>
            ) : (
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-bold text-blue-900">
                💼 {experience}
              </span>
            )}
            {student.availabilityLabel && (
              <span className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
                ⚡ {student.availabilityLabel}
              </span>
            )}
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
              📍 Resides: {[student.currentCity, student.currentArea].filter(Boolean).join(', ') || 'Not given'}
            </span>
            {student.preferredLocations?.length > 0 && (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                Prefers: {student.preferredLocations.join(', ')}
              </span>
            )}
            {(student.expectedSalaryMin || student.expectedSalaryMax) && (
              <span className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 font-semibold text-purple-900">
                💰 Expected: ₹{student.expectedSalaryMin || '...'} – ₹{student.expectedSalaryMax || '...'}/mo
              </span>
            )}
            {student.resumePath && (
              <span className="rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 font-bold text-purple-900">
                📄 Resume Available
              </span>
            )}
            {hasBike && (
              <span className="rounded-lg border border-emerald-400 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-950 flex items-center gap-1">
                <span>🛵</span> Two-Wheeler / Bike
              </span>
            )}
            {hasLicense && (
              <span className="rounded-lg border border-emerald-400 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-950 flex items-center gap-1">
                <span>🪪</span> Driving License (DL)
              </span>
            )}
            {hasTelugu && (
              <span className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 font-medium text-blue-900 flex items-center gap-1">
                <span>🗣️</span> Telugu Fluency
              </span>
            )}
            {hasEnglish && (
              <span className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 font-medium text-blue-900 flex items-center gap-1">
                <span>🗣️</span> English
              </span>
            )}
          </div>
        </div>

        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-xs hover:border-indigo-400">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={selected}
            onChange={onSelect}
            aria-label={`Shortlist ${student.fullName}`}
          />
          Shortlist
        </label>
      </div>

      {/* Skills Badges with Match Highlighting */}
      <div className="mt-3.5 flex flex-wrap gap-1.5" aria-label="Candidate skills">
        {student.skills?.length ? (
          student.skills.map((skill) => {
            const isMatched = filters.skills.some(
              (value) => candidateSkillKey(value) === candidateSkillKey(skill)
            );
            return (
              <button
                key={skill}
                type="button"
                onClick={() => onSkill(skill)}
                aria-pressed={isMatched}
                className={`min-h-9 max-w-full rounded-lg border px-2.5 py-1 text-xs font-semibold transition [overflow-wrap:anywhere] ${
                  isMatched
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
                title={`Filter by ${formatSkillLabel(skill)}`}
              >
                {isMatched ? `✓ ${formatSkillLabel(skill)}` : formatSkillLabel(skill)}
              </button>
            );
          })
        ) : (
          <span className="text-xs text-amber-800">Skills not provided</span>
        )}
      </div>

      {/* Why Candidate Appears */}
      {reasons.length > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
          <p className="font-bold">Why this candidate appears:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 [overflow-wrap:anywhere]">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Job Eligibility */}
      {eligibility && (
        <div
          className={`mt-3 rounded-xl border p-3 text-xs ${
            eligibility.status === 'eligible'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="font-bold">{STATUS[eligibility.status]}</p>
          {[...eligibility.reasons, ...eligibility.missing].map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      )}

      {/* Missing facts notification */}
      {missingFacts.length > 0 && (
        <p className="mt-2 text-xs text-amber-900">
          Missing matching details: {missingFacts.join(', ')}. (Missing information is not a failed qualification).
        </p>
      )}

      {/* Direct One-Click Actions Bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {student.phone ? (
          <>
            <a
              href={`https://wa.me/91${phoneDigits}?text=${waGreeting}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
              title="Open WhatsApp chat with prefilled message"
            >
              💬 WhatsApp
            </a>
            <a
              href={`tel:${student.phone}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
              title="Call candidate"
            >
              📞 Call {student.phone}
            </a>
            <button
              type="button"
              onClick={handleCopyContact}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              title="Copy candidate info to clipboard"
            >
              {copied ? '✓ Copied!' : '📋 Copy info'}
            </button>
          </>
        ) : (
          <span className="text-xs text-slate-400">Phone not provided</span>
        )}
        {student.contactEmail && (
          <a
            href={`mailto:${student.contactEmail}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            title="Send email"
          >
            ✉️ Email
          </a>
        )}
        {student.resumePath && (
          <button
            type="button"
            onClick={handleViewResume}
            disabled={loadingResume}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 px-3.5 py-2 text-xs font-bold text-purple-900 shadow-xs hover:bg-purple-100 transition disabled:opacity-50"
            title="View candidate resume in a new tab"
          >
            {loadingResume ? '⏳ Opening...' : '📄 View Resume'}
          </button>
        )}
        <button
          type="button"
          onClick={onShare}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-900 hover:bg-indigo-100 transition"
          title="Share candidate card with employer"
        >
          📤 Share profile
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onToggleActive}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          {student.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      {/* Additional Profile Background (Collapsible) */}
      <details className="mt-3 border-t border-slate-100 pt-2">
        <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-slate-600 hover:text-slate-900">
          More profile details (college, certs, salary, registered date)
        </summary>
        <dl className="mt-2 grid min-w-0 gap-3 text-sm sm:grid-cols-2 [&_dt]:text-xs [&_dt]:font-semibold [&_dt]:text-slate-500 [&_dd]:mt-1 [&_dd]:[overflow-wrap:anywhere]">
          <div>
            <dt>Email</dt>
            <dd>
              {student.contactEmail ? (
                <a className="text-indigo-600 underline" href={`mailto:${student.contactEmail}`}>
                  {student.contactEmail}
                </a>
              ) : (
                'Not provided'
              )}
            </dd>
          </div>
          <div>
            <dt>College / institution</dt>
            <dd>{student.college || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Education status</dt>
            <dd>
              {student.educationStatus === 'studying'
                ? 'Currently studying'
                : student.educationStatus === 'completed'
                  ? 'Completed'
                  : 'Not provided'}
            </dd>
          </div>
          <div>
            <dt>All desired roles</dt>
            <dd>{studentRoleLabels(student).join(', ') || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Career sectors</dt>
            <dd>{student.targetJobCategoryLabels?.join(', ') || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Preferred work locations</dt>
            <dd>{student.preferredLocations?.join(', ') || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Willing to relocate</dt>
            <dd>
              {student.willingToRelocate == null
                ? 'Not provided'
                : student.willingToRelocate
                  ? 'Yes'
                  : 'No'}
            </dd>
          </div>
          <div>
            <dt>Certifications / courses</dt>
            <dd>{student.certificationsText || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Expected monthly salary</dt>
            <dd>
              {student.expectedSalaryMin || student.expectedSalaryMax
                ? `₹${student.expectedSalaryMin || 'Not specified'} – ₹${
                    student.expectedSalaryMax || 'Not specified'
                  }`
                : 'Not provided'}
            </dd>
          </div>
          <div>
            <dt>Registered</dt>
            <dd>{formatStudentRegisteredAt(student.createdAt)}</dd>
          </div>
        </dl>
      </details>
    </article>
  );
}
