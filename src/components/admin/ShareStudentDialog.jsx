import { useMemo, useState } from 'react';
import {
  getDefaultStudentShareFieldIds,
  getStudentShareFieldGroups,
  STUDENT_SHARE_FIELDS,
} from '../../lib/studentProfileShare';
import { createStudentProfileShare } from '../../services/studentProfileShares';
import StudentShareCard from '../StudentShareCard';

export default function ShareStudentDialog({ open, student, onClose }) {
  const [selectedIds, setSelectedIds] = useState(() => getDefaultStudentShareFieldIds());
  const [companyLabel, setCompanyLabel] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [shareResult, setShareResult] = useState(null);
  const [copyStatus, setCopyStatus] = useState('idle');

  const groupedFields = useMemo(() => getStudentShareFieldGroups(), []);

  if (!open || !student) {
    return null;
  }

  const toggleField = (fieldId) => {
    setError('');
    setShareResult(null);
    setSelectedIds((current) =>
      current.includes(fieldId)
        ? current.filter((id) => id !== fieldId)
        : [...current, fieldId],
    );
  };

  const selectDefaults = () => {
    setError('');
    setShareResult(null);
    setSelectedIds(getDefaultStudentShareFieldIds());
  };

  const selectAll = () => {
    setError('');
    setShareResult(null);
    setSelectedIds(STUDENT_SHARE_FIELDS.map((field) => field.id));
  };

  const clearAll = () => {
    setError('');
    setShareResult(null);
    setSelectedIds([]);
  };

  const handleCreate = async () => {
    setError('');
    setIsCreating(true);
    try {
      const result = await createStudentProfileShare({
        student,
        fieldIds: selectedIds,
        companyLabel,
      });
      setShareResult(result);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Could not create share link.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareResult?.shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareResult.shareUrl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    window.setTimeout(() => setCopyStatus('idle'), 2200);
  };

  const whatsappHref = shareResult?.shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Student profile card${companyLabel.trim() ? ` for ${companyLabel.trim()}` : ''}: ${shareResult.shareUrl}`,
      )}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-student-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="share-student-title" className="text-xl font-black text-slate-950">
              Share student card
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose which details to include, then create a link you can send to any company.
              Only selected fields are shared.
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{student.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Company name (optional)
          </span>
          <input
            type="text"
            value={companyLabel}
            onChange={(event) => {
              setCompanyLabel(event.target.value);
              setShareResult(null);
            }}
            placeholder="e.g. Acme Hiring Team"
            maxLength={120}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectDefaults}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Recommended
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            {groupedFields.map(({ group, fields }) => (
              <fieldset
                key={group}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {group}
                </legend>
                <div className="mt-2 space-y-2">
                  {fields.map((field) => {
                    const checked = selectedIds.includes(field.id);
                    return (
                      <label
                        key={field.id}
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleField(field.id)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span>{field.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Card preview
            </p>
            <StudentShareCard
              student={student}
              fieldIds={selectedIds}
              companyLabel={companyLabel}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {shareResult ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-sm font-semibold text-emerald-900">Share link ready</p>
            <p className="mt-1 break-all text-sm text-emerald-800">{shareResult.shareUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                {copyStatus === 'copied'
                  ? 'Copied'
                  : copyStatus === 'error'
                    ? 'Copy failed'
                    : 'Copy link'}
              </button>
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Share on WhatsApp
                </a>
              ) : null}
              <a
                href={shareResult.shareUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Open card
              </a>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {shareResult ? 'Done' : 'Cancel'}
          </button>
          {!shareResult ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={selectedIds.length === 0 || isCreating}
              className="rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating
                ? 'Creating link…'
                : `Create share link (${selectedIds.length} field${selectedIds.length === 1 ? '' : 's'})`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
