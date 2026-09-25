import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  deserializeJobForForm,
  fetchAdminJobById,
  isJobSlugTaken,
  toggleAdminJobFeatured,
  updateAdminJob,
  updateAdminJobStatus,
  toggleAdminJobInstagram,
  updateAdminJobGroupLink,
} from '../../services/adminJobs';
import { seoOptimizeExternalJob, fetchSeoGeminiKeys } from '../../services/externalJobFetch';
import { formatGeminiKeyUsage } from '../../lib/formatGeminiKeyUsage';
import { buildGeminiSeoKeySelectOptions, parseGeminiSeoKeySelectValue } from '../../lib/geminiSeoKeyOptions';
import CopyInstagramCaptionButton from '../CopyInstagramCaptionButton';
import { INSTAGRAM_BIO_JOBS_PATH } from '../../lib/instagramBioJobsPath';

/**
 * Floating admin action bar shown on the public job detail page when the
 * viewer is signed in as an admin. Reuses the existing service functions
 * — no new SQL, no new endpoints.
 *
 * Props:
 *   job          processed (camelCase) job object from `services/jobs.js`.
 *                Must include `id`, `status`, `isFeatured`.
 *   onPatch      called with a small camelCase patch when a *quick* action
 *                succeeds, e.g. `{ status: 'draft' }`. Parent merges into
 *                local state so we avoid a re-fetch round-trip.
 *   onRefetch    called when a full refresh is needed (after Make SEO,
 *                because every field could have changed). Parent should
 *                re-run its job fetch with forceRefresh:true.
 */
const STATUS_LABEL = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
  pending: 'Pending review',
};

const STATUS_PILL = {
  published: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  draft: 'border-amber-300 bg-amber-50 text-amber-800',
  archived: 'border-rose-300 bg-rose-50 text-rose-800',
  pending: 'border-blue-300 bg-blue-50 text-blue-800',
};

