import { useMemo, useState } from 'react';
import {
  getDefaultStudentShareFieldIds,
  getStudentShareFieldGroups,
  STUDENT_SHARE_FIELDS,
} from '../../lib/studentProfileShare';
import {
  downloadStudentShareFile,
  exportStudentShareImage,
  exportStudentSharePdf,
  shareStudentCardOnWhatsApp,
} from '../../lib/studentShareExport';
import StudentShareCard from '../StudentShareCard';

export default function ShareStudentDialog({ open, student, onClose }) {
  const [selectedIds, setSelectedIds] = useState(() => getDefaultStudentShareFieldIds());
  const [companyLabel, setCompanyLabel] = useState('');
  const [format, setFormat] = useState('image');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const groupedFields = useMemo(() => getStudentShareFieldGroups(), []);

  if (!open || !student) {
    return null;
  }

  const toggleField = (fieldId) => {
    setError('');
    setNotice('');
    setSelectedIds((current) =>
      current.includes(fieldId)
        ? current.filter((id) => id !== fieldId)
        : [...current, fieldId],
    );
  };

  const selectDefaults = () => {
    setError('');
    setNotice('');
    setSelectedIds(getDefaultStudentShareFieldIds());
  };

  const selectAll = () => {
    setError('');
    setNotice('');
    setSelectedIds(STUDENT_SHARE_FIELDS.map((field) => field.id));
  };

  const clearAll = () => {
    setError('');
    setNotice('');
    setSelectedIds([]);
  };

  const buildExport = async () => {
    const exporter = format === 'pdf' ? exportStudentSharePdf : exportStudentShareImage;
    return exporter({
      student,
      fieldIds: selectedIds,
      companyLabel,
    });
  };

  const handleShareWhatsApp = async () => {
    setError('');
    setNotice('');
    setIsSharing(true);
    try {
      const exported = await buildExport();
      const result = await shareStudentCardOnWhatsApp({
        ...exported,
        student,
        companyLabel,
      });
      setNotice(
        result.mode === 'native-share'
          ? 'Share sheet opened. Choose WhatsApp to send the card.'
          : `Downloaded ${exported.fileName}. WhatsApp opened — attach that file in the chat.`,
      );
    } catch (shareError) {
      if (shareError?.name === 'AbortError') {
        setNotice('Share cancelled.');
      } else {
        setError(
          shareError instanceof Error
            ? shareError.message
            : 'Could not share the student card.',
        );
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async () => {
    setError('');
    setNotice('');
    setIsSharing(true);
    try {
      const exported = await buildExport();
      downloadStudentShareFile(exported.blob, exported.fileName);
      setNotice(`Downloaded ${exported.fileName}.`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Could not download the student card.',
      );
    } finally {
      setIsSharing(false);
    }
  };

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
              Choose fields, then share the card as an image or PDF on WhatsApp.
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
              setNotice('');
            }}
            placeholder="e.g. Acme Hiring Team"
            maxLength={120}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>

        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Share format
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { id: 'image', label: 'Image (PNG)' },
              { id: 'pdf', label: 'PDF' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setFormat(option.id);
                  setNotice('');
                }}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  format === option.id
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

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
        {notice ? (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {notice}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={selectedIds.length === 0 || isSharing}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download {format === 'pdf' ? 'PDF' : 'image'}
          </button>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={selectedIds.length === 0 || isSharing}
            className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSharing
              ? 'Preparing…'
              : `Share ${format === 'pdf' ? 'PDF' : 'image'} on WhatsApp`}
          </button>
        </div>
      </div>
    </div>
  );
}
