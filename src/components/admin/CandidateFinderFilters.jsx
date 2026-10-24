import { useState } from 'react';
import { candidateSkillKey, MISSING_CANDIDATE_FACTS, qualificationKey, TALENT_POOL_OPTIONS } from '../../lib/adminCandidateSearch';
import { STUDENT_AVAILABILITY_OPTIONS, STUDENT_ROLE_EXPERIENCE_OPTIONS } from '../../lib/studentCareerPreferences';
import { formatSkillLabel, STUDENT_DEGREE_OPTIONS } from '../../lib/studentProfileOptions';

const INPUT =
  'mt-1 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export function CandidateSelect({ label, value, onChange, options, emptyLabel = 'Any' }) {
  return (
    <label className="block min-w-0 text-sm font-semibold text-slate-700">
      {label}
      <select
        aria-label={label}
        className={INPUT}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {emptyLabel !== null && <option value="">{emptyLabel}</option>}
        {value && !options.some((option) => String(option.value ?? option) === value) && (
          <option value={value}>{value}</option>
        )}
        {options.map((option) => (
          <option key={option.value ?? option} value={option.value ?? option}>
            {option.label ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

const POPULAR_TARGET_ROLES = [
  'Delivery Boy',
  'Delivery Executive',
  'Telecaller',
  'Java Developer',
  'React Developer',
  'Python Developer',
  'Full Stack Developer',
  'GIS Developer',
  'Teacher',
  'Accountant',
  'Digital Marketing',
  'Sales Executive',
  'Data Analyst',
  'Mechanical Engineer',
  'Civil Engineer',
];

export default function CandidateFinderFilters({
  filters,
  onChange,
  skills,
  roles,
  categories,
  degrees,
  branches,
  years,
  colleges = [],
  locations = [],
  jobs,
  jobCounts,
  onClear,
}) {
  const [skillDraft, setSkillDraft] = useState('');

  const toggleSkill = (value) => {
    const key = candidateSkillKey(value);
    onChange({
      skills: filters.skills.some((skill) => candidateSkillKey(skill) === key)
        ? filters.skills.filter((skill) => candidateSkillKey(skill) !== key)
        : [...filters.skills, key].slice(0, 16),
    });
  };

  const addSkill = () => {
    const key = candidateSkillKey(skillDraft);
    if (!key || key.length > 48 || filters.skills.length >= 16) return;
    if (!filters.skills.some((skill) => candidateSkillKey(skill) === key)) {
      onChange({ skills: [...filters.skills, key] });
    }
    setSkillDraft('');
  };

  const toggleDegree = (value) =>
    onChange({
      degrees: filters.degrees.some(
        (degree) => qualificationKey(degree) === qualificationKey(value)
      )
        ? filters.degrees.filter(
            (degree) => qualificationKey(degree) !== qualificationKey(value)
          )
        : [...filters.degrees, value],
    });

  const qualifications = [
    ...new Map(
      [
        ...degrees.map((item) => item.value),
        ...STUDENT_DEGREE_OPTIONS,
        ...filters.degrees,
      ].map((value) => [qualificationKey(value), value])
    ).values(),
  ];

  return (
    <section
      aria-label="Find the right candidates"
      className="mb-5 min-w-0 space-y-5 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-5"
    >
      {/* Header and Reset */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">Find the right candidates</h2>
          <p className="mt-1 text-sm text-slate-600">
            Target students easily by skills, degree/branch, desired job role, and experience. Every requirement you set filters candidates instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onClear();
            setSkillDraft('');
          }}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Reset all filters
        </button>
      </div>

      {/* Role Talent Pools Bar */}
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-white to-amber-50/60 p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
              <span>🎯 Curated Role Talent Pools:</span>
              <span className="font-semibold normal-case text-indigo-700 text-xs">
                (Click to isolate candidates looking for specific roles in Vizag)
              </span>
            </p>
          </div>
          {filters.talentPool && (
            <button
              type="button"
              onClick={() => onChange({ talentPool: '' })}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 underline"
            >
              Clear Talent Pool (View All)
            </button>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {TALENT_POOL_OPTIONS.map((pool) => {
            const isSelected = filters.talentPool === pool.value;
            return (
              <button
                key={pool.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChange({ talentPool: isSelected ? '' : pool.value })}
                className={`min-h-10 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/50'
                }`}
              >
                <span>{pool.label}</span>
                {isSelected && <span className="ml-1 text-indigo-200 font-extrabold">✓</span>}
              </button>
            );
          })}
        </div>
        {filters.talentPool && (
          <div className="mt-2.5 rounded-lg bg-indigo-100/70 px-3 py-1.5 text-xs font-medium text-indigo-950 flex items-center justify-between">
            <span>
              Showing talent pool: <strong>{TALENT_POOL_OPTIONS.find((p) => p.value === filters.talentPool)?.label}</strong>. You can combine this with locality/area, batch, or experience filters below.
            </span>
          </div>
        )}
      </div>

      {/* Quick 1-Click Targeting Bar */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">
          ⚡ 1-Click Quick Targeting Presets:
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* Experience Quick Filters */}
          <button
            type="button"
            aria-pressed={filters.experience === 'fresher'}
            onClick={() =>
              onChange({ experience: filters.experience === 'fresher' ? '' : 'fresher' })
            }
            className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              filters.experience === 'fresher'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            }`}
          >
            🌱 Freshers Only
          </button>
          <button
            type="button"
            aria-pressed={filters.experience === 'experienced'}
            onClick={() =>
              onChange({ experience: filters.experience === 'experienced' ? '' : 'experienced' })
            }
            className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              filters.experience === 'experienced'
                ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                : 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100'
            }`}
          >
            💼 Experienced
          </button>

          {/* Availability Quick Filter */}
          <button
            type="button"
            aria-pressed={filters.availability === 'immediate'}
            onClick={() =>
              onChange({
                availability: filters.availability === 'immediate' ? '' : 'immediate',
              })
            }
            className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              filters.availability === 'immediate'
                ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            ⚡ Immediate Joiners
          </button>

          {/* Location Quick Filter */}
          <button
            type="button"
            aria-pressed={
              filters.preferredLocation === 'Visakhapatnam' || filters.city === 'Vizag'
            }
            onClick={() =>
              onChange({
                preferredLocation:
                  filters.preferredLocation === 'Visakhapatnam' ? '' : 'Visakhapatnam',
              })
            }
            className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              filters.preferredLocation === 'Visakhapatnam'
                ? 'border-cyan-700 bg-cyan-700 text-white shadow-xs'
                : 'border-cyan-300 bg-cyan-50 text-cyan-900 hover:bg-cyan-100'
            }`}
          >
            📍 Vizag Location
          </button>

          {/* Resume Quick Filter */}
          <button
            type="button"
            aria-pressed={filters.hasResume === 'yes'}
            onClick={() =>
              onChange({ hasResume: filters.hasResume === 'yes' ? 'all' : 'yes' })
            }
            className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              filters.hasResume === 'yes'
                ? 'border-purple-600 bg-purple-600 text-white shadow-xs'
                : 'border-purple-200 bg-purple-50 text-purple-900 hover:bg-purple-100'
            }`}
          >
            📄 Has Resume Only
          </button>

          <span className="text-slate-300">|</span>

          {/* Passout Batch Quick Filters */}
          {years.slice(0, 3).map((y) => {
            const isSelected = filters.year === y.value;
            return (
              <button
                key={y.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChange({ year: isSelected ? '' : y.value })}
                className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-900'
                }`}
              >
                🎓 Batch {y.value}
              </button>
            );
          })}

          <span className="text-slate-300">|</span>

          {/* Popular Target Roles Quick Pills */}
          {POPULAR_TARGET_ROLES.slice(0, 10).map((role) => {
            const isSelected = filters.roleQuery.toLowerCase() === role.toLowerCase();
            return (
              <button
                key={role}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  onChange({ roleQuery: isSelected ? '' : role })
                }
                className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs font-bold'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-900'
                }`}
              >
                {role}
              </button>
            );
          })}
        </div>
      </div>

      {/* Smart Keyword Search */}
      <label className="block text-sm font-semibold text-slate-800">
        Search across candidate profiles (Skills, Roles, Degree, College, Name, Phone, Batch)
        <input
          type="search"
          aria-label="Search across candidate details"
          className={INPUT}
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Try: React developer, BTech 2025, Python fresher, Accountant Tally, AU, GVP..."
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Searches names, skills, qualifications, graduation batches, institutions, target roles and locations.
        </span>
      </label>

      {/* Required Skills Section */}
      <fieldset className="min-w-0 rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-bold text-slate-800">Required skills</legend>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_auto]">
          <div className="flex min-w-0 gap-2">
            <label className="min-w-0 flex-1 text-sm text-slate-700">
              Add a skill
              <input
                className={INPUT}
                list="candidate-skill-options"
                value={skillDraft}
                onChange={(event) => setSkillDraft(event.target.value)}
                maxLength={48}
                placeholder="Search or type a skill (e.g. React, SQL, Tally, Excel)"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSkill();
                  }
                }}
              />
            </label>
            <datalist id="candidate-skill-options">
              {skills.map((skill) => (
                <option key={skill.value} value={skill.label} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={addSkill}
              disabled={!skillDraft.trim() || filters.skills.length >= 16}
              className="mt-6 min-h-11 shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 text-sm font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-40"
            >
              + Add skill
            </button>
          </div>
          <CandidateSelect
            label="Match selected skills"
            value={filters.skillMode}
            onChange={(skillMode) => onChange({ skillMode })}
            emptyLabel={null}
            options={[
              { value: 'all', label: 'All selected skills (Strict)' },
              { value: 'any', label: 'Any selected skill (Broad)' },
            ]}
          />
        </div>

        {/* Selected Skill Tags */}
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Selected skills">
          {filters.skills.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              aria-label={`Remove skill ${formatSkillLabel(skill)}`}
              className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-950 hover:bg-indigo-100 transition [overflow-wrap:anywhere]"
            >
              ✓ {formatSkillLabel(skill)} <span className="text-slate-400 font-normal">×</span>
            </button>
          ))}
          {!filters.skills.length && (
            <span className="text-xs text-slate-500">
              No skill restriction. Add skills to filter candidates with specific tech/tool proficiencies.
            </span>
          )}
        </div>

        {/* Popular Skills Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Popular skills:</span>
          {skills.slice(0, 8).map((skill) => {
            const isSelected = filters.skills.some(
              (value) => candidateSkillKey(value) === skill.value
            );
            return (
              <button
                key={skill.value}
                type="button"
                onClick={() => toggleSkill(skill.value)}
                aria-pressed={isSelected}
                className={`min-h-8 rounded-lg border px-2 py-0.5 text-xs transition ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white font-bold'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {skill.label} ({skill.count})
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Accepted Qualifications (Multi-Degree Checkboxes) */}
      <fieldset className="min-w-0 rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-bold text-slate-800">
          Accepted qualifications{' '}
          <span className="font-normal text-slate-500">— matches any selected degree</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {qualifications.map((degree) => {
            const isChecked = filters.degrees.some(
              (value) => qualificationKey(value) === qualificationKey(degree)
            );
            return (
              <label
                key={degree}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  isChecked
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-950 font-bold'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleDegree(degree)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {degree}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Primary Targeting Grid (Role, Branch, Batch, Exp, Locations, Availability) */}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0 text-sm font-semibold text-slate-700">
          Desired role contains
          <input
            aria-label="Desired role contains"
            className={INPUT}
            list="candidate-role-query-options"
            value={filters.roleQuery}
            onChange={(event) => onChange({ roleQuery: event.target.value })}
            placeholder="e.g. GIS, Developer, Telecaller, Accountant"
          />
          <datalist id="candidate-role-query-options">
            {(roles || []).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label || r.value}
              </option>
            ))}
          </datalist>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Searches primary and interested desired roles.
          </span>
        </label>

        <CandidateSelect
          label="Branch / stream"
          value={filters.branch}
          onChange={(branch) => onChange({ branch })}
          options={branches}
          emptyLabel="All branches / streams"
        />

        <CandidateSelect
          label="Graduation batch"
          value={filters.year}
          onChange={(year) => onChange({ year })}
          options={years}
          emptyLabel="All passout batches"
        />

        <CandidateSelect
          label="Experience"
          value={filters.experience}
          onChange={(experience) => onChange({ experience })}
          options={[
            { value: 'fresher', label: '🌱 Freshers only' },
            { value: 'experienced', label: '💼 Experienced (Any duration)' },
            ...STUDENT_ROLE_EXPERIENCE_OPTIONS.filter((opt) => opt.value !== 'fresher'),
          ]}
          emptyLabel="Any experience"
        />

        <label className="min-w-0 text-sm font-semibold text-slate-700">
          Preferred work location
          <input
            aria-label="Preferred work location"
            className={INPUT}
            list="preferred-work-location-options"
            value={filters.preferredLocation}
            onChange={(event) => onChange({ preferredLocation: event.target.value })}
            placeholder="e.g. Visakhapatnam, Remote, Hyderabad"
          />
          <datalist id="preferred-work-location-options">
            {locations.map((loc) => (
              <option key={loc.value} value={loc.value} />
            ))}
          </datalist>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Where candidate wants to work.
          </span>
        </label>

        <label className="min-w-0 text-sm font-semibold text-slate-700">
          Current city (residence)
          <input
            aria-label="Current city"
            className={INPUT}
            value={filters.city}
            onChange={(event) => onChange({ city: event.target.value })}
            placeholder="e.g. Vizag, Gajuwaka"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Where candidate currently resides.
          </span>
        </label>

        <label className="min-w-0 text-sm font-semibold text-slate-700">
          College / Institution
          <input
            aria-label="College / Institution"
            className={INPUT}
            list="college-institution-options"
            value={filters.college || ''}
            onChange={(event) => onChange({ college: event.target.value })}
            placeholder="e.g. Gayatri, GITAM, AU, ANITS"
          />
          <datalist id="college-institution-options">
            {colleges.map((col) => (
              <option key={col.value || col} value={col.value || col} />
            ))}
          </datalist>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Filters by candidate's college or institute.
          </span>
        </label>

        <CandidateSelect
          label="Resume attached"
          value={filters.hasResume || 'all'}
          onChange={(hasResume) => onChange({ hasResume })}
          options={[
            { value: 'all', label: 'All candidates' },
            { value: 'yes', label: '📄 Resume attached only' },
            { value: 'no', label: 'Without resume' },
          ]}
          emptyLabel={null}
        />

        <CandidateSelect
          label="Joining availability"
          value={filters.availability}
          onChange={(availability) => onChange({ availability })}
          options={STUDENT_AVAILABILITY_OPTIONS}
          emptyLabel="Any joining time"
        />

        <CandidateSelect
          label="Education status"
          value={filters.educationStatus}
          onChange={(educationStatus) => onChange({ educationStatus })}
          options={[
            { value: 'completed', label: 'Completed qualification' },
            { value: 'studying', label: 'Currently studying' },
          ]}
          emptyLabel="Any education status"
        />
      </div>

      {/* Advanced Filters (Collapsible) */}
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-800 hover:text-indigo-600">
          More targeting options: exact role, career sector, current area, certifications, and missing facts
        </summary>
        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CandidateSelect
            label="Exact target role"
            value={filters.role}
            onChange={(role) => onChange({ role })}
            options={roles}
            emptyLabel="All roles"
          />
          <CandidateSelect
            label="Career sector"
            value={filters.category}
            onChange={(category) => onChange({ category })}
            options={categories}
            emptyLabel="All sectors"
          />
          <CandidateSelect
            label="Willing to relocate"
            value={filters.relocation}
            onChange={(relocation) => onChange({ relocation })}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
          />
          <label className="min-w-0 text-sm font-semibold text-slate-700">
            Current area / locality
            <input
              className={INPUT}
              value={filters.area}
              onChange={(event) => onChange({ area: event.target.value })}
              placeholder="e.g. MVP Colony, Gajuwaka"
            />
          </label>
          <label className="min-w-0 text-sm font-semibold text-slate-700">
            Certification / course
            <input
              className={INPUT}
              value={filters.certification}
              onChange={(event) => onChange({ certification: event.target.value })}
              placeholder="e.g. AWS, Tally, Full Stack"
            />
          </label>
          <CandidateSelect
            label="Profile matching information"
            value={filters.dataStatus}
            onChange={(dataStatus) => onChange({ dataStatus })}
            options={[
              { value: 'ready', label: 'All core matching facts provided' },
              { value: 'missing', label: 'Missing one or more matching facts' },
              ...Object.entries(MISSING_CANDIDATE_FACTS).map(([value, label]) => ({
                value,
                label: `Missing ${label.toLowerCase()}`,
              })),
            ]}
          />
        </div>
      </details>

      {/* Reviewed Job Compatibility Check */}
      <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
        <CandidateSelect
          label="Check against a reviewed job"
          value={filters.job}
          onChange={(job) => onChange({ job, jobStatus: 'eligible' })}
          options={jobs.map((job) => ({
            value: job.id,
            label: `${job.title} — ${job.company}`,
          }))}
          emptyLabel="Choose a job (optional)"
        />
        <p className="mt-2 text-xs text-slate-600">
          Screen candidates against structured job requirements (degree, branch, experience, verified skills).
        </p>
        {filters.job && (
          <div className="mt-3">
            <CandidateSelect
              label="Job requirement result"
              value={filters.jobStatus}
              onChange={(jobStatus) => onChange({ jobStatus })}
              emptyLabel={null}
              options={[
                { value: 'eligible', label: `Meets reviewed requirements (${jobCounts.eligible})` },
                {
                  value: 'needs_information',
                  label: `Needs more information (${jobCounts.needs_information})`,
                },
                {
                  value: 'ineligible',
                  label: `Does not meet requirements (${jobCounts.ineligible})`,
                },
                { value: 'unverified', label: `Unverified (${jobCounts.unverified})` },
                { value: 'all', label: 'All requirement results' },
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}
