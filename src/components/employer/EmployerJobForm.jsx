import { useEffect, useState } from 'react';
import {
  createEmployerJob,
  createSuggestedSlug,
  getEmptyEmployerJobForm,
  updateEmployerJob,
} from '../../services/employerJobs';
import { fetchLiveJobRoles } from '../../services/jobRoles';
import { cleanJobRoleLabel } from '../../lib/jobRoleLabel';
import { useEmployerAuth } from '../../hooks/useEmployerAuth';

const INPUT_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100';

const REQUIRED_FIELDS = ['title', 'company', 'role', 'category', 'job_type'];

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export default function EmployerJobForm({
  initialValues,
  jobId = '',
  mode = 'create',
  onCancel,
  onSaved,
}) {
  const { profile } = useEmployerAuth();
  const companyName = profile?.company_name || '';
  const [formValues, setFormValues] = useState(initialValues || getEmptyEmployerJobForm(companyName));
  const [isSlugManual, setIsSlugManual] = useState(mode === 'edit');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [liveRoles, setLiveRoles] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchLiveJobRoles(80).then((roles) => {
      if (!cancelled) {
        setLiveRoles(roles);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialValues) {
      setFormValues(initialValues);
    } else if (companyName) {
      setFormValues((current) => ({ ...current, company: companyName }));
    }
  }, [initialValues, companyName]);

  const validateForm = () => {
    const missingField = REQUIRED_FIELDS.find((field) => !String(formValues[field] || '').trim());
    if (missingField) {
      return `Please fill the ${missingField.replace('_', ' ')} field.`;
    }
    if (!String(formValues.slug || '').trim()) {
      return 'Please provide a slug for this job.';
    }
    return '';
  };

  const handleFieldChange = (event) => {
    const { checked, name, type, value } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    setFormValues((currentValues) => {
      const nextValues = { ...currentValues, [name]: nextValue };

      if (name === 'title' && !String(currentValues.role || '').trim()) {
        nextValues.role = cleanJobRoleLabel(value, 56) || value;
      }

      if (!isSlugManual && ['title', 'company', 'posted_at'].includes(name)) {
        nextValues.slug = createSuggestedSlug({
          title: name === 'title' ? value : nextValues.title,
          company: name === 'company' ? value : nextValues.company,
          postedAt: name === 'posted_at' ? value : nextValues.posted_at,
        });
      }

      return nextValues;
    });

    if (name === 'slug') {
      setIsSlugManual(true);
    }
  };

  const handleSubmit = async () => {
    setSaveError('');
    setNotice('');

    const validationMessage = validateForm();
    if (validationMessage) {
      setSaveError(validationMessage);
      return;
    }

    setIsSaving(true);

    try {
      const savedJob =
        mode === 'edit' ? await updateEmployerJob(jobId, formValues) : await createEmployerJob(formValues);

      setNotice('Job submitted for admin review. You will see it on the portal after approval.');
      onSaved?.(savedJob);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not submit the job.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
        {mode === 'edit' ? 'Edit submission' : 'New job'}
      </p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">
        {mode === 'edit' ? 'Update job submission' : 'Post a job for your company'}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Submissions are reviewed by our team before they appear on Vizag Jobs.
      </p>

      {notice ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {saveError ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <input name="title" value={formValues.title} onChange={handleFieldChange} className={INPUT_CLASS} />
        </Field>
        <Field label="Role" hint="Short role students can target (auto-fills from title).">
          <input
            name="role"
            value={formValues.role || ''}
            onChange={handleFieldChange}
            className={INPUT_CLASS}
            list="employer-live-job-roles"
            placeholder="Java Developer, Telecaller, Site Engineer..."
          />
          <datalist id="employer-live-job-roles">
            {liveRoles.map((item) => (
              <option key={item.role} value={item.role} />
            ))}
          </datalist>
        </Field>
        <Field label="Company">
          <input name="company" value={formValues.company} onChange={handleFieldChange} className={INPUT_CLASS} readOnly={Boolean(companyName)} />
        </Field>
        <Field label="Category">
          <input name="category" value={formValues.category} onChange={handleFieldChange} className={INPUT_CLASS} placeholder="IT & Software" />
        </Field>
        <Field label="Job type">
          <input name="job_type" value={formValues.job_type} onChange={handleFieldChange} className={INPUT_CLASS} placeholder="Full-Time" />
        </Field>
        <Field label="Location">
          <input name="location" value={formValues.location} onChange={handleFieldChange} className={INPUT_CLASS} />
        </Field>
        <Field label="Work mode">
          <input name="work_mode" value={formValues.work_mode} onChange={handleFieldChange} className={INPUT_CLASS} />
        </Field>
        <Field label="Experience">
          <input name="experience" value={formValues.experience} onChange={handleFieldChange} className={INPUT_CLASS} />
        </Field>
        <Field label="Salary">
          <input name="salary" value={formValues.salary} onChange={handleFieldChange} className={INPUT_CLASS} />
        </Field>
        <Field label="Apply mode" hint="Choose how candidates apply for this job.">
          <select
            name="apply_mode"
            value={formValues.apply_mode || 'internal'}
            onChange={handleFieldChange}
            className={INPUT_CLASS}
          >
            <option value="internal">Accept applications on Vizag Jobs</option>
            <option value="external">Send candidates to an external apply link</option>
          </select>
        </Field>
        {formValues.apply_mode === 'external' ? (
          <Field label="Apply link">
            <input
              name="apply_link"
              value={formValues.apply_link}
              onChange={handleFieldChange}
              className={INPUT_CLASS}
              placeholder="https://..."
            />
          </Field>
        ) : null}
        <Field label="Slug" hint="Auto-generated from title and company.">
          <input name="slug" value={formValues.slug} onChange={handleFieldChange} className={INPUT_CLASS} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4">
        <Field label="Short description">
          <textarea name="short_description" value={formValues.short_description} onChange={handleFieldChange} className={`${INPUT_CLASS} min-h-[96px] resize-y`} />
        </Field>
        <Field label="Description">
          <textarea name="description" value={formValues.description} onChange={handleFieldChange} className={`${INPUT_CLASS} min-h-[140px] resize-y`} />
        </Field>
        <Field label="Responsibilities" hint="One per line.">
          <textarea name="responsibilities" value={formValues.responsibilities} onChange={handleFieldChange} className={`${INPUT_CLASS} min-h-[100px] resize-y`} />
        </Field>
        <Field label="Eligibility" hint="One per line.">
          <textarea name="eligibility" value={formValues.eligibility} onChange={handleFieldChange} className={`${INPUT_CLASS} min-h-[100px] resize-y`} />
        </Field>
        <Field label="Skills" hint="One per line.">
          <textarea name="skills" value={formValues.skills} onChange={handleFieldChange} className={`${INPUT_CLASS} min-h-[100px] resize-y`} />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <input type="checkbox" name="is_fresher" checked={formValues.is_fresher} onChange={handleFieldChange} className="h-4 w-4" />
        <span className="text-sm font-medium text-slate-700">This is a fresher job</span>
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSubmit}
          className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? 'Submitting...' : mode === 'edit' ? 'Resubmit for review' : 'Submit for review'}
        </button>
      </div>
    </section>
  );
}
