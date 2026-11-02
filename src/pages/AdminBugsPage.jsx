import { useCallback, useEffect, useState } from 'react';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  BUG_STATUS_COLORS,
  BUG_STATUS_OPTIONS,
  fetchAdminBugs,
  fetchAdminBugStats,
  formatBugTimestamp,
  updateAdminBug,
} from '../services/adminBugs';

function BugReportCard({ bug, onUpdated }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [actionStatus, setActionStatus] = useState(bug.status);
  const [resolutionNotes, setResolutionNotes] = useState(bug.resolution_notes || '');
  const [resolvedCommit, setResolvedCommit] = useState(bug.resolved_in_commit || '');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const statusStyle = BUG_STATUS_COLORS[bug.status] || BUG_STATUS_COLORS.open;

  const handleSaveStatus = async (newStatus) => {
    setIsBusy(true);
    setErrorMsg('');
    try {
      await updateAdminBug(bug.id, {
        status: newStatus,
        resolution_notes: resolutionNotes.trim() || null,
        resolved_in_commit: resolvedCommit.trim() || null,
      });
      setIsEditing(false);
      onUpdated?.();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update bug status');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <article
      id={`bug-${bug.id}`}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 ${
        bug.status === 'open' ? 'border-red-200' : 'border-slate-200'
      }`}
    >
      {/* Top Header: Status badge, Context badge, Date */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${statusStyle.badge}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
            {bug.status}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {bug.context || 'window.onerror'}
          </span>
          {bug.pathname ? (
            <span className="rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-800">
              {bug.pathname}
            </span>
          ) : null}
        </div>
        <time className="text-xs font-medium text-slate-500">
          {formatBugTimestamp(bug.created_at)}
        </time>
      </div>

      {/* Main Error Title */}
      <h3 className="mt-3 text-base font-bold text-slate-900 break-words sm:text-lg">
        {bug.error_message || 'Unknown error'}
      </h3>

      {/* URL and Device Metadata */}
      <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        {bug.url ? (
          <div>
            <dt className="font-semibold text-slate-700">Page URL:</dt>
            <dd className="mt-0.5 break-all">
              <a
                href={bug.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-600 hover:underline"
              >
                {bug.url}
              </a>
            </dd>
          </div>
        ) : null}

        {bug.user_agent ? (
          <div>
            <dt className="font-semibold text-slate-700">Device / Screen:</dt>
            <dd className="mt-0.5 break-all text-slate-600">
              {bug.user_agent} {bug.screen_size ? `(${bug.screen_size})` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      {/* Resolution Report Banner (if resolved or ignored) */}
      {(bug.status === 'resolved' || bug.status === 'ignored' || bug.resolution_notes) ? (
        <div
          className={`mt-4 rounded-xl border p-3.5 text-xs sm:text-sm ${
            bug.status === 'resolved'
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
              : 'border-slate-200 bg-slate-50 text-slate-800'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
            <span>
              {bug.status === 'resolved' ? '✅ Fix Summary / Resolution Notes:' : 'ℹ️ Resolution / Triage Notes:'}
            </span>
            {bug.resolved_at ? (
              <span className="text-xs font-normal opacity-80">
                Resolved on {formatBugTimestamp(bug.resolved_at)}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 whitespace-pre-wrap font-medium">
            {bug.resolution_notes || '(No notes provided)'}
          </p>
          {bug.resolved_in_commit ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span className="font-semibold">Resolved in Git Commit:</span>
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-cyan-800">
                {bug.resolved_in_commit}
              </code>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Stack Trace Preview / Toggle */}
      {bug.stack_trace ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900 focus:outline-none"
          >
            <span>{isExpanded ? '▼ Hide Stack Trace' : '▶ Show Full Stack Trace'}</span>
          </button>
          {isExpanded ? (
            <div className="mt-2 max-h-60 overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
              <pre className="font-mono whitespace-pre-wrap">{bug.stack_trace}</pre>
              {bug.component_stack ? (
                <>
                  <div className="my-2 border-t border-slate-700 pt-2 font-semibold text-slate-400">
                    React Component Stack:
                  </div>
                  <pre className="font-mono whitespace-pre-wrap text-slate-300">
                    {bug.component_stack}
                  </pre>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Error Action / Status Form */}
      {isEditing ? (
        <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-900">
            Update Bug Resolution
          </p>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`bug-status-${bug.id}`} className="block text-xs font-semibold text-slate-700">
                Status
              </label>
              <select
                id={`bug-status-${bug.id}`}
                value={actionStatus}
                onChange={(e) => setActionStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              >
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved (Fixed)</option>
                <option value="ignored">Ignored (3rd-Party Noise)</option>
              </select>
            </div>
            <div>
              <label htmlFor={`bug-commit-${bug.id}`} className="block text-xs font-semibold text-slate-700">
                Commit Hash (optional)
              </label>
              <input
                id={`bug-commit-${bug.id}`}
                type="text"
                placeholder="e.g. c1347db"
                value={resolvedCommit}
                onChange={(e) => setResolvedCommit(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              />
            </div>
          </div>

          <div className="mt-2.5">
            <label htmlFor={`bug-notes-${bug.id}`} className="block text-xs font-semibold text-slate-700">
              Resolution Notes / What was fixed
            </label>
            <textarea
              id={`bug-notes-${bug.id}`}
              rows={2}
              placeholder="Describe what broke and how it was fixed..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            />
          </div>

          {errorMsg ? <p className="mt-2 text-xs font-semibold text-red-600">{errorMsg}</p> : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleSaveStatus(actionStatus)}
              className="inline-flex min-h-9 items-center justify-center rounded-xl bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50"
            >
              {isBusy ? 'Saving...' : 'Save Updates'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIsEditing(false)}
              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setActionStatus(bug.status === 'open' ? 'resolved' : bug.status);
              setIsEditing(true);
            }}
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-100"
          >
            ✏️ Edit Status & Notes
          </button>

          {bug.status === 'open' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setActionStatus('resolved');
                  setResolutionNotes(bug.resolution_notes || 'Fixed and verified in code');
                  setIsEditing(true);
                }}
                className="inline-flex min-h-8 items-center justify-center rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              >
                ✅ Mark Resolved
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionStatus('ignored');
                  setResolutionNotes(bug.resolution_notes || 'Filtered benign third-party browser/IAB noise');
                  setIsEditing(true);
                }}
                className="inline-flex min-h-8 items-center justify-center rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-200"
              >
                ⚠️ Mark Ignored / Noise
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleSaveStatus('open')}
              className="inline-flex min-h-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              🔄 Reopen Bug
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function AdminBugsPage() {
  useAdminAuth();

  const [bugs, setBugs] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, investigating: 0, resolved: 0, ignored: 0 });
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [bugsResult, statsResult] = await Promise.all([
        fetchAdminBugs({ status: selectedStatus, search: searchQuery }),
        fetchAdminBugStats(),
      ]);

      if (bugsResult.error) {
        setError(bugsResult.error);
      } else {
        setBugs(bugsResult.data);
      }
      setStats(statsResult);
    } catch (err) {
      setError(err.message || 'Failed to load error reports');
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <AdminShell
      title="Bugs & Errors Dashboard"
      description="Production crashes, automated triage records, and bug resolution reports from site_error_logs"
    >
      {/* 1. Dashboard KPI Summary Cards */}
      <section className="mb-8 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-red-600">Open Bugs</p>
          <p className="mt-2 text-2xl font-black text-red-950 sm:text-3xl">{stats.open}</p>
          <p className="mt-1 text-xs text-red-700">Needs review & fix</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Investigating</p>
          <p className="mt-2 text-2xl font-black text-amber-950 sm:text-3xl">{stats.investigating}</p>
          <p className="mt-1 text-xs text-amber-700">Under triage</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Resolved</p>
          <p className="mt-2 text-2xl font-black text-emerald-950 sm:text-3xl">{stats.resolved}</p>
          <p className="mt-1 text-xs text-emerald-700">Fixed & deployed</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Ignored / Noise</p>
          <p className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">{stats.ignored}</p>
          <p className="mt-1 text-xs text-slate-500">Filtered 3rd-party noise</p>
        </div>

        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">Total Crash Reports</p>
          <p className="mt-2 text-2xl font-black text-cyan-950 sm:text-3xl">{stats.total}</p>
          <p className="mt-1 text-xs text-cyan-700">Historical telemetry</p>
        </div>
      </section>

      {/* 2. Filter Tabs & Search Controls */}
      <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {/* Status Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {BUG_STATUS_OPTIONS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedStatus(tab.value)}
              className={`inline-flex min-h-10 items-center justify-center rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                selectedStatus === tab.value
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              {tab.value === 'open' && stats.open > 0 ? (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] text-white">
                  {stats.open}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Search input & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search error, URL, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={loadData}
            title="Refresh error queue"
            disabled={isLoading}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            🔄 {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </section>

      {/* 3. Error / Alert Banner */}
      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-bold">Error loading bug reports:</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      {/* 4. Bug Reports List */}
      <section className="space-y-4">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            <p className="animate-pulse">Loading production error reports from database...</p>
          </div>
        ) : bugs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <span className="text-3xl">🎉</span>
            <h4 className="mt-2 text-base font-bold text-slate-900">No bugs found</h4>
            <p className="mt-1 text-xs text-slate-500">
              {selectedStatus === 'open'
                ? 'Great news! There are zero open production bugs in your queue.'
                : 'No reports matching your active filters or search terms.'}
            </p>
          </div>
        ) : (
          bugs.map((bug) => (
            <BugReportCard key={bug.id} bug={bug} onUpdated={loadData} />
          ))
        )}
      </section>
    </AdminShell>
  );
}
