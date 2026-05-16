import { useMemo, useState } from 'react';

export function getExternalJobKey(job) {
  const key = job?.slug || job?.apply_link || job?.source_url || '';
  return String(key).toLowerCase();
}

const formatDateTime = (value) => {
  if (!value) {
    return 'Not set';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const formatList = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  return items;
};

function DetailRow({ label, value, mono = false }) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-sm text-slate-800 ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function DetailRowBoolean({ label, value }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{value ? 'Yes' : 'No'}</dd>
    </div>
  );
}

function BulletList({ label, items }) {
  const list = formatList(items);
  if (!list) {
    return null;
  }

  return (
    <div className="space-y-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          {list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function ExternalJobCard({
  job,
  isDuplicate,
  duplicateReason,
  isBusy,
  errorMessage,
  isSelected,
  onToggleSelect,
  onPublish,
  onSaveDraft,
  onSkip,
  onEdit,
  showBulkSelect,
}) {
  const [expanded, setExpanded] = useState(false);
  const jobKey = getExternalJobKey(job);

  return (
    <article
      className={`rounded-2xl border p-5 ${
        isDuplicate ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-slate-50/50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showBulkSelect ? (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                aria-label={`Select ${job.title}`}
              />
            ) : null}
            <h3 className="text-lg font-bold text-slate-950">{job.title || 'Untitled job'}</h3>
            {isDuplicate ? (
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                Already in DB ({duplicateReason})
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {job.company || 'Unknown company'} · {job.location || '—'} · {job.category || 'No category'}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">{job.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onEdit(job)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onSkip(job)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onSaveDraft(job)}
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {isBusy ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onPublish(job)}
            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {isBusy ? 'Publishing…' : 'Approve & publish'}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {job.short_description ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">{job.short_description}</p>
      ) : null}

      {expanded ? (
        <dl className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          <DetailRow label="Slug" value={job.slug} mono />
          <DetailRow label="Title" value={job.title} />
          <DetailRow label="Company" value={job.company} />
          <DetailRow label="Location" value={job.location} />
          <DetailRow label="Category" value={job.category} />
          <DetailRow label="Job type" value={job.job_type} />
          <DetailRow label="Work mode" value={job.work_mode} />
          <DetailRow label="Experience" value={job.experience} />
          <DetailRowBoolean label="Fresher" value={job.is_fresher} />
          <DetailRow label="Salary" value={job.salary} />
          <DetailRow label="Apply link" value={job.apply_link} mono />
          <DetailRow label="Posted at" value={formatDateTime(job.posted_at)} />
          <DetailRow label="Expires at" value={formatDateTime(job.expires_at)} />
          <DetailRow label="Source" value={job.source_name} />
          <DetailRow label="Source URL" value={job.source_url} mono />
          <DetailRow label="Logo URL" value={job.company_logo_url} mono />
          <DetailRow label="Warning" value={job.warning} />
          <DetailRowBoolean label="Featured" value={job.is_featured} />
          {job.description ? (
            <div className="space-y-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</dt>
              <dd className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
                {job.description}
              </dd>
            </div>
          ) : null}
          <BulletList label="Responsibilities" items={job.responsibilities} />
          <BulletList label="Eligibility" items={job.eligibility} />
          <BulletList label="Skills" items={job.skills} />
        </dl>
      ) : null}

      <p className="sr-only" data-job-key={jobKey} />
    </article>
  );
}

export default function ExternalJobReviewPanel({
  jobs,
  existingSlugs,
  existingApplyLinks,
  busyImportKey,
  importErrors,
  onPublish,
  onSaveDraft,
  onSkip,
  onEdit,
  onBulkPublish,
  onBulkSaveDraft,
}) {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());

  const duplicateInfo = useMemo(() => {
    const map = new Map();
    for (const job of jobs) {
      const key = getExternalJobKey(job);
      const slug = String(job.slug || '').toLowerCase();
      const apply = String(job.apply_link || '').toLowerCase();
      let reason = '';
      if (slug && existingSlugs.has(slug)) {
        reason = 'slug';
      } else if (apply && existingApplyLinks.has(apply)) {
        reason = 'apply link';
      }
      map.set(key, { isDuplicate: Boolean(reason), reason });
    }
    return map;
  }, [jobs, existingSlugs, existingApplyLinks]);

  const toggleSelect = (job) => {
    const key = getExternalJobKey(job);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectedJobs = jobs.filter((job) => selectedKeys.has(getExternalJobKey(job)));
  const showBulk = Boolean(onBulkPublish && onBulkSaveDraft);

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">Review fetched jobs</h3>
          <p className="mt-1 text-sm text-slate-600">
            Nothing is saved until you approve or save as draft. {jobs.length} job(s) waiting.
          </p>
        </div>
        {showBulk && selectedJobs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onBulkSaveDraft(selectedJobs)}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Save {selectedJobs.length} as draft
            </button>
            <button
              type="button"
              onClick={() => onBulkPublish(selectedJobs)}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600"
            >
              Publish {selectedJobs.length} selected
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        {jobs.map((job) => {
          const key = getExternalJobKey(job);
          const dup = duplicateInfo.get(key) || { isDuplicate: false, reason: '' };
          return (
            <ExternalJobCard
              key={key}
              job={job}
              isDuplicate={dup.isDuplicate}
              duplicateReason={dup.reason}
              isBusy={busyImportKey === key}
              errorMessage={importErrors[key]}
              isSelected={selectedKeys.has(key)}
              onToggleSelect={() => toggleSelect(job)}
              onPublish={onPublish}
              onSaveDraft={onSaveDraft}
              onSkip={onSkip}
              onEdit={onEdit}
              showBulkSelect={showBulk}
            />
          );
        })}
      </div>
    </div>
  );
}
