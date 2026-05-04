import { useEffect, useState } from 'react';
import {
  createAdminJob,
  createSuggestedSlug,
  getEmptyJobForm,
  updateAdminJob,
} from '../../services/adminJobs';

const INPUT_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100';

const REQUIRED_FIELDS = ['title', 'company', 'category', 'job_type'];

const getStoredDraft = (draftStorageKey, fallbackValues, fallbackIsSlugManual) => {
  if (!draftStorageKey) {
    return {
      formValues: fallbackValues,
      isSlugManual: fallbackIsSlugManual,
    };
  }

  try {
    const storedValue = sessionStorage.getItem(draftStorageKey);

    if (!storedValue) {
      return {
        formValues: fallbackValues,
        isSlugManual: fallbackIsSlugManual,
      };
    }

    const parsedValue = JSON.parse(storedValue);
    return {
      formValues: {
        ...fallbackValues,
        ...(parsedValue.formValues || {}),
      },
      isSlugManual: typeof parsedValue.isSlugManual === 'boolean' ? parsedValue.isSlugManual : fallbackIsSlugManual,
    };
  } catch {
    return {
      formValues: fallbackValues,
      isSlugManual: fallbackIsSlugManual,
    };
  }
};

const clearStoredDraft = (draftStorageKey) => {
  if (!draftStorageKey) {
    return;
  }

  try {
    sessionStorage.removeItem(draftStorageKey);
  } catch {
    // Ignore storage errors and keep the form usable.
  }
};

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function TextInput(props) {
  return <input {...props} className={`${INPUT_CLASS} ${props.className || ''}`.trim()} />;
}

function TextArea(props) {
  return <textarea {...props} className={`${INPUT_CLASS} min-h-[120px] resize-y ${props.className || ''}`.trim()} />;
}

