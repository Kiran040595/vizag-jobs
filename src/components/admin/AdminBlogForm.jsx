import { useEffect, useState } from 'react';
import {
  createAdminPost,
  createSuggestedBlogSlug,
  getEmptyBlogForm,
  updateAdminPost,
} from '../../services/adminBlogs';

const INPUT_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100';

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
      return { formValues: fallbackValues, isSlugManual: fallbackIsSlugManual };
    }
    const parsedValue = JSON.parse(storedValue);
    return {
      formValues: { ...fallbackValues, ...(parsedValue.formValues || {}) },
      isSlugManual: typeof parsedValue.isSlugManual === 'boolean' ? parsedValue.isSlugManual : fallbackIsSlugManual,
    };
  } catch {
    return { formValues: fallbackValues, isSlugManual: fallbackIsSlugManual };
  }
};

const clearStoredDraft = (draftStorageKey) => {
  if (!draftStorageKey) return;
  try {
    sessionStorage.removeItem(draftStorageKey);
  } catch {
    // ignore
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

export default function AdminBlogForm({
  initialValues,
  postId = '',
  mode = 'create',
  draftStorageKey = '',
  onCancel,
  onSaved,
}) {
  const baseFormValues = initialValues || getEmptyBlogForm();
  const initialDraft = getStoredDraft(draftStorageKey, baseFormValues, mode === 'edit');

  const [formValues, setFormValues] = useState(initialDraft.formValues);
  const [isSlugManual, setIsSlugManual] = useState(initialDraft.isSlugManual);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      sessionStorage.setItem(draftStorageKey, JSON.stringify({ formValues, isSlugManual }));
    } catch {
      // ignore
    }
  }, [draftStorageKey, formValues, isSlugManual]);

  const validateForm = () => {
    if (!String(formValues.title || '').trim()) {
      return 'Please enter a title.';
    }
    if (!String(formValues.slug || '').trim()) {
      return 'Please provide a slug for this post.';
    }
    return '';
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormValues((currentValues) => {
      const nextValues = { ...currentValues, [name]: value };
      if (!isSlugManual && ['title', 'published_at'].includes(name)) {
        nextValues.slug = createSuggestedBlogSlug({
          title: name === 'title' ? value : nextValues.title,
          publishedAt: name === 'published_at' ? value : nextValues.published_at,
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
      slug: createSuggestedBlogSlug({
        title: currentValues.title,
        publishedAt: currentValues.published_at,
      }),
    }));
    setIsSlugManual(false);
  };

  const handleReset = () => {
    clearStoredDraft(draftStorageKey);
    setSaveError('');
    setNotice('');
    if (mode === 'create') {
      setFormValues(getEmptyBlogForm());
      setIsSlugManual(false);
      return;
    }
    setFormValues(initialValues || getEmptyBlogForm());
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
      const saved =
        mode === 'edit'
          ? await updateAdminPost(postId, formValues, statusOverride)
          : await createAdminPost(formValues, statusOverride);

      const successMessage =
        mode === 'edit'
          ? `Post updated as ${saved.status}.`
          : `Post created as ${saved.status}.`;

      clearStoredDraft(draftStorageKey);
      setNotice(successMessage);
      onSaved?.(saved);
      if (mode === 'create' && !onSaved) {
        setFormValues(getEmptyBlogForm());
        setIsSlugManual(false);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the post.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            {mode === 'edit' ? 'Update post' : 'Create post'}
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            {mode === 'edit' ? 'Edit blog post' : 'New blog post'}
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
        Drafts are kept in session storage for this tab. Body supports Markdown (headings, lists, links, code blocks).
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <TextInput name="title" value={formValues.title} onChange={handleFieldChange} placeholder="How to prepare for IT interviews in Vizag" />
        </Field>
        <Field label="Published at">
          <TextInput type="datetime-local" name="published_at" value={formValues.published_at} onChange={handleFieldChange} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Slug" hint="Generated from title and publish date until you edit it.">
          <div className="mt-2 flex gap-2">
            <TextInput
              name="slug"
              value={formValues.slug}
              onChange={handleFieldChange}
              placeholder="interview-tips-vizag-2026-05-14"
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

      <div className="mt-4">
        <Field label="Excerpt" hint="Short preview for listings and meta description.">
          <TextArea name="excerpt" value={formValues.excerpt} onChange={handleFieldChange} className="min-h-[96px]" placeholder="A quick guide for freshers..." />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Body (Markdown)">
          <TextArea name="body" value={formValues.body} onChange={handleFieldChange} className="min-h-[280px] font-mono text-sm" placeholder={'## Intro\n\nWrite your post in **Markdown**.'} />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleSave('draft')}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : mode === 'edit' ? 'Save as draft' : 'Save draft'}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleSave('published')}
          className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : mode === 'edit' ? 'Update and publish' : 'Publish post'}
        </button>
      </div>
    </section>
  );
}
