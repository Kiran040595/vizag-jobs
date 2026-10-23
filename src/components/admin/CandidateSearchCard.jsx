import WhatsAppContactLink from '../WhatsAppContactLink';
import { formatStudentRegisteredAt } from '../../services/adminStudents';
import { candidateSkillKey } from '../../lib/adminCandidateSearch';
import { formatSkillLabel } from '../../lib/studentProfileOptions';
import { studentRoleLabels } from '../../lib/studentRoles';

const STATUS = { eligible: 'Meets reviewed job requirements', needs_information: 'Job match: needs information', ineligible: 'Does not meet reviewed job requirements', unverified: 'Job requirements unverified' };

export default function CandidateSearchCard({ entry, filters, selected, onSelect, onSkill, onShare, onToggleActive, busy }) {
  const { student, reasons, eligibility, missingFacts } = entry;
  const experience = student.roleExperienceLabel || (student.isFresher === true ? 'Fresher' : student.isFresher === false ? 'Experienced; duration not provided' : 'Experience not provided');
  return <article aria-label={`Candidate ${student.fullName || 'Unnamed'}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold text-slate-950 [overflow-wrap:anywhere]">{student.fullName || 'Name not provided'}</h2>
        <p className="mt-1 font-semibold text-indigo-800 [overflow-wrap:anywhere]">{student.primaryTargetRole || studentRoleLabels(student).join(', ') || 'Desired role not provided'}</p>
        <p className="mt-1 text-sm text-slate-700 [overflow-wrap:anywhere]">{[student.degree || 'Qualification not provided', student.branch, student.graduationYear ? `Batch ${student.graduationYear}` : ''].filter(Boolean).join(' · ')}</p>
        <p className="mt-1 text-sm text-slate-600">{[student.currentCity || 'Current city not provided', student.currentArea, experience, student.availabilityLabel || 'Joining time not provided'].filter(Boolean).join(' · ')}</p>
      </div>
      <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={selected} onChange={onSelect} aria-label={`Shortlist ${student.fullName}`} />Shortlist</label>
    </div>
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Candidate skills">
      {student.skills?.length ? student.skills.map(skill => <button key={skill} type="button" onClick={() => onSkill(skill)} aria-pressed={filters.skills.some(value => candidateSkillKey(value) === candidateSkillKey(skill))} className={`min-h-11 max-w-full rounded-lg border px-3 py-2 text-xs font-semibold [overflow-wrap:anywhere] ${filters.skills.some(value => candidateSkillKey(value) === candidateSkillKey(skill)) ? 'border-indigo-400 bg-indigo-50 text-indigo-900' : 'border-slate-200 text-slate-700'}`}>{formatSkillLabel(skill)}</button>) : <span className="text-sm text-amber-800">Skills not provided</span>}
    </div>
    {reasons.length > 0 && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950"><p className="font-bold">Why this candidate appears</p><ul className="mt-1 list-inside list-disc space-y-1 [overflow-wrap:anywhere]">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
    {eligibility && <div className={`mt-3 rounded-xl border p-3 text-sm ${eligibility.status === 'eligible' ? 'border-emerald-200 text-emerald-900' : 'border-amber-200 text-amber-900'}`}><p className="font-semibold">{STATUS[eligibility.status]}</p>{[...eligibility.reasons, ...eligibility.missing].map(reason => <p key={reason}>{reason}</p>)}</div>}
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {!student.isActive && <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700">Deactivated account</span>}
      {!student.hasRegistrationConsents && <span className="rounded-lg bg-rose-50 px-2 py-1 text-rose-800">Sharing consent pending</span>}
      {!student.profileComplete && <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-900">Account profile incomplete</span>}
    </div>
    {missingFacts.length > 0 && <p className="mt-2 text-xs text-amber-900">Ask for missing matching details: {missingFacts.join(', ')}. Missing information is not a failed qualification.</p>}
    <details className="mt-3 border-t border-slate-100 pt-2">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-800">Contact and full profile</summary>
      <dl className="mt-2 grid min-w-0 gap-3 text-sm sm:grid-cols-2 [&_dt]:text-xs [&_dt]:font-semibold [&_dt]:text-slate-500 [&_dd]:mt-1 [&_dd]:[overflow-wrap:anywhere]">
        <div><dt>Email</dt><dd>{student.contactEmail ? <a className="text-cyan-800 underline" href={`mailto:${student.contactEmail}`}>{student.contactEmail}</a> : 'Not provided'}</dd></div>
        <div><dt>Phone</dt><dd className="flex flex-wrap gap-2">{student.phone || 'Not provided'}{student.phone && <WhatsAppContactLink phone={student.phone} />}</dd></div>
        <div><dt>College / institution</dt><dd>{student.college || 'Not provided'}</dd></div>
        <div><dt>Education status</dt><dd>{student.educationStatus || 'Not provided'}</dd></div>
        <div><dt>All desired roles</dt><dd>{studentRoleLabels(student).join(', ') || 'Not provided'}</dd></div>
        <div><dt>Career sectors</dt><dd>{student.targetJobCategoryLabels?.join(', ') || 'Not provided'}</dd></div>
        <div><dt>Preferred work locations</dt><dd>{student.preferredLocations?.join(', ') || 'Not provided'}</dd></div>
        <div><dt>Willing to relocate</dt><dd>{student.willingToRelocate == null ? 'Not provided' : student.willingToRelocate ? 'Yes' : 'No'}</dd></div>
        <div><dt>Certifications / courses</dt><dd>{student.certificationsText || 'Not provided'}</dd></div>
        <div><dt>Expected monthly salary</dt><dd>{student.expectedSalaryMin || student.expectedSalaryMax ? `₹${student.expectedSalaryMin || 'Not specified'} – ₹${student.expectedSalaryMax || 'Not specified'}` : 'Not provided'}</dd></div>
        <div><dt>Registered</dt><dd>{formatStudentRegisteredAt(student.createdAt)}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onShare} className="min-h-11 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900">Share profile</button><button type="button" disabled={busy} onClick={onToggleActive} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-40">{student.isActive ? 'Deactivate' : 'Activate'}</button></div>
    </details>
  </article>;
}
