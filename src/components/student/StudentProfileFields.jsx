import { useMemo, useState } from 'react';
import {
  formatJobCategoryLabel,
  resolveTargetJobCategoryToken,
  STUDENT_AVAILABILITY_OPTIONS,
  STUDENT_JOB_CATEGORY_OPTIONS,
  STUDENT_PREFERRED_LOCATION_OPTIONS,
  STUDENT_ROLE_EXPERIENCE_OPTIONS,
} from '../../lib/studentCareerPreferences';
import {
  formatSkillLabel,
  groupSkillOptions,
  resolveSkillToken,
  STUDENT_BRANCH_OPTIONS,
  STUDENT_DEGREE_OPTIONS,
  STUDENT_GRADUATION_YEAR_OPTIONS,
  STUDENT_SKILL_OPTIONS,
} from '../../lib/studentProfileOptions';

const INPUT_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

const SELECT_CLASS = `${INPUT_CLASS} h-12`;

const CHIP_INPUT_CLASS =
  'h-10 min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

export const EMPTY_STUDENT_PROFILE_FORM = {
  full_name: '',
  college: '',
  degree: '',
  branch: '',
  graduation_year: '',
  contact_email: '',
  phone: '',
  skills: [],
  certifications: '',
  is_fresher: null,
  target_job_categories: [],
  primary_target_role: '',
  role_experience_level: '',
  preferred_locations: [],
  availability: '',
  expected_salary_min: '',
  expected_salary_max: '',
};

