import { useEffect, useState } from 'react';
import { upsertStudentProfile } from '../../services/studentJobs';
import { recordStudentRegistrationConsents } from '../../services/studentConsent';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { EMPTY_STUDENT_CONSENTS, hasStudentRegistrationConsents, validateStudentConsents } from '../../lib/studentConsent';
import { createResumeSignedUrl, saveResumePathOnProfile, uploadStudentResume, validateResumeFile } from '../../services/studentResume';
import StudentProfileFields, { EMPTY_STUDENT_PROFILE_FORM } from './StudentProfileFields';
import StudentRegistrationConsent from './StudentRegistrationConsent';
import StudentSkillMatchNotice from './StudentSkillMatchNotice';
import { getSyncedBranchForDegree } from '../../lib/studentProfileOptions';

export default function StudentProfileForm({ onSaved }) {
  const { profile, profileComplete, refreshStudentAccess, user } = useStudentAuth();
  const [form, setForm] = useState(EMPTY_STUDENT_PROFILE_FORM);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [consents, setConsents] = useState(EMPTY_STUDENT_CONSENTS);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeError, setResumeError] = useState('');
  const [isOpeningResume, setIsOpeningResume] = useState(false);
  const needsConsent = profile ? !hasStudentRegistrationConsents(profile) : true;

  useEffect(() => {
    if (profile) {
      setForm({
        current_city: profile.current_city || '', current_area: profile.current_area || '',
        education_status: profile.education_status || '', gender: profile.gender || '',
        willing_to_relocate: profile.willing_to_relocate ?? null, interested_roles: profile.interested_roles || [],
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
    setForm((current) => {
      if (name === 'degree') {
        return {
          ...current,
          degree: value,
          branch: getSyncedBranchForDegree(value, current.branch),
        };
      }
      return {
        ...current,
        [name]: value,
      };
    });
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
        if (selected.size >= 3) return current;
        selected.add(categoryValue);
      }
      return { ...current, target_job_categories: [...selected] };
    });
  };

  const addTargetCategory = (categoryValue) => {
    setForm((current) => {
      if (current.target_job_categories.includes(categoryValue) || current.target_job_categories.length >= 3) {
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

  const handleResumeFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const errorMsg = validateResumeFile(file);
    if (errorMsg) {
      setResumeError(errorMsg);
      setResumeFile(null);
    } else {
      setResumeError('');
      setResumeFile(file);
    }
  };

  const handleViewCurrentResume = async () => {
    if (!profile?.resume_path) return;
    setIsOpeningResume(true);
    try {
      const url = await createResumeSignedUrl(profile.resume_path, 3600);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setError('Resume link could not be generated.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open resume.');
    } finally {
      setIsOpeningResume(false);
    }
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
      let resumePath = profile?.resume_path || null;
      if (resumeFile && user?.id) {
        resumePath = await uploadStudentResume(resumeFile, user.id);
        await saveResumePathOnProfile(resumePath);
      }
      const saved = await upsertStudentProfile({
        ...form,
        ...(resumePath ? { resume_path: resumePath } : {}),
      });
      if (user?.id) {
        await refreshStudentAccess(user.id);
      }
      setResumeFile(null);
      setNotice('Student profile saved. You can now apply to jobs.');
      onSaved?.(saved);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-xl sm:p-6 shadow-slate-200/60">
      <h2 className="text-2xl font-black text-slate-950">
        {profileComplete ? 'Update student profile' : 'Student profile'}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {profileComplete
          ? 'Keep your education, target roles, experience, skills, and certifications up to date so we can match you with employers in Vizag.'
          : 'Complete the fields marked * before applying to jobs. Target roles, experience, skills, and certifications help admins match you with employers in Vizag.'}
      </p>

      {notice ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 [&_fieldset]:min-w-0 [&_button]:min-h-11 [&_button]:max-w-full [&_input]:min-w-0 [&_input]:text-base [&_select]:min-w-0 [&_select]:max-w-full [&_select]:text-base [&_textarea]:text-base">
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

        {/* Resume section */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">📄 Resume / CV</h3>
            {profile?.resume_path ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                ✓ Resume Attached
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                No Resume Uploaded
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Upload your resume (PDF or Word, max 5 MB). Verified employers and admins will review it when matching you to open vacancies.
          </p>

          {profile?.resume_path && !resumeFile && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleViewCurrentResume}
                disabled={isOpeningResume}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                {isOpeningResume ? 'Opening resume…' : '📄 View Current Resume'}
              </button>
            </div>
          )}

          <div className="mt-3">
            <label htmlFor="student-profile-resume" className="block text-xs font-semibold text-slate-600 mb-1">
              {profile?.resume_path ? 'Upload new resume to replace existing:' : 'Upload your resume:'}
            </label>
            <input
              id="student-profile-resume"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleResumeFileChange}
              className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />
            {resumeFile && (
              <p className="mt-1.5 text-xs text-indigo-700 font-medium">
                Selected for upload: {resumeFile.name} ({(resumeFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
            {resumeError && (
              <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-600">
                {resumeError}
              </p>
            )}
          </div>
        </div>

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
            className="min-h-12 w-full rounded-2xl bg-indigo-600 px-6 py-3 text-base sm:w-auto font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? 'Saving...' : profileComplete ? 'Update profile' : 'Save profile'}
          </button>
        </div>
      </form>
    </section>
  );
}
