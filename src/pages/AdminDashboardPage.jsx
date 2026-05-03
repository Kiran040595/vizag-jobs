import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  createAdminJob,
  createSuggestedSlug,
  deserializeJobForForm,
  fetchAdminJobs,
  getEmptyJobForm,
  toggleAdminJobFeatured,
  updateAdminJob,
  updateAdminJobStatus,
} from '../services/adminJobs';

const STATUS_STYLES = {
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  archived: 'border-slate-200 bg-slate-100 text-slate-600',
};

const INPUT_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100';

const normalizeSearchText = (job) =>
  [
    job.title,
    job.company,
    job.slug,
    job.status,
    job.category,
    job.job_type,
    job.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const sortJobs = (jobs) =>
  [...jobs].sort((left, right) => {
    const leftTime = left.posted_at ? new Date(left.posted_at).getTime() : 0;
    const rightTime = right.posted_at ? new Date(right.posted_at).getTime() : 0;
    return rightTime - leftTime;
  });

const upsertJob = (jobs, nextJob) => {
  const existingIndex = jobs.findIndex((job) => job.id === nextJob.id);

  if (existingIndex === -1) {
    return sortJobs([nextJob, ...jobs]);
  }

  const nextJobs = [...jobs];
  nextJobs[existingIndex] = nextJob;
  return sortJobs(nextJobs);
};

const formatDateTime = (value) => {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const REQUIRED_FIELDS = ['title', 'company', 'category', 'job_type'];

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

export default function AdminDashboardPage() {
  const { signOut, user } = useAdminAuth();
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [busyJobId, setBusyJobId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingJobId, setEditingJobId] = useState('');
  const [formValues, setFormValues] = useState(getEmptyJobForm);
  const [isSlugManual, setIsSlugManual] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadJobs = async () => {
      try {
        const data = await fetchAdminJobs();
        if (ignore) {
          return;
        }

        setJobs(sortJobs(data));
        setLoadError('');
      } catch (error) {
        if (ignore) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Could not load jobs.');
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadJobs();

    return () => {
      ignore = true;
    };
  }, []);

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredJobs = useMemo(() => {
    const normalizedTerm = deferredSearchTerm.trim().toLowerCase();

    if (!normalizedTerm) {
      return jobs;
    }

    return jobs.filter((job) => normalizeSearchText(job).includes(normalizedTerm));
  }, [deferredSearchTerm, jobs]);

  const resetForm = ({ preserveNotice = false } = {}) => {
    setFormValues(getEmptyJobForm());
    setEditingJobId('');
    setIsSlugManual(false);
    setSaveError('');
    if (!preserveNotice) {
      setNotice('');
    }
  };

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
    const nextSlug = createSuggestedSlug({
      title: formValues.title,
      company: formValues.company,
      postedAt: formValues.posted_at,
    });

    setFormValues((currentValues) => ({
      ...currentValues,
      slug: nextSlug,
    }));
    setIsSlugManual(false);
  };

  const handleEditJob = (job) => {
    setEditingJobId(job.id);
    setFormValues(deserializeJobForForm(job));
    setIsSlugManual(true);
    setSaveError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      const savedJob = editingJobId
        ? await updateAdminJob(editingJobId, formValues, statusOverride)
        : await createAdminJob(formValues, statusOverride);

      setJobs((currentJobs) => upsertJob(currentJobs, savedJob));
      const successMessage =
        editingJobId
          ? `Job updated as ${savedJob.status}.`
          : `Job created as ${savedJob.status}.`;

      resetForm({ preserveNotice: true });
      setNotice(successMessage);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the job.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (jobId, status) => {
    setBusyJobId(jobId);
    setLoadError('');
    setNotice('');

    try {
      const updatedJob = await updateAdminJobStatus(jobId, status);
      setJobs((currentJobs) => upsertJob(currentJobs, updatedJob));
      setNotice(`Job moved to ${status}.`);
      if (editingJobId === jobId) {
        setFormValues(deserializeJobForForm(updatedJob));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not update job status.');
    } finally {
      setBusyJobId('');
    }
  };

  const handleFeaturedToggle = async (job) => {
    setBusyJobId(job.id);
    setLoadError('');
    setNotice('');

    try {
      const updatedJob = await toggleAdminJobFeatured(job.id, !job.is_featured);
      setJobs((currentJobs) => upsertJob(currentJobs, updatedJob));
      if (editingJobId === job.id) {
        setFormValues(deserializeJobForForm(updatedJob));
      }
      setNotice(updatedJob.is_featured ? 'Job marked as featured.' : 'Job removed from featured listings.');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not update featured status.');
    } finally {
      setBusyJobId('');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(15,23,42,0.08),_transparent_25%),linear-gradient(180deg,_#f8fbff_0%,_#f8fafc_55%,_#ffffff_100%)]">
      <SEO title="Admin Dashboard | Vizag Jobs" description="Create and manage Vizag Jobs listings." canonical="/admin" />

      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600">Vizag Jobs Admin</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Post jobs faster, manage them safely.</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              Signed in as <span className="font-semibold text-slate-900">{user?.email}</span>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:px-8">
        <section className="order-2 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 lg:order-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Manage listings</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Existing jobs</h2>
            </div>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search title, company, slug, status..."
              className="h-11 w-full max-w-sm rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </div>

          {loadError ? (
            <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
          ) : null}

          {notice ? (
            <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
          ) : null}

          {isLoading ? (
            <div className="mt-8">
              <LoadingSpinner message="Loading admin jobs..." />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <h3 className="text-lg font-bold text-slate-900">No jobs match this search.</h3>
              <p className="mt-2 text-sm text-slate-600">Try a different company, slug, or status filter.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {filteredJobs.map((job) => {
                const isBusy = busyJobId === job.id;

                return (
                  <article key={job.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-950">{job.title}</h3>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              STATUS_STYLES[job.status] || STATUS_STYLES.draft
                            }`}
                          >
                            {job.status}
                          </span>
                          {job.is_featured ? (
                            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                              Featured
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {job.company} / {job.location || 'Visakhapatnam'} / {job.category || 'No category'}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">Slug: {job.slug}</p>
                        <p className="mt-1 text-xs text-slate-500">Posted: {formatDateTime(job.posted_at)}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditJob(job)}
                          className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleStatusChange(job.id, job.status === 'published' ? 'draft' : 'published')}
                          className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {job.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleFeaturedToggle(job)}
                          className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {job.is_featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy || job.status === 'archived'}
                          onClick={() => handleStatusChange(job.id, 'archived')}
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="order-1 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 lg:sticky lg:top-6 lg:order-2 lg:self-start">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Create or update</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{editingJobId ? 'Edit job' : 'New job post'}</h2>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {editingJobId ? 'Cancel edit' : 'Reset'}
            </button>
          </div>

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

          {saveError ? (
            <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave('draft')}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : editingJobId ? 'Update draft' : 'Save draft'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave('published')}
              className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : editingJobId ? 'Update and publish' : 'Publish job'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