export default function StudentProfileFields({
  form,
  onChange,
  onFresherChange,
  onToggleSkill,
  onAddSkill,
  onToggleTargetCategory,
  onAddTargetCategory,
  onTogglePreferredLocation,
  includeContactEmail = true,
  idPrefix = 'student-profile',
}) {
  const skillGroups = useMemo(() => groupSkillOptions(), []);
  const [customCategoryDraft, setCustomCategoryDraft] = useState('');
  const [customSkillDraft, setCustomSkillDraft] = useState('');

  const locationOptions = [
    ...STUDENT_PREFERRED_LOCATION_OPTIONS,
    ...form.preferred_locations.filter(
      (location) => !STUDENT_PREFERRED_LOCATION_OPTIONS.includes(location),
    ),
  ];

  const categoryOptions = useMemo(() => {
    const presetValues = new Set(STUDENT_JOB_CATEGORY_OPTIONS.map((option) => option.value));
    const custom = form.target_job_categories
      .filter((value) => !presetValues.has(value))
      .map((value) => ({ value, label: formatJobCategoryLabel(value) }));
    return [...STUDENT_JOB_CATEGORY_OPTIONS, ...custom];
  }, [form.target_job_categories]);

  const customSkills = useMemo(() => {
    const presetValues = new Set(STUDENT_SKILL_OPTIONS.map((option) => option.value));
    return form.skills
      .filter((value) => !presetValues.has(value))
      .map((value) => ({ value, label: formatSkillLabel(value) }));
  }, [form.skills]);

  const addCustomCategory = () => {
    const token = resolveTargetJobCategoryToken(customCategoryDraft);
    if (!token) {
      return;
    }
    if (onAddTargetCategory) {
      onAddTargetCategory(token);
    } else {
      onToggleTargetCategory(token);
    }
    setCustomCategoryDraft('');
  };

  const addCustomSkill = () => {
    const token = resolveSkillToken(customSkillDraft);
    if (!token) {
      return;
    }
    if (onAddSkill) {
      onAddSkill(token);
    } else {
      onToggleSkill(token);
    }
    setCustomSkillDraft('');
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="text-sm font-semibold text-slate-700">Full name *</span>
        <input
          id={`${idPrefix}-full-name`}
          name="full_name"
          value={form.full_name}
          onChange={onChange}
          required
          className={INPUT_CLASS}
          placeholder="Your full name"
        />
      </label>

      <label className="block sm:col-span-2">
        <span className="text-sm font-semibold text-slate-700">College / university *</span>
        <input
          id={`${idPrefix}-college`}
          name="college"
          value={form.college}
          onChange={onChange}
          required
          className={INPUT_CLASS}
          placeholder="Andhra University, GITAM, etc."
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Degree *</span>
        <select
          id={`${idPrefix}-degree`}
          name="degree"
          value={form.degree}
          onChange={onChange}
          required
          className={SELECT_CLASS}
        >
          <option value="">Select degree</option>
          {STUDENT_DEGREE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Branch *</span>
        <select
          id={`${idPrefix}-branch`}
          name="branch"
          value={form.branch}
          onChange={onChange}
          required
          className={SELECT_CLASS}
        >
          <option value="">Select branch</option>
          {STUDENT_BRANCH_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Graduation year *</span>
        <select
          id={`${idPrefix}-graduation-year`}
          name="graduation_year"
          value={form.graduation_year}
          onChange={onChange}
          required
          className={SELECT_CLASS}
        >
          <option value="">Select year</option>
          {STUDENT_GRADUATION_YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Mobile number *</span>
        <input
          id={`${idPrefix}-phone`}
          name="phone"
          type="tel"
          value={form.phone}
          onChange={onChange}
          required
          inputMode="numeric"
          autoComplete="tel"
          placeholder="9876543210"
          className={INPUT_CLASS}
        />
      </label>

      {includeContactEmail ? (
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Contact email</span>
          <input
            id={`${idPrefix}-contact-email`}
            type="email"
            name="contact_email"
            value={form.contact_email}
            onChange={onChange}
            className={INPUT_CLASS}
            placeholder="Optional contact email"
          />
        </label>
      ) : null}

      <fieldset className="block sm:col-span-2">
        <legend className="text-sm font-semibold text-slate-700">Are you a fresher? *</legend>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name={`${idPrefix}-is_fresher`}
              checked={form.is_fresher === true}
              onChange={() => onFresherChange('yes')}
              required={form.is_fresher === null}
            />
            Yes — entry-level / no full-time experience
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name={`${idPrefix}-is_fresher`}
              checked={form.is_fresher === false}
              onChange={() => onFresherChange('no')}
              required={form.is_fresher === null}
            />
            No — I have work experience
          </label>
        </div>
      </fieldset>

      <fieldset className="block sm:col-span-2">
        <legend className="text-sm font-semibold text-slate-700">
          What type of jobs are you trying for? *
        </legend>
        <p className="mt-1 text-xs text-slate-500">
          Pick from the list or type another job type — it is added as a selected chip.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {categoryOptions.map((option) => {
            const selected = form.target_job_categories.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggleTargetCategory(option.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? 'border-cyan-500 bg-cyan-500 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-200'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id={`${idPrefix}-custom-job-category`}
            type="text"
            value={customCategoryDraft}
            onChange={(event) => setCustomCategoryDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomCategory();
              }
            }}
            className={CHIP_INPUT_CLASS}
            placeholder="Type another job type, e.g. Hotel Management"
            maxLength={64}
          />
          <button
            type="button"
            onClick={addCustomCategory}
            className="h-10 shrink-0 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
          >
            Add job type
          </button>
        </div>
      </fieldset>

      <label className="block sm:col-span-2">
        <span className="text-sm font-semibold text-slate-700">Primary target role *</span>
        <input
          id={`${idPrefix}-primary-target-role`}
          name="primary_target_role"
          value={form.primary_target_role}
          onChange={onChange}
          required
          className={INPUT_CLASS}
          placeholder="Backend Developer, Telecaller, Mechanical Technician, Nurse, Accountant..."
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Experience in this role *</span>
        <select
          id={`${idPrefix}-role-experience`}
          name="role_experience_level"
          value={form.role_experience_level}
          onChange={onChange}
          required
          className={SELECT_CLASS}
        >
          <option value="">Select experience</option>
          {STUDENT_ROLE_EXPERIENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">When can you join? *</span>
        <select
          id={`${idPrefix}-availability`}
          name="availability"
          value={form.availability}
          onChange={onChange}
          required
          className={SELECT_CLASS}
        >
          <option value="">Select availability</option>
          {STUDENT_AVAILABILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="block sm:col-span-2">
        <legend className="text-sm font-semibold text-slate-700">Preferred work locations *</legend>
        <p className="mt-1 text-xs text-slate-500">
          Pick Vizag areas or Remote so we can suggest nearby openings.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {locationOptions.map((option) => {
            const selected = form.preferred_locations.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => onTogglePreferredLocation(option)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? 'border-cyan-500 bg-cyan-500 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-200'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:col-span-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Expected salary min / month</span>
          <input
            id={`${idPrefix}-salary-min`}
            name="expected_salary_min"
            type="number"
            min="1"
            inputMode="numeric"
            value={form.expected_salary_min}
            onChange={onChange}
            className={INPUT_CLASS}
            placeholder="15000"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Expected salary max / month</span>
          <input
            id={`${idPrefix}-salary-max`}
            name="expected_salary_max"
            type="number"
            min="1"
            inputMode="numeric"
            value={form.expected_salary_max}
            onChange={onChange}
            className={INPUT_CLASS}
            placeholder="25000"
          />
        </label>
      </div>

      <fieldset className="block sm:col-span-2">
        <legend className="text-sm font-semibold text-slate-700">Skills * (select all that apply)</legend>
        <p className="mt-1 text-xs text-slate-500">
          Pick from the list or type another skill — it is added as a selected chip.
        </p>
        <div className="mt-4 space-y-4">
          {skillGroups.map(([groupName, options]) => (
            <div key={groupName}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{groupName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {options.map((option) => {
                  const selected = form.skills.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onToggleSkill(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        selected
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {customSkills.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Custom</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {customSkills.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onToggleSkill(option.value)}
                    className="rounded-full border border-indigo-500 bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id={`${idPrefix}-custom-skill`}
            type="text"
            value={customSkillDraft}
            onChange={(event) => setCustomSkillDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomSkill();
              }
            }}
            className={CHIP_INPUT_CLASS}
            placeholder="Type another skill, e.g. Power BI"
            maxLength={48}
          />
          <button
            type="button"
            onClick={addCustomSkill}
            className="h-10 shrink-0 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100"
          >
            Add skill
          </button>
        </div>
      </fieldset>

      <label className="block sm:col-span-2">
        <span className="text-sm font-semibold text-slate-700">Certifications / courses completed *</span>
        <textarea
          id={`${idPrefix}-certifications`}
          name="certifications"
          value={form.certifications}
          onChange={onChange}
          required
          rows={3}
          className={INPUT_CLASS}
          placeholder="Java Full Stack (Udemy), AWS Cloud Practitioner, NPTEL Python — or type None"
        />
      </label>
    </div>
  );
}
