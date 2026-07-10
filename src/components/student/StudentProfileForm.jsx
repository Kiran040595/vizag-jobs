import { useEffect, useMemo, useState } from 'react';
import { upsertStudentProfile } from '../../services/studentJobs';
import { recordStudentRegistrationConsents } from '../../services/studentConsent';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { EMPTY_STUDENT_CONSENTS, hasStudentRegistrationConsents, validateStudentConsents } from '../../lib/studentConsent';
import StudentRegistrationConsent from './StudentRegistrationConsent';
import StudentSkillMatchNotice from './StudentSkillMatchNotice';
import {
  groupSkillOptions,
  STUDENT_BRANCH_OPTIONS,
  STUDENT_DEGREE_OPTIONS,
  STUDENT_GRADUATION_YEAR_OPTIONS,
} from '../../lib/studentProfileOptions';

const INPUT_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

const SELECT_CLASS = `${INPUT_CLASS} h-12`;

export default function StudentProfileForm({ onSaved }) {
  const { profile, refreshStudentAccess, user } = useStudentAuth();
  const [form, setForm] = useState({
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
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [consents, setConsents] = useState(EMPTY_STUDENT_CONSENTS);
  const needsConsent = profile ? !hasStudentRegistrationConsents(profile) : true;

  const skillGroups = useMemo(() => groupSkillOptions(), []);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        college: profile.college || '',
        degree: profile.degree || '',
        branch: profile.branch || '',
        graduation_year: profile.graduation_year ? String(profile.graduation_year) : '',
        contact_email: profile.contact_email || user?.email || '',
        phone: profile.phone || '',
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        certifications: Array.isArray(profile.certifications)
          ? profile.certifications.join(', ')
          : '',
        is_fresher: typeof profile.is_fresher === 'boolean' ? profile.is_fresher : null,
      });
    } else if (user?.email) {
      setForm((current) => ({
        ...current,
        contact_email: user.email,
      }));
    }
  }, [profile, user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleFresherChange = (value) => {
    setForm((current) => ({
      ...current,
      is_fresher: value === 'yes',
    }));
  };

  const toggleSkill = (skillValue) => {
    setForm((current) => {
      const selected = new Set(current.skills);
      if (selected.has(skillValue)) {
        selected.delete(skillValue);
      } else {
        selected.add(skillValue);
      }
      return { ...current, skills: [...selected] };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSaving(true);

    try {
      if (needsConsent) {
        validateStudentConsents(consents);
        await recordStudentRegistrationConsents(consents);
      }
      const saved = await upsertStudentProfile(form);
      if (user?.id) {
        await refreshStudentAccess(user.id);
      }
      setNotice('Student profile saved. You can now apply to jobs.');
      onSaved?.(saved);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <StudentSkillMatchNotice className="mb-6" />
      <h2 className="text-2xl font-black text-slate-950">Student profile</h2>
      <p className="mt-2 text-sm text-slate-600">
        Complete every field below before applying to jobs. Accurate skills and certifications help us pass
        your profile to matching employers in Vizag (Java, frontend, delivery, BPO, and more).
      </p>

      {notice ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Full name *</span>
          <input
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            required
            className={INPUT_CLASS}
            placeholder="Your full name"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">College / university *</span>
          <input
            name="college"
            value={form.college}
            onChange={handleChange}
            required
            className={INPUT_CLASS}
            placeholder="Andhra University, GITAM, etc."
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Degree *</span>
          <select
            name="degree"
            value={form.degree}
            onChange={handleChange}
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
            name="branch"
            value={form.branch}
            onChange={handleChange}
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
            name="graduation_year"
            value={form.graduation_year}
            onChange={handleChange}
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
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            required
            inputMode="numeric"
            autoComplete="tel"
            placeholder="9876543210"
            className={INPUT_CLASS}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Contact email</span>
          <input
            type="email"
            name="contact_email"
            value={form.contact_email}
            onChange={handleChange}
            className={INPUT_CLASS}
            placeholder="Optional if you signed up with mobile"
          />
        </label>

        <fieldset className="block sm:col-span-2">
          <legend className="text-sm font-semibold text-slate-700">Are you a fresher? *</legend>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="is_fresher"
                checked={form.is_fresher === true}
                onChange={() => handleFresherChange('yes')}
                required={form.is_fresher === null}
              />
              Yes — entry-level / no full-time experience
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="is_fresher"
                checked={form.is_fresher === false}
                onChange={() => handleFresherChange('no')}
                required={form.is_fresher === null}
              />
              No — I have work experience
            </label>
          </div>
        </fieldset>

        <fieldset className="block sm:col-span-2">
          <legend className="text-sm font-semibold text-slate-700">Skills * (select all that apply)</legend>
          <p className="mt-1 text-xs text-slate-500">Stored in a standard format so recruiters can filter Java, React, delivery, etc.</p>
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
                        onClick={() => toggleSkill(option.value)}
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
          </div>
        </fieldset>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Certifications / courses completed *</span>
          <textarea
            name="certifications"
            value={form.certifications}
            onChange={handleChange}
            required
            rows={3}
            className={INPUT_CLASS}
            placeholder="Java Full Stack (Udemy), AWS Cloud Practitioner, NPTEL Python — or type None"
          />
        </label>

        <div className="sm:col-span-2">
          <StudentSkillMatchNotice />
        </div>

        {needsConsent ? (
          <div className="sm:col-span-2">
            <StudentRegistrationConsent values={consents} onChange={setConsents} idPrefix="student-profile-consent" />
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </section>
  );
}