export default function AdminJobForm({
  initialValues,
  jobId = '',
  mode = 'create',
  draftStorageKey = '',
  onCancel,
  onSaved,
}) {
  const baseFormValues = initialValues || getEmptyJobForm();
  const initialDraft = getStoredDraft(draftStorageKey, baseFormValues, mode === 'edit');

  const [formValues, setFormValues] = useState(initialDraft.formValues);
  const [isSlugManual, setIsSlugManual] = useState(initialDraft.isSlugManual);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!draftStorageKey) {
      return;
    }

    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          formValues,
          isSlugManual,
        })
      );
    } catch {
      // Ignore storage errors and keep the form usable.
    }
  }, [draftStorageKey, formValues, isSlugManual]);

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
      const nextValues = {
        ...currentValues,
        [name]: nextValue,
      };

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

  const handleUseAutoSlug = () => {
    setFormValues((currentValues) => ({
      ...currentValues,
      slug: createSuggestedSlug({
        title: currentValues.title,
        company: currentValues.company,
        postedAt: currentValues.posted_at,
      }),
    }));
    setIsSlugManual(false);
  };

  const handleReset = () => {
    clearStoredDraft(draftStorageKey);
    setSaveError('');
    setNotice('');

    if (mode === 'create') {
      setFormValues(getEmptyJobForm());
      setIsSlugManual(false);
      return;
    }

    setFormValues(initialValues || getEmptyJobForm());
    setIsSlugManual(mode === 'edit');
  };

  const handleSave = async (statusOverride) => {
    setSaveError('');
    setNotice('');

    const validationMessage = validateForm();
    if (validationMessage) {
      setSaveError(validationMessage);
      return;
    }

    setIsSaving(true);

    try {
      const savedJob = mode === 'edit'
        ? await updateAdminJob(jobId, formValues, statusOverride)
        : await createAdminJob(formValues, statusOverride);

      const successMessage = mode === 'edit'
        ? `Job updated as ${savedJob.status}.`
        : `Job created as ${savedJob.status}.`;

      clearStoredDraft(draftStorageKey);

      if (mode === 'create') {
        setFormValues(getEmptyJobForm());
        setIsSlugManual(false);
      }

      setNotice(successMessage);
      onSaved?.(savedJob);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the job.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            {mode === 'edit' ? 'Update job' : 'Create job'}
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            {mode === 'edit' ? 'Edit existing job' : 'New job post'}
          </h2>
        </div>
        <div className="flex gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleReset}
            className="rounded-2xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {mode === 'edit' ? 'Reset changes' : 'Reset'}
          </button>
        </div>
      </div>

      {notice ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
      ) : null}

      {saveError ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</p>
      ) : null}

      <p className="mt-5 text-xs leading-5 text-slate-500">
        This form auto-saves your typed draft for this browser tab and restores it if the page remounts.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <TextInput name="title" value={formValues.title} onChange={handleFieldChange} placeholder="Java Full Stack Developer" />
        </Field>
        <Field label="Company">
          <TextInput name="company" value={formValues.company} onChange={handleFieldChange} placeholder="Shvintech India" />
        </Field>
        <Field label="Category">
          <TextInput name="category" value={formValues.category} onChange={handleFieldChange} placeholder="IT/Software" />
        </Field>
        <Field label="Job type">
          <TextInput name="job_type" value={formValues.job_type} onChange={handleFieldChange} placeholder="Full-Time" />
        </Field>
        <Field label="Location">
          <TextInput name="location" value={formValues.location} onChange={handleFieldChange} placeholder="Visakhapatnam" />
        </Field>
        <Field label="Work mode">
          <TextInput name="work_mode" value={formValues.work_mode} onChange={handleFieldChange} placeholder="Work From Office" />
        </Field>
        <Field label="Experience">
          <TextInput name="experience" value={formValues.experience} onChange={handleFieldChange} placeholder="0 Years" />
        </Field>
        <Field label="Salary">
          <TextInput name="salary" value={formValues.salary} onChange={handleFieldChange} placeholder="Not Disclosed" />
        </Field>
        <Field label="Apply link" hint="Optional but recommended for published jobs.">
          <TextInput name="apply_link" value={formValues.apply_link} onChange={handleFieldChange} placeholder="https://..." />
        </Field>
        <Field label="Posted at">
          <TextInput type="datetime-local" name="posted_at" value={formValues.posted_at} onChange={handleFieldChange} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Slug" hint="Generated from title, company, and post date. You can still edit it.">
          <div className="mt-2 flex gap-2">
            <TextInput
              name="slug"
              value={formValues.slug}
              onChange={handleFieldChange}
              placeholder="java-full-stack-developer-shvintech-india-2026-05-03"
              className="mt-0"
            />
            <button
              type="button"
              onClick={handleUseAutoSlug}
              className="shrink-0 rounded-2xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Auto
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-4 grid gap-4">
        <Field label="Short description">
          <TextArea
            name="short_description"
            value={formValues.short_description}
            onChange={handleFieldChange}
            placeholder="Short summary used for cards and previews."
            className="min-h-[96px]"
          />
        </Field>
        <Field label="Description">
          <TextArea
            name="description"
            value={formValues.description}
            onChange={handleFieldChange}
            placeholder="Full description of the role."
            className="min-h-[140px]"
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4">
        <Field label="Responsibilities" hint="Enter one item per line.">
          <TextArea
            name="responsibilities"
            value={formValues.responsibilities}
            onChange={handleFieldChange}
            placeholder={'Develop backend applications\nBuild frontend interfaces'}
          />
        </Field>
        <Field label="Eligibility" hint="Enter one item per line.">
          <TextArea
            name="eligibility"
            value={formValues.eligibility}
            onChange={handleFieldChange}
            placeholder={'B.Tech (CSE/IT)\nGood communication skills'}
          />
        </Field>
        <Field label="Skills" hint="Enter one skill per line.">
          <TextArea
            name="skills"
            value={formValues.skills}
            onChange={handleFieldChange}
            placeholder={'Java\nSpring Boot\nReactJS'}
          />
        </Field>
      </div>

      <details className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">Advanced fields</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Warning">
            <TextArea name="warning" value={formValues.warning} onChange={handleFieldChange} className="min-h-[96px]" />
          </Field>
          <Field label="Expires at">
            <TextInput type="datetime-local" name="expires_at" value={formValues.expires_at} onChange={handleFieldChange} />
          </Field>
          <Field label="Source name">
            <TextInput name="source_name" value={formValues.source_name} onChange={handleFieldChange} placeholder="Naukri" />
          </Field>
          <Field label="Source URL">
            <TextInput name="source_url" value={formValues.source_url} onChange={handleFieldChange} placeholder="https://..." />
          </Field>
          <Field label="Company logo URL">
            <TextInput name="company_logo_url" value={formValues.company_logo_url} onChange={handleFieldChange} placeholder="https://..." />
          </Field>
        </div>
      </details>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input type="checkbox" name="is_fresher" checked={formValues.is_fresher} onChange={handleFieldChange} className="h-4 w-4 rounded border-slate-300 text-cyan-500" />
          <span className="text-sm font-medium text-slate-700">Mark as fresher job</span>
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input type="checkbox" name="is_featured" checked={formValues.is_featured} onChange={handleFieldChange} className="h-4 w-4 rounded border-slate-300 text-cyan-500" />
          <span className="text-sm font-medium text-slate-700">Feature on the site</span>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleSave('draft')}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : mode === 'edit' ? 'Update draft' : 'Save draft'}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleSave('published')}
          className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : mode === 'edit' ? 'Update and publish' : 'Publish job'}
        </button>
      </div>
    </section>
  );
}