const truncate = (value, max = 160) => {
  const text = value == null ? '' : String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const arrayLen = (value) => (Array.isArray(value) ? value.filter(Boolean).length : 0);

export default function AdminJobActionsBar({ job, onPatch, onRefetch }) {
  const { session } = useAdminAuth();
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Holds the in-flight SEO rewrite. Stays mounted until the admin clicks
  // Apply (commits to DB) or Cancel (discards).
  const [seoPreview, setSeoPreview] = useState(null); // { rawJob, seoJob } | null
  const [seoGeminiKeyIndex, setSeoGeminiKeyIndex] = useState(0);
  const [seoGeminiKeys, setSeoGeminiKeys] = useState([]);

  const isLinkedInPostJob =
    job?.sourceKind === 'linkedin_post' || job?.source_kind === 'linkedin_post';
  const geminiKeySelectOptions = useMemo(
    () => buildGeminiSeoKeySelectOptions(seoGeminiKeys),
    [seoGeminiKeys],
  );

  useEffect(() => {
    let ignore = false;
    if (!session?.access_token) {
      return undefined;
    }
    (async () => {
      try {
        const { keys } = await fetchSeoGeminiKeys(session.access_token, {
          linkedInPost: isLinkedInPostJob,
        });
        if (!ignore) {
          setSeoGeminiKeys(keys);
        }
      } catch {
        if (!ignore) {
          setSeoGeminiKeys([]);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [session?.access_token, isLinkedInPostJob]);

  const status = job?.status || 'draft';
  const isPublished = status === 'published';
  const isFeatured = Boolean(job?.isFeatured ?? job?.is_featured);
  const isInstagram = Boolean(job?.isInstagram ?? job?.is_instagram);
  const groupLink = String(job?.groupLink || job?.group_link || '').trim();

  const runAction = async (key, action, successMessage, patch) => {
    setBusyAction(key);
    setError('');
    setNotice('');
    try {
      await action();
      if (patch) onPatch?.(patch);
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      console.error(`Admin action "${key}" failed:`, err);
      setError(err instanceof Error ? err.message : `Could not ${key} the job.`);
    } finally {
      setBusyAction('');
    }
  };

  // Edit is rendered as a real <a target="_blank">. We avoid window.open()
  // because with `noopener` features many browsers return null on success,
  // which made an earlier popup-blocker fallback navigate the current tab
  // (the user reported: "the present page also refreshes when I click
  // edit"). A native anchor tag also gives users the standard middle-click /
  // right-click → open-in-new-tab affordances for free.

  const handleStatusToggle = () => {
    const nextStatus = isPublished ? 'draft' : 'published';
    runAction(
      'status',
      () => updateAdminJobStatus(job.id, nextStatus),
      isPublished
        ? 'Unpublished. Public visitors will no longer see this job.'
        : 'Published. The job is now live.',
      { status: nextStatus },
    );
  };

  const handleFeatureToggle = () => {
    const nextFeatured = !isFeatured;
    runAction(
      'featured',
      () => toggleAdminJobFeatured(job.id, nextFeatured),
      nextFeatured ? 'Marked as featured.' : 'Removed from featured listings.',
      { isFeatured: nextFeatured },
    );
  };

  const handleInstagramToggle = () => {
    const nextInstagram = !isInstagram;
    runAction(
      'instagram',
      () => toggleAdminJobInstagram(job.id, nextInstagram),
      nextInstagram
        ? `Added to Instagram bio page (${INSTAGRAM_BIO_JOBS_PATH}).`
        : 'Removed from Instagram bio page.',
      { isInstagram: nextInstagram },
    );
  };

  const handleGroupLink = () => {
    const next = window.prompt(
      'Recruitment group link (WhatsApp or Instagram). Leave empty to clear. Shown after on-platform apply only.',
      groupLink,
    );
    if (next === null) {
      return;
    }
    const trimmed = String(next).trim();
    runAction(
      'groupLink',
      () => updateAdminJobGroupLink(job.id, trimmed),
      trimmed ? 'Group link saved.' : 'Group link cleared.',
      { groupLink: trimmed },
    );
  };

  const handleArchive = () => {
    if (status === 'archived') return;
    const ok = window.confirm(
      'Archive this job?\n\nIt will be hidden from the public site immediately. ' +
        'You can restore it from the admin jobs list later.',
    );
    if (!ok) return;
    runAction(
      'archive',
      () => updateAdminJobStatus(job.id, 'archived'),
      'Archived. The job has been removed from the public site.',
      { status: 'archived' },
    );
  };

  const handleMakeSeo = async () => {
    if (!session?.access_token) {
      setError('Sign in as admin again to run Make SEO.');
      return;
    }
    setBusyAction('seo');
    setError('');
    setNotice('');
    try {
      // The Edge Function expects the raw snake_case row (with arrays for
      // responsibilities/eligibility/skills), so go to the source rather
      // than reconstructing from the camelCase processed shape.
      const rawJob = await fetchAdminJobById(job.id);
      const data = await seoOptimizeExternalJob(session.access_token, rawJob, '', {
        geminiKeyIndex: seoGeminiKeyIndex > 0 ? seoGeminiKeyIndex : undefined,
      });
      const seoJob = data?.job;
      if (!seoJob) {
        throw new Error('SEO response did not include a job.');
      }
      setSeoPreview({ rawJob, seoJob });
    } catch (err) {
      console.error('Make SEO failed:', err);
      setError(err instanceof Error ? err.message : 'SEO optimization failed.');
    } finally {
      setBusyAction('');
    }
  };

  const handleApplySeo = async ({ slugOverride } = {}) => {
    if (!seoPreview) return;
    setBusyAction('seo-apply');
    setError('');
    setNotice('');
    try {
      // Merge: SEO rewrite wins where present; original row fills the gaps
      // (apply_link, source_url, posted_at, etc. are not rewritten by SEO).
      // The dialog can override the slug to resolve unique-constraint
      // collisions without losing the rest of the SEO rewrite.
      const merged = { ...seoPreview.rawJob, ...seoPreview.seoJob };
      if (slugOverride) merged.slug = slugOverride;
      const formValues = deserializeJobForForm(merged);
      await updateAdminJob(job.id, formValues);
      setSeoPreview(null);
      setNotice('SEO applied. The page has been refreshed with the new content.');
      onRefetch?.();
    } catch (err) {
      console.error('Could not apply SEO rewrite:', err);
      setError(err instanceof Error ? err.message : 'Could not save SEO changes.');
    } finally {
      setBusyAction('');
    }
  };

  const handleCancelSeo = () => {
    setSeoPreview(null);
    setNotice('SEO rewrite discarded.');
  };

  const baseBtn =
    'inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
  const neutral =
    'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus:ring-slate-300';
  const primary = 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-300';
  const warn = 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 focus:ring-amber-300';
  const danger = 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:ring-rose-300';
  const featured = 'border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 focus:ring-cyan-300';
  const seoStyle = 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 focus:ring-violet-300';

  return (
    <section
      role="region"
      aria-label="Admin actions"
      className="sticky top-2 z-30 mt-4 rounded-2xl border border-slate-300 bg-white/95 p-3 shadow-lg backdrop-blur sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Admin
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              STATUS_PILL[status] || STATUS_PILL.draft
            }`}
          >
            {STATUS_LABEL[status] || status}
          </span>
          {isFeatured ? (
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
              Featured
            </span>
          ) : null}
          {isInstagram ? (
            <span className="rounded-full border border-pink-200 bg-pink-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-pink-800">
              Instagram
            </span>
          ) : null}
          {groupLink ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
              Group link
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/admin/jobs/${job.id}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={Boolean(busyAction)}
            tabIndex={busyAction ? -1 : 0}
            onClick={(event) => {
              if (busyAction) event.preventDefault();
            }}
            className={`${baseBtn} ${neutral} no-underline`}
            title="Open the edit form in a new tab"
          >
            Edit
          </a>
          {isPublished ? (
            <CopyInstagramCaptionButton
              job={job}
              disabled={Boolean(busyAction)}
              onInstagramMarked={() => onPatch?.({ isInstagram: true })}
              className={`${baseBtn} border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100 disabled:opacity-50`}
            />
          ) : null}
          <select
            value={String(seoGeminiKeyIndex || 0)}
            onChange={(e) => setSeoGeminiKeyIndex(parseGeminiSeoKeySelectValue(e.target.value))}
            disabled={Boolean(busyAction)}
            className="max-w-[14rem] rounded-xl border border-violet-200 bg-violet-50 px-2 py-2 text-[11px] font-semibold text-violet-900 disabled:opacity-50"
            title="Choose which Gemini API key runs Make SEO"
            aria-label="Gemini API key for Make SEO"
          >
            {geminiKeySelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${baseBtn} ${seoStyle}`}
            onClick={handleMakeSeo}
            disabled={Boolean(busyAction)}
            title="Run Gemini SEO rewrite. You will review and approve before saving."
          >
            {busyAction === 'seo' ? 'Running SEO…' : 'Make SEO'}
          </button>
          <button
            type="button"
            className={`${baseBtn} ${isPublished ? warn : primary}`}
            onClick={handleStatusToggle}
            disabled={Boolean(busyAction)}
          >
            {busyAction === 'status' ? 'Working…' : isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button
            type="button"
            className={`${baseBtn} ${isFeatured ? neutral : featured}`}
            onClick={handleFeatureToggle}
            disabled={Boolean(busyAction)}
          >
            {busyAction === 'featured' ? 'Working…' : isFeatured ? 'Unfeature' : 'Feature'}
          </button>
          <button
            type="button"
            className={`${baseBtn} ${
              groupLink
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus:ring-emerald-300'
                : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 focus:ring-emerald-300'
            }`}
            onClick={handleGroupLink}
            disabled={Boolean(busyAction)}
            title="WhatsApp/Instagram group shown after students apply on-platform"
          >
            {busyAction === 'groupLink' ? 'Saving…' : groupLink ? 'Edit group link' : 'Add group link'}
          </button>
          <button
            type="button"
            className={`${baseBtn} ${
              isInstagram
                ? 'border-pink-300 bg-pink-50 text-pink-800 hover:bg-pink-100 focus:ring-pink-300'
                : 'border-pink-200 bg-white text-pink-800 hover:bg-pink-50 focus:ring-pink-300'
            }`}
            onClick={handleInstagramToggle}
            disabled={Boolean(busyAction)}
            title={`Show this job on the Instagram bio page (${INSTAGRAM_BIO_JOBS_PATH})`}
          >
            {busyAction === 'instagram' ? 'Working…' : isInstagram ? 'Remove Insta' : 'Insta'}
          </button>
          <button
            type="button"
            className={`${baseBtn} ${danger}`}
            onClick={handleArchive}
            disabled={Boolean(busyAction) || status === 'archived'}
            title={
              status === 'archived'
                ? 'This job is already archived'
                : 'Soft-delete: hide from the public site (recoverable)'
            }
          >
            {busyAction === 'archive' ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
      {notice && !error ? (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          {notice}
        </p>
      ) : null}

      {seoPreview ? (
        <SeoApprovalDialog
          rawJob={seoPreview.rawJob}
          seoJob={seoPreview.seoJob}
          isApplying={busyAction === 'seo-apply'}
          onApply={handleApplySeo}
          onCancel={handleCancelSeo}
        />
      ) : null}
    </section>
  );
}

/**
 * Modal that shows a side-by-side diff of the SEO rewrite. Renders only
 * the user-visible fields to keep the dialog scannable; structured data
 * (json_ld, hashtags, keyword density) lands in `seo_meta` automatically
 * via `serializeJobForm` when the admin clicks Apply.
 */
function SeoApprovalDialog({ rawJob, seoJob, isApplying, onApply, onCancel }) {
  // Slug is the only field that can hit a Postgres unique-constraint failure
  // on save. Make it editable, run a pre-flight collision check, and only
  // enable Apply when the slug is unique (or unchanged from the original).
  const [slugInput, setSlugInput] = useState(seoJob.slug || rawJob.slug || '');
  // Holds the *async* check result keyed by the slug it was taken for, so
  // intermediate keystrokes don't flash a stale answer.
  const [asyncSlugCheck, setAsyncSlugCheck] = useState(null); // { slug, state, message }

  // Derive the rendered status at render time. setState inside an effect
  // body would trigger the react-hooks/set-state-in-effect lint rule —
  // and would cause cascading renders.
  const slugStatus = useMemo(() => {
    const trimmed = slugInput.trim();
    if (!trimmed) return { state: 'invalid', message: 'Slug cannot be empty.' };
    if (trimmed === (rawJob.slug || '').trim()) {
      return { state: 'available', message: 'Same as current slug.' };
    }
    if (asyncSlugCheck && asyncSlugCheck.slug === trimmed) {
      return { state: asyncSlugCheck.state, message: asyncSlugCheck.message };
    }
    return { state: 'checking', message: 'Checking…' };
  }, [slugInput, rawJob.slug, asyncSlugCheck]);

  useEffect(() => {
    const trimmed = slugInput.trim();
    if (!trimmed) return undefined;
    if (trimmed === (rawJob.slug || '').trim()) return undefined;
    if (asyncSlugCheck && asyncSlugCheck.slug === trimmed) return undefined;

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const taken = await isJobSlugTaken(trimmed, rawJob.id);
        if (cancelled) return;
        setAsyncSlugCheck({
          slug: trimmed,
          state: taken ? 'taken' : 'available',
          message: taken ? 'Already used by another job.' : 'Available.',
        });
      } catch (err) {
        if (cancelled) return;
        setAsyncSlugCheck({
          slug: trimmed,
          state: 'unknown',
          message: err instanceof Error ? err.message : 'Could not verify slug.',
        });
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [slugInput, rawJob.id, rawJob.slug, asyncSlugCheck]);

  const canApply =
    !isApplying &&
    (slugStatus.state === 'available' ||
      slugStatus.state === 'unknown'); // unknown = let user try; server will gate it

  const keyUsage = formatGeminiKeyUsage(seoJob.seo_meta);

  const rows = [
    { label: 'Title', before: rawJob.title, after: seoJob.title },
    {
      label: 'Meta description',
      before: truncate(rawJob.short_description, 200),
      after: truncate(seoJob.short_description ?? rawJob.short_description, 200),
    },
    { label: 'Category', before: rawJob.category, after: seoJob.category ?? rawJob.category },
    { label: 'Job type', before: rawJob.job_type, after: seoJob.job_type ?? rawJob.job_type },
  ];

  const arrayDiffs = [
    {
      label: 'Responsibilities',
      before: arrayLen(rawJob.responsibilities),
      after: arrayLen(seoJob.responsibilities),
    },
    {
      label: 'Eligibility',
      before: arrayLen(rawJob.eligibility),
      after: arrayLen(seoJob.eligibility),
    },
    {
      label: 'Skills',
      before: arrayLen(rawJob.skills),
      after: arrayLen(seoJob.skills),
    },
  ].filter((row) => row.before !== row.after);

  // Portal to <body> so the dialog escapes the actions-bar's stacking
  // context (sticky + z-30). Otherwise the Navbar (sticky z-50 at the
  // root) renders on top of the dialog header.
  // Also: lock body scroll and close on Escape while the dialog is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event) => {
      if (event.key === 'Escape' && !isApplying) onCancel?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [isApplying, onCancel]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review SEO rewrite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 py-6"
      onClick={(event) => {
        // Click on the backdrop (but not the dialog itself) cancels.
        if (event.target === event.currentTarget && !isApplying) onCancel?.();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-violet-300 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
              SEO rewrite ready
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Review changes</h2>
            {keyUsage ? (
              <p className="mt-1 text-xs font-medium text-violet-800">{keyUsage}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5l-10 10" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-slate-600">
            Compare the old (left) and new (right) values. Click <strong>Apply</strong> to overwrite
            the live listing, or <strong>Cancel</strong> to discard the rewrite.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Slug
              </p>
              {slugInput.trim() !== (rawJob.slug || '').trim() ? (
                <button
                  type="button"
                  onClick={() => setSlugInput(rawJob.slug || '')}
                  disabled={isApplying}
                  className="text-xs font-semibold text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline"
                >
                  Use current slug
                </button>
              ) : null}
            </div>
            <p className="mt-1 break-all text-xs text-slate-500">
              Old: <span className="font-mono">{rawJob.slug || '(empty)'}</span>
            </p>
            <input
              type="text"
              value={slugInput}
              onChange={(event) => setSlugInput(event.target.value)}
              disabled={isApplying}
              spellCheck={false}
              autoComplete="off"
              className={`mt-2 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none transition focus:ring-2 ${
                slugStatus.state === 'taken' || slugStatus.state === 'invalid'
                  ? 'border-rose-300 bg-rose-50 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
                  : slugStatus.state === 'available'
                    ? 'border-emerald-300 bg-white text-slate-900 focus:border-emerald-500 focus:ring-emerald-200'
                    : 'border-slate-300 bg-white text-slate-900 focus:border-violet-500 focus:ring-violet-200'
              }`}
            />
            <p
              className={`mt-1.5 text-xs font-medium ${
                slugStatus.state === 'taken' || slugStatus.state === 'invalid'
                  ? 'text-rose-700'
                  : slugStatus.state === 'available'
                    ? 'text-emerald-700'
                    : slugStatus.state === 'unknown'
                      ? 'text-amber-700'
                      : 'text-slate-500'
              }`}
            >
              {slugStatus.state === 'checking' ? '⋯ ' : ''}
              {slugStatus.state === 'available' ? '✓ ' : ''}
              {slugStatus.state === 'taken' || slugStatus.state === 'invalid' ? '⚠ ' : ''}
              {slugStatus.message}
            </p>
            {slugStatus.state === 'taken' ? (
              <p className="mt-1 text-xs text-slate-600">
                Edit the slug above (e.g. add a date or company suffix) or click{' '}
                <strong>Use current slug</strong> to keep the existing URL.
              </p>
            ) : null}
          </div>

          <dl className="mt-4 space-y-4">
            {rows.map((row) => {
              const changed = String(row.before ?? '') !== String(row.after ?? '');
              return (
                <div key={row.label} className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr] sm:gap-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {row.label}
                  </dt>
                  <dd
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      changed
                        ? 'border-rose-200 bg-rose-50 text-rose-900 line-through opacity-80'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    } ${row.mono ? 'break-all font-mono text-xs' : ''}`}
                  >
                    {row.before || <span className="text-slate-400">(empty)</span>}
                  </dd>
                  <dd
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      changed
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    } ${row.mono ? 'break-all font-mono text-xs' : ''}`}
                  >
                    {row.after || <span className="text-slate-400">(empty)</span>}
                  </dd>
                </div>
              );
            })}
          </dl>

          {arrayDiffs.length > 0 ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Other changes
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {arrayDiffs.map((row) => (
                  <li key={row.label}>
                    <strong>{row.label}:</strong> {row.before} item{row.before === 1 ? '' : 's'} →{' '}
                    {row.after} item{row.after === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply({ slugOverride: slugInput.trim() })}
            disabled={!canApply}
            title={
              slugStatus.state === 'taken'
                ? 'Pick a different slug, or click "Use current slug" above.'
                : slugStatus.state === 'invalid'
                  ? 'Slug cannot be empty.'
                  : undefined
            }
            className="rounded-xl border border-violet-600 bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplying ? 'Applying…' : 'Apply changes'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
