import { useState } from 'react';
import { candidateSkillKey, MISSING_CANDIDATE_FACTS, qualificationKey } from '../../lib/adminCandidateSearch';
import { STUDENT_AVAILABILITY_OPTIONS, STUDENT_ROLE_EXPERIENCE_OPTIONS } from '../../lib/studentCareerPreferences';
import { formatSkillLabel, STUDENT_DEGREE_OPTIONS } from '../../lib/studentProfileOptions';

const INPUT = 'mt-1 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export function CandidateSelect({ label, value, onChange, options, emptyLabel = 'Any' }) {
  return <label className="block min-w-0 text-sm font-semibold text-slate-700">{label}
    <select aria-label={label} className={INPUT} value={value} onChange={event => onChange(event.target.value)}>
      {emptyLabel !== null && <option value="">{emptyLabel}</option>}
      {value && !options.some(option => String(option.value ?? option) === value) && <option value={value}>{value}</option>}
      {options.map(option => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}
    </select>
  </label>;
}

export default function CandidateFinderFilters({ filters, onChange, skills, roles, categories, degrees, branches, years, jobs, jobCounts, onClear }) {
  const [skillDraft, setSkillDraft] = useState('');
  const toggleSkill = value => {
    const key = candidateSkillKey(value);
    onChange({ skills: filters.skills.some(skill => candidateSkillKey(skill) === key)
      ? filters.skills.filter(skill => candidateSkillKey(skill) !== key)
      : [...filters.skills, key].slice(0, 16) });
  };
  const addSkill = () => {
    const key = candidateSkillKey(skillDraft);
    if (!key || key.length > 48 || filters.skills.length >= 16) return;
    if (!filters.skills.some(skill => candidateSkillKey(skill) === key)) onChange({ skills: [...filters.skills, key] });
    setSkillDraft('');
  };
  const toggleDegree = value => onChange({ degrees: filters.degrees.some(degree => qualificationKey(degree) === qualificationKey(value))
    ? filters.degrees.filter(degree => qualificationKey(degree) !== qualificationKey(value)) : [...filters.degrees, value] });
  const qualifications = [...new Map([...degrees.map(item => item.value), ...STUDENT_DEGREE_OPTIONS, ...filters.degrees].map(value => [qualificationKey(value), value])).values()];

  return <section aria-label="Find the right candidates" className="mb-5 min-w-0 space-y-5 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-950">Find the right candidates</h2>
        <p className="mt-1 text-sm text-slate-600">Combine skills, qualifications and the job they want. Every selected requirement must match.</p></div>
      <button type="button" onClick={() => { onClear(); setSkillDraft(''); }} className="min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold">Reset filters</button>
    </div>
    <label className="block text-sm font-semibold text-slate-700">Search across candidate details
      <input type="search" aria-label="Search across candidate details" className={INPUT} value={filters.search} onChange={event => onChange({ search: event.target.value })} placeholder="Try React BTech Vizag, a name, college or phone" />
      <span className="mt-1 block text-xs font-normal text-slate-500">Words can appear in different fields. Use quotes for an exact phrase.</span>
    </label>

    <fieldset className="min-w-0 rounded-xl border border-slate-200 p-3">
      <legend className="px-1 text-sm font-bold text-slate-800">Required skills</legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 gap-2">
          <label className="min-w-0 flex-1 text-sm text-slate-700">Add a skill
            <input className={INPUT} list="candidate-skill-options" value={skillDraft} onChange={event => setSkillDraft(event.target.value)} maxLength={48} placeholder="Search or type a skill" onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSkill(); } }} />
          </label>
          <datalist id="candidate-skill-options">{skills.map(skill => <option key={skill.value} value={skill.label} />)}</datalist>
          <button type="button" onClick={addSkill} disabled={!skillDraft.trim() || filters.skills.length >= 16} className="mt-6 min-h-11 shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-bold text-indigo-800 disabled:opacity-40">Add skill</button>
        </div>
        <CandidateSelect label="Match selected skills" value={filters.skillMode} onChange={skillMode => onChange({ skillMode })} emptyLabel={null} options={[{ value: 'all', label: 'All selected skills' }, { value: 'any', label: 'Any selected skill' }]} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Selected skills">
        {filters.skills.map(skill => <button key={skill} type="button" onClick={() => toggleSkill(skill)} aria-label={`Remove skill ${formatSkillLabel(skill)}`} className="min-h-11 max-w-full rounded-full border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900 [overflow-wrap:anywhere]">{formatSkillLabel(skill)} ×</button>)}
        {!filters.skills.length && <span className="text-xs text-slate-500">No skill restriction. Add several skills to build a focused list.</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">Common skills:</span>{skills.slice(0, 6).map(skill => <button key={skill.value} type="button" onClick={() => toggleSkill(skill.value)} aria-pressed={filters.skills.some(value => candidateSkillKey(value) === skill.value)} className="min-h-11 rounded-lg border px-2 py-1 text-xs">{skill.label} ({skill.count})</button>)}</div>
    </fieldset>

    <fieldset className="min-w-0"><legend className="text-sm font-bold text-slate-800">Accepted qualifications <span className="font-normal text-slate-500">— any selected qualification</span></legend>
      <div className="mt-2 flex flex-wrap gap-2">{qualifications.map(degree => <label key={degree} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={filters.degrees.some(value => qualificationKey(value) === qualificationKey(degree))} onChange={() => toggleDegree(degree)} className="h-4 w-4" />{degree}</label>)}</div>
    </fieldset>

    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="min-w-0 text-sm font-semibold text-slate-700">Desired role contains<input aria-label="Desired role contains" className={INPUT} value={filters.roleQuery} onChange={event => onChange({ roleQuery: event.target.value })} placeholder="e.g. Developer, Accountant" /><span className="mt-1 block text-xs font-normal text-slate-500">Searches primary and secondary desired roles.</span></label>
      <label className="min-w-0 text-sm font-semibold text-slate-700">Current city<input aria-label="Current city" className={INPUT} value={filters.city} onChange={event => onChange({ city: event.target.value })} placeholder="e.g. Vizag" /><span className="mt-1 block text-xs font-normal text-slate-500">Current residence, not preferred work location.</span></label>
      <CandidateSelect label="Experience" value={filters.experience} onChange={experience => onChange({ experience })} options={[{ value: 'experienced', label: 'Experienced — any duration' }, ...STUDENT_ROLE_EXPERIENCE_OPTIONS]} emptyLabel="Any experience" />
      <CandidateSelect label="Joining availability" value={filters.availability} onChange={availability => onChange({ availability })} options={STUDENT_AVAILABILITY_OPTIONS} emptyLabel="Any joining time" />
    </div>

    <details className="rounded-xl border border-slate-200 p-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-800">More filters: exact role, sector, branch, batch and missing information</summary>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CandidateSelect label="Exact target or interested role" value={filters.role} onChange={role => onChange({ role })} options={roles} emptyLabel="All roles" />
        <CandidateSelect label="Career sector" value={filters.category} onChange={category => onChange({ category })} options={categories} emptyLabel="All sectors" />
        <CandidateSelect label="Branch / stream" value={filters.branch} onChange={branch => onChange({ branch })} options={branches} />
        <CandidateSelect label="Graduation batch" value={filters.year} onChange={year => onChange({ year })} options={years} />
        <CandidateSelect label="Education status" value={filters.educationStatus} onChange={educationStatus => onChange({ educationStatus })} options={[{ value: 'studying', label: 'Currently studying' }, { value: 'completed', label: 'Completed' }]} />
        <CandidateSelect label="Willing to relocate" value={filters.relocation} onChange={relocation => onChange({ relocation })} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
        <label className="min-w-0 text-sm font-semibold text-slate-700">Current area<input className={INPUT} value={filters.area} onChange={event => onChange({ area: event.target.value })} /></label>
        <label className="min-w-0 text-sm font-semibold text-slate-700">Certification / course<input className={INPUT} value={filters.certification} onChange={event => onChange({ certification: event.target.value })} placeholder="e.g. AWS, Tally" /></label>
        <CandidateSelect label="Profile matching information" value={filters.dataStatus} onChange={dataStatus => onChange({ dataStatus })} options={[{ value: 'ready', label: 'All core matching facts provided' }, { value: 'missing', label: 'Missing one or more matching facts' }, ...Object.entries(MISSING_CANDIDATE_FACTS).map(([value, label]) => ({ value, label: `Missing ${label.toLowerCase()}` }))]} />
      </div>
    </details>

    <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
      <CandidateSelect label="Check against a reviewed job" value={filters.job} onChange={job => onChange({ job, jobStatus: 'eligible' })} options={jobs.map(job => ({ value: job.id, label: `${job.title} — ${job.company}` }))} emptyLabel="Choose a job (optional)" />
      <p className="mt-2 text-xs text-slate-600">Use your own criteria above when a job has no reviewed requirements. Job checks are screening aids; verify facts before shortlisting.</p>
      {filters.job && <div className="mt-3"><CandidateSelect label="Job requirement result" value={filters.jobStatus} onChange={jobStatus => onChange({ jobStatus })} emptyLabel={null} options={[
        { value: 'eligible', label: `Meets reviewed requirements (${jobCounts.eligible})` },
        { value: 'needs_information', label: `Needs more information (${jobCounts.needs_information})` },
        { value: 'ineligible', label: `Does not meet requirements (${jobCounts.ineligible})` },
        { value: 'unverified', label: `Unverified (${jobCounts.unverified})` },
        { value: 'all', label: 'All requirement results' },
      ]} /></div>}
    </div>
  </section>;
}
