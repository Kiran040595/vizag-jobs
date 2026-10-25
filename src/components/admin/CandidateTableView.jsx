import { candidateSkillKey } from '../../lib/adminCandidateSearch';
import { createResumeSignedUrl } from '../../services/studentResume';
import { formatSkillLabel } from '../../lib/studentProfileOptions';
import { studentRoleLabels } from '../../lib/studentRoles';

export default function CandidateTableView({
  visibleEntries,
  filters,
  shortlist,
  onToggleShortlist,
  onSkill,
  onShare,
  onToggleActive,
  onEditCredentials,
  busyUserId,
}) {
  const isSkillMatched = (skill) => {
    const key = candidateSkillKey(skill);
    return filters.skills.some((value) => candidateSkillKey(value) === key);
  };

  const handleViewResume = async (resumePath) => {
    if (!resumePath) return;
    try {
      const url = await createResumeSignedUrl(resumePath, 604800);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else alert('Could not generate resume link.');
    } catch (err) {
      alert(err?.message || 'Could not open resume.');
    }
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1000px] text-left text-sm text-slate-700">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
          <tr>
            <th scope="col" className="w-12 px-3 py-3.5 text-center">
              Select
            </th>
            <th scope="col" className="px-4 py-3.5">
              Candidate & Contact
            </th>
            <th scope="col" className="px-4 py-3.5">
              Seeking Job Role
            </th>
            <th scope="col" className="px-4 py-3.5">
              Skills
            </th>
            <th scope="col" className="px-4 py-3.5">
              Qualification & College
            </th>
            <th scope="col" className="px-3 py-3.5 text-center">
              Experience
            </th>
            <th scope="col" className="px-3 py-3.5">
              Location
            </th>
            <th scope="col" className="px-3 py-3.5">
              Joining
            </th>
            <th scope="col" className="px-4 py-3.5 text-right">
              Quick Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visibleEntries.map(({ student }) => {
            const isShortlisted = shortlist.has(student.userId);
            const isFresher = student.isFresher === true;
            const expLabel =
              student.roleExperienceLabel ||
              (isFresher ? 'Fresher' : student.isFresher === false ? 'Experienced' : 'Not provided');
            const phoneDigits = student.phone ? student.phone.replace(/\D/g, '') : '';
            const waGreeting = encodeURIComponent(
              `Hello ${student.fullName}, we found your profile on VizagJobs for ${
                student.primaryTargetRole || 'job openings'
              }. Are you available for interview?`
            );

            const skillsList = Array.isArray(student.skills) ? student.skills : [];
            const certsList = Array.isArray(student.certifications) ? student.certifications : [];
            const hasBike = skillsList.some((s) => s.includes('two wheeler') || s.includes('bike') || s.includes('driving'));
            const hasLicense = skillsList.some((s) => s.includes('license')) || certsList.some((c) => /driving|license|dl/i.test(c));
            const hasTelugu = skillsList.some((s) => s.includes('telugu'));
            const hasEnglish = skillsList.some((s) => s.includes('english'));

            return (
              <tr
                key={student.userId}
                className={`transition hover:bg-slate-50/70 ${
                  isShortlisted ? 'bg-indigo-50/40' : ''
                }`}
              >
                <td className="px-3 py-4 text-center align-top">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={isShortlisted}
                    onChange={() => onToggleShortlist(student.userId)}
                    aria-label={`Shortlist ${student.fullName}`}
                  />
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="font-bold text-slate-950 [overflow-wrap:anywhere]">
                    {student.fullName || 'Name not provided'}
                  </div>
                  {student.phone ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                      <a
                        href={`tel:${student.phone}`}
                        className="font-medium text-slate-800 hover:text-indigo-600 hover:underline"
                        title="Click to call"
                      >
                        📞 {student.phone}
                      </a>
                      <a
                        href={`https://wa.me/91${phoneDigits}?text=${waGreeting}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-emerald-600 hover:text-emerald-700"
                        title="Open WhatsApp chat"
                      >
                        💬
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No phone</span>
                  )}
                  {student.contactEmail && (
                    <div className="mt-0.5 text-xs text-slate-500 [overflow-wrap:anywhere]">
                      <a
                        href={`mailto:${student.contactEmail}`}
                        className="hover:text-indigo-600 hover:underline"
                      >
                        ✉️ {student.contactEmail}
                      </a>
                    </div>
                  )}
                  {student.candidateSource === 'quick_apply' && (
                    <span className="mt-1 inline-block rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-900 border border-purple-200">
                      ⚡ Quick Lead
                    </span>
                  )}
                  {!student.isActive && (
                    <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                      Deactivated
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 align-top">
                  <span className="inline-block rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-900 border border-indigo-200 [overflow-wrap:anywhere]">
                    🎯 {student.primaryTargetRole || studentRoleLabels(student)[0] || 'Any Role'}
                  </span>
                  {(hasBike || hasLicense || hasTelugu || hasEnglish) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {hasBike && (
                        <span
                          className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200"
                          title="Has Two-Wheeler / Bike"
                        >
                          🛵 Bike
                        </span>
                      )}
                      {hasLicense && (
                        <span
                          className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200"
                          title="Has Driving License"
                        >
                          🪪 DL
                        </span>
                      )}
                      {hasTelugu && (
                        <span
                          className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200"
                          title="Telugu Fluency"
                        >
                          🗣️ Telugu
                        </span>
                      )}
                      {hasEnglish && (
                        <span
                          className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 border border-indigo-200"
                          title="English Communication"
                        >
                          🗣️ English
                        </span>
                      )}
                    </div>
                  )}
                  {student.interestedRoles?.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-500 [overflow-wrap:anywhere]">
                      Also: {student.interestedRoles.join(', ')}
                    </p>
                  )}
                  {student.targetJobCategoryLabels?.length > 0 && (
                    <p className="mt-0.5 text-[10px] text-slate-400 [overflow-wrap:anywhere]">
                      {student.targetJobCategoryLabels.join(', ')}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {student.skills?.length ? (
                      student.skills.map((skill) => {
                        const matched = isSkillMatched(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => onSkill(skill)}
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition [overflow-wrap:anywhere] ${
                              matched
                                ? 'border border-emerald-400 bg-emerald-50 text-emerald-900 font-bold'
                                : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                            title={`Filter by ${formatSkillLabel(skill)}`}
                          >
                            {matched ? `✓ ${formatSkillLabel(skill)}` : formatSkillLabel(skill)}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-xs text-amber-800">None</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="font-semibold text-slate-900 [overflow-wrap:anywhere]">
                    {[student.degree, student.branch].filter(Boolean).join(' · ') || 'Not provided'}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 [overflow-wrap:anywhere]">
                    {[
                      student.graduationYear ? `Batch ${student.graduationYear}` : '',
                      student.educationStatus === 'studying'
                        ? 'Studying'
                        : student.educationStatus === 'completed'
                          ? 'Completed'
                          : '',
                      student.college,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </td>
                <td className="px-3 py-4 text-center align-top">
                  {isFresher ? (
                    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-200">
                      🌱 Fresher
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-900 border border-blue-200">
                      💼 {expLabel}
                    </span>
                  )}
                </td>
                <td className="px-3 py-4 align-top text-xs text-slate-600">
                  <div className="font-medium text-slate-800">
                    📍 {[student.currentCity, student.currentArea].filter(Boolean).join(', ') || 'Not given'}
                  </div>
                  {student.preferredLocations?.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      Prefers: {student.preferredLocations.join(', ')}
                    </div>
                  )}
                </td>
                <td className="px-3 py-4 align-top text-xs text-slate-600">
                  {student.availabilityLabel ? (
                    <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900 border border-amber-200">
                      ⚡ {student.availabilityLabel}
                    </span>
                  ) : (
                    'Not given'
                  )}
                </td>
                <td className="px-4 py-4 text-right align-top">
                  <div className="flex flex-col items-end gap-1.5">
                    {student.phone && (
                      <a
                        href={`https://wa.me/91${phoneDigits}?text=${waGreeting}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                    {student.resumePath && (
                      <button
                        type="button"
                        onClick={() => handleViewResume(student.resumePath)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-900 shadow-xs hover:bg-purple-100 transition"
                        title="View candidate resume in a new tab"
                      >
                        📄 Resume
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onShare(student)}
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 transition"
                    >
                      📤 Share
                    </button>
                    {onEditCredentials && (student.studentUserId || student.candidateSource !== 'quick_apply') && (
                      <button
                        type="button"
                        onClick={() => onEditCredentials(student)}
                        className="inline-flex min-h-7 items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-900 hover:bg-indigo-100"
                        title="View account status, change login email, or set new password"
                      >
                        🔑 Login &amp; Status
                      </button>
                    )}
                    {onToggleActive && (
                      <button
                        type="button"
                        disabled={busyUserId === student.userId}
                        onClick={() => onToggleActive(student)}
                        className="inline-flex min-h-7 items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      >
                        {student.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
