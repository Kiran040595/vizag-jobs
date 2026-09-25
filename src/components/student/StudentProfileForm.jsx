import { useEffect, useState } from 'react';
import { upsertStudentProfile } from '../../services/studentJobs';
import { recordStudentRegistrationConsents } from '../../services/studentConsent';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { EMPTY_STUDENT_CONSENTS, hasStudentRegistrationConsents, validateStudentConsents } from '../../lib/studentConsent';
import StudentProfileFields, { EMPTY_STUDENT_PROFILE_FORM } from './StudentProfileFields';
import StudentRegistrationConsent from './StudentRegistrationConsent';
import StudentSkillMatchNotice from './StudentSkillMatchNotice';

export default function StudentProfileForm({ onSaved }) {
  const { profile, profileComplete, refreshStudentAccess, user } = useStudentAuth();
  const [form, setForm] = useState(EMPTY_STUDENT_PROFILE_FORM);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [consents, setConsents] = useState(EMPTY_STUDENT_CONSENTS);
  const needsConsent = profile ? !hasStudentRegistrationConsents(profile) : true;

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
        target_job_categories: Array.isArray(profile.target_job_categories)
          ? profile.target_job_categories
          : [],
        primary_target_role: profile.primary_target_role || '',
        role_experience_level: profile.role_experience_level || '',
        preferred_locations: Array.isArray(profile.preferred_locations)
          ? profile.preferred_locations
          : [],
        availability: profile.availability || '',
        expected_salary_min: profile.expected_salary_min ? String(profile.expected_salary_min) : '',
        expected_salary_max: profile.expected_salary_max ? String(profile.expected_salary_max) : '',
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

  const addSkill = (skillValue) => {
    setForm((current) => {
      if (current.skills.includes(skillValue)) {
        return current;
      }
      return { ...current, skills: [...current.skills, skillValue].slice(0, 16) };
    });
  };

  const toggleTargetCategory = (categoryValue) => {
    setForm((current) => {
      const selected = new Set(current.target_job_categories);
      if (selected.has(categoryValue)) {
        selected.delete(categoryValue);
      } else {
        selected.add(categoryValue);
      }
      return { ...current, target_job_categories: [...selected] };
    });
  };

  const addTargetCategory = (categoryValue) => {
    setForm((current) => {
      if (current.target_job_categories.includes(categoryValue)) {
        return current;
      }
      return {
        ...current,
        target_job_categories: [...current.target_job_categories, categoryValue].slice(0, 8),
      };
    });
  };

  const togglePreferredLocation = (locationValue) => {
    setForm((current) => {
      const selected = new Set(current.preferred_locations);
      if (selected.has(locationValue)) {
        selected.delete(locationValue);
      } else {
        selected.add(locationValue);
      }
      return { ...current, preferred_locations: [...selected] };
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
      <h2 className="text-2xl font-black text-slate-950">
        {profileComplete ? 'Update student profile' : 'Student profile'}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {profileComplete
          ? 'Keep your education, target roles, experience, skills, and certifications up to date so we can match you with employers in Vizag.'
          : 'Complete every field below before applying to jobs. Target roles, experience, skills, and certifications help admins match you with employers in Vizag.'}
      </p>

      {notice ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <StudentProfileFields
          form={form}
          onChange={handleChange}
          onFresherChange={handleFresherChange}
          onToggleSkill={toggleSkill}
          onAddSkill={addSkill}
          onToggleTargetCategory={toggleTargetCategory}
          onAddTargetCategory={addTargetCategory}
          onTogglePreferredLocation={togglePreferredLocation}
        />

        <StudentSkillMatchNotice />

        {needsConsent ? (
          <StudentRegistrationConsent
            values={consents}
            onChange={setConsents}
            idPrefix="student-profile-consent"
          />
        ) : null}

        <div>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? 'Saving...' : profileComplete ? 'Update profile' : 'Save profile'}
          </button>
        </div>
      </form>
    </section>
  );
}
