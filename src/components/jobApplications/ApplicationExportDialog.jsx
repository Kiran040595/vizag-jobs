import { useMemo, useState } from 'react';
import {
  APPLICATION_EXPORT_COLUMNS,
  downloadApplicationExcel,
  getDefaultExportColumnIds,
} from '../../lib/applicationExport';

const GROUP_ORDER = ['Contact', 'Education', 'Profile', 'Application'];

export default function ApplicationExportDialog({
  open,
  onClose,
  applications = [],
  job = null,
}) {
  const [selectedIds, setSelectedIds] = useState(() => getDefaultExportColumnIds());
  const [error, setError] = useState('');

  const groupedColumns = useMemo(() => {
    const groups = new Map();
    for (const column of APPLICATION_EXPORT_COLUMNS) {
      if (!groups.has(column.group)) {
        groups.set(column.group, []);
      }
      groups.get(column.group).push(column);
    }
    return GROUP_ORDER.map((group) => ({
      group,
      columns: groups.get(group) || [],
    })).filter((entry) => entry.columns.length > 0);
  }, []);

  if (!open) {
    return null;
  }

  const toggleColumn = (columnId) => {
    setError('');
    setSelectedIds((current) =>
      current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId],
    );
  };

  const selectDefaults = () => {
    setError('');
    setSelectedIds(getDefaultExportColumnIds());
  };

  const selectAll = () => {
    setError('');
    setSelectedIds(APPLICATION_EXPORT_COLUMNS.map((column) => column.id));
  };

  const clearAll = () => {
    setError('');
    setSelectedIds([]);
  };

  const handleDownload = async () => {
    try {
      await downloadApplicationExcel(applications, selectedIds, job);
      onClose?.();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download file.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-export-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="application-export-title" className="text-xl font-black text-slate-950">
              Download applicants (Excel)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose columns, then download {applications.length} applicant
              {applications.length === 1 ? '' : 's'} for{' '}
              <span className="font-semibold text-slate-800">{job?.title || 'this job'}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

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

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {groupedColumns.map(({ group, columns }) => (
            <fieldset key={group} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                {group}
              </legend>
              <div className="mt-2 space-y-2">
                {columns.map((column) => {
                  const checked = selectedIds.includes(column.id);
                  return (
                    <label
                      key={column.id}
                      className="flex cursor-pointer items-center gap-2 text-sm text-slate-800"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColumn(column.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{column.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
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
            disabled={selectedIds.length === 0}
            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download Excel ({selectedIds.length} column{selectedIds.length === 1 ? '' : 's'})
          </button>
        </div>
      </div>
    </div>
  );
}
