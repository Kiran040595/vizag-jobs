import { useState, useMemo } from 'react';
import {
  optimizeSingleCompanyJob,
  publishSingleCompanyJob,
} from '../../lib/companyCareerFetchAutomation.js';
import { formatGeminiKeyUsage } from '../../lib/formatGeminiKeyUsage.js';

export default function CompanyCareerJobApprovalModal({
  isOpen,
  company,
  accessToken,
  initialData,
  onClose,
  onJobsPublished,
  pushToast,
}) {
  const [step, setStep] = useState(
    initialData?.jobs?.some((j) => j.seoStatus === 'success') ? 'publish' : 'review_fetch'
  );
  const [jobs, setJobs] = useState(() => initialData?.jobs || []);
  const [existingIndex] = useState(() => initialData?.existingIndex);
  const [busyJobId, setBusyJobId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, message: '' });
  const [expandedPreviewIds, setExpandedPreviewIds] = useState(new Set());
  const [editingJobId, setEditingJobId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', category: '', location: '' });

  const companyName = company?.name || initialData?.companyName || 'Company';
  const careersUrl = company?.careersUrl || initialData?.careersUrl || '';

  // Stats
  const stats = useMemo(() => {
    let total = jobs.length;
    let duplicates = 0;
    let seoReady = 0;
    let seoSuccess = 0;
    let published = 0;

    for (const j of jobs) {
      if (j.isDuplicate) duplicates += 1;
      if (j.selectedForSeo && !j.isDuplicate) seoReady += 1;
      if (j.seoStatus === 'success') seoSuccess += 1;
      if (j.publishStatus === 'success') published += 1;
    }

    return { total, duplicates, seoReady, seoSuccess, published };
  }, [jobs]);

  if (!isOpen || !initialData) return null;

  const toggleSelectForSeo = (jobId) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, selectedForSeo: !j.selectedForSeo } : j))
    );
  };

  const selectAllNewForSeo = () => {
    setJobs((prev) =>
      prev.map((j) => ({
        ...j,
        selectedForSeo: !j.isDuplicate && j.seoStatus !== 'success',
      }))
    );
  };

  const deselectAllForSeo = () => {
    setJobs((prev) => prev.map((j) => ({ ...j, selectedForSeo: false })));
  };

  const toggleSelectForPublish = (jobId) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, selectedForPublish: !j.selectedForPublish } : j
      )
    );
  };

  const selectAllReadyForPublish = () => {
    setJobs((prev) =>
      prev.map((j) => ({
        ...j,
        selectedForPublish: j.seoStatus === 'success' && j.publishStatus !== 'success',
      }))
    );
  };

  const deselectAllForPublish = () => {
    setJobs((prev) => prev.map((j) => ({ ...j, selectedForPublish: false })));
  };

  const togglePreview = (jobId) => {
    setExpandedPreviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleStartEdit = (job) => {
    setEditingJobId(job.id);
    setEditForm({
      title: job.title || '',
      category: job.category || 'General',
      location: job.location || 'Visakhapatnam',
    });
  };

  const handleSaveEdit = (jobId) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              title: editForm.title.trim() || j.title,
              category: editForm.category.trim() || j.category,
              location: editForm.location.trim() || j.location,
            }
          : j
      )
    );
    setEditingJobId(null);
  };

  // Optimize a single job
  const handleOptimizeSingle = async (job) => {
    setBusyJobId(job.id);
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, seoStatus: 'busy', seoError: null } : j))
    );

    try {
      const optimized = await optimizeSingleCompanyJob({
        job,
        company,
        accessToken,
      });

      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                ...optimized,
                optimizedJob: optimized,
                seoStatus: 'success',
                selectedForPublish: true,
                selectedForSeo: false,
              }
            : j
        )
      );

      pushToast?.({
        message: `Gemini SEO refined: "${optimized.title}"`,
        type: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, seoStatus: 'failed', seoError: msg } : j
        )
      );
      pushToast?.({
        message: `SEO failed for "${job.title}": ${msg}`,
        type: 'error',
      });
    } finally {
      setBusyJobId('');
    }
  };

  // Bulk optimize approved/selected jobs
  const handleOptimizeSelected = async () => {
    const targetJobs = jobs.filter((j) => j.selectedForSeo && j.seoStatus !== 'success');
    if (targetJobs.length === 0) return;

    setBulkBusy(true);
    let successCount = 0;

    for (let i = 0; i < targetJobs.length; i += 1) {
      const currentJob = targetJobs[i];
      setBulkProgress({
        current: i + 1,
        total: targetJobs.length,
        message: `Optimizing (${i + 1}/${targetJobs.length}): "${currentJob.title}"…`,
      });

      setJobs((prev) =>
        prev.map((j) => (j.id === currentJob.id ? { ...j, seoStatus: 'busy', seoError: null } : j))
      );

      try {
        const optimized = await optimizeSingleCompanyJob({
          job: currentJob,
          company,
          accessToken,
        });

        setJobs((prev) =>
          prev.map((j) =>
            j.id === currentJob.id
              ? {
                  ...j,
                  ...optimized,
                  optimizedJob: optimized,
                  seoStatus: 'success',
                  selectedForPublish: true,
                  selectedForSeo: false,
                }
              : j
          )
        );
        successCount += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === currentJob.id ? { ...j, seoStatus: 'failed', seoError: msg } : j
          )
        );
      }

      // Small delay between calls for API stability
      if (i < targetJobs.length - 1) {
        await new Promise((res) => setTimeout(res, 800));
      }
    }

    setBulkBusy(false);
    setBulkProgress({ current: 0, total: 0, message: '' });

    if (successCount > 0) {
      setStep('publish');
      pushToast?.({
        message: `Successfully SEO-refined ${successCount} job(s) for ${companyName}! Ready for admin publish approval.`,
        type: 'success',
      });
    }
  };

  // Publish a single approved job
  const handlePublishSingle = async (job) => {
    setBusyJobId(job.id);
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, publishStatus: 'busy', publishError: null } : j))
    );

    try {
      const saved = await publishSingleCompanyJob({
        job: job.optimizedJob || job,
        company,
        existingIndex,
      });

      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                publishStatus: 'success',
                publishedJob: saved,
                selectedForPublish: false,
              }
            : j
        )
      );

      onJobsPublished?.([saved]);

      pushToast?.({
        message: `Published: "${saved.title}" -> /jobs/${saved.slug}`,
        type: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, publishStatus: 'failed', publishError: msg } : j
        )
      );
      pushToast?.({
        message: `Publish failed for "${job.title}": ${msg}`,
        type: 'error',
      });
    } finally {
      setBusyJobId('');
    }
  };

  // Bulk publish approved/selected jobs
  const handlePublishSelected = async () => {
    const targetJobs = jobs.filter(
      (j) => j.selectedForPublish && j.seoStatus === 'success' && j.publishStatus !== 'success'
    );
    if (targetJobs.length === 0) return;

    setBulkBusy(true);
    const publishedList = [];

    for (let i = 0; i < targetJobs.length; i += 1) {
      const currentJob = targetJobs[i];
      setBulkProgress({
        current: i + 1,
        total: targetJobs.length,
        message: `Publishing (${i + 1}/${targetJobs.length}): "${currentJob.title}"…`,
      });

      setJobs((prev) =>
        prev.map((j) => (j.id === currentJob.id ? { ...j, publishStatus: 'busy', publishError: null } : j))
      );

      try {
        const saved = await publishSingleCompanyJob({
          job: currentJob.optimizedJob || currentJob,
          company,
          existingIndex,
        });

        publishedList.push(saved);

        setJobs((prev) =>
          prev.map((j) =>
            j.id === currentJob.id
              ? {
                  ...j,
                  publishStatus: 'success',
                  publishedJob: saved,
                  selectedForPublish: false,
                }
              : j
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === currentJob.id ? { ...j, publishStatus: 'failed', publishError: msg } : j
          )
        );
      }
    }

    setBulkBusy(false);
    setBulkProgress({ current: 0, total: 0, message: '' });

    if (publishedList.length > 0) {
      onJobsPublished?.(publishedList);
      pushToast?.({
        message: `Published ${publishedList.length} verified Vizag job(s) for ${companyName}!`,
        type: 'success',
      });
    }
  };

  const selectedForSeoCount = jobs.filter(
    (j) => j.selectedForSeo && j.seoStatus !== 'success'
  ).length;
  const selectedForPublishCount = jobs.filter(
    (j) => j.selectedForPublish && j.seoStatus === 'success' && j.publishStatus !== 'success'
  ).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
    >
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={bulkBusy ? undefined : onClose}
      />

      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-5 sm:p-6">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">
                🏢
              </span>
              <h2 className="truncate text-lg font-black text-slate-950 sm:text-xl">
                {companyName} — Vizag Job Approval
              </h2>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Source: {initialData.scrapeSource || 'Direct Careers'}</span>
              <span>·</span>
              <a
                href={careersUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-cyan-700 hover:underline"
              >
                {careersUrl} ↗
              </a>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={bulkBusy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Stepper Tabs */}
        <div className="flex shrink-0 border-b border-slate-100 bg-slate-50/70 px-6">
          <button
            type="button"
            onClick={() => setStep('review_fetch')}
            className={`flex items-center gap-2 border-b-2 py-3.5 text-xs font-bold transition-colors ${
              step === 'review_fetch'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                step === 'review_fetch'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span>Step 1: Admin Approval Before Optimize ({jobs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStep('publish')}
            className={`flex items-center gap-2 border-b-2 py-3.5 pl-6 text-xs font-bold transition-colors ${
              step === 'publish'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                step === 'publish'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span>
              Step 2: Admin Approval After Optimize &amp; Publish ({stats.seoSuccess})
            </span>
          </button>
        </div>

        {/* Bulk Progress Banner */}
        {bulkBusy ? (
          <div className="shrink-0 border-b border-violet-200 bg-violet-50 px-6 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-bold text-violet-900">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                {bulkProgress.message || 'Processing jobs…'}
              </span>
              <span className="font-mono text-violet-700">
                {bulkProgress.current} / {bulkProgress.total}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-violet-200">
              <div
                className="h-full bg-violet-600 transition-all duration-300"
                style={{
                  width: `${
                    bulkProgress.total > 0
                      ? (bulkProgress.current / bulkProgress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {/* Scrollable Job List */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No Visakhapatnam / Vizag job vacancies found on this company page.
            </div>
          ) : step === 'review_fetch' ? (
            /* STEP 1: Pre-Optimize Approval List */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Step 1: Select Jobs to Optimize with Gemini SEO
                  </p>
                  <p className="text-xs text-slate-600">
                    {stats.total} Vizag role(s) found · {stats.duplicates} already in database ·{' '}
                    <strong className="text-slate-900">{selectedForSeoCount}</strong> selected for
                    SEO
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllNewForSeo}
                    disabled={bulkBusy}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Select All New
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllForSeo}
                    disabled={bulkBusy}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={handleOptimizeSelected}
                    disabled={bulkBusy || selectedForSeoCount === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                  >
                    <span>✨ Approve &amp; Optimize Selected ({selectedForSeoCount})</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {jobs.map((job) => {
                  const isBusy = busyJobId === job.id || (bulkBusy && job.selectedForSeo);
                  const isEditing = editingJobId === job.id;

                  return (
                    <div
                      key={job.id}
                      className={`rounded-2xl border transition-all ${
                        job.seoStatus === 'success'
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : job.isDuplicate
                            ? 'border-slate-200 bg-slate-50/70 opacity-80'
                            : job.selectedForSeo
                              ? 'border-violet-300 bg-violet-50/40 ring-1 ring-violet-300'
                              : 'border-slate-200 bg-white'
                      } p-4`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={job.selectedForSeo}
                          disabled={job.isDuplicate || job.seoStatus === 'success' || bulkBusy}
                          onChange={() => toggleSelectForSeo(job.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 disabled:opacity-40"
                        />

                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="space-y-2 rounded-xl bg-slate-100 p-3">
                              <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500">
                                  Job Title
                                </label>
                                <input
                                  type="text"
                                  value={editForm.title}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, title: e.target.value })
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold uppercase text-slate-500">
                                    Category
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.category}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, category: e.target.value })
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase text-slate-500">
                                    Location
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.location}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, location: e.target.value })
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingJobId(null)}
                                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(job.id)}
                                  className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-bold text-white hover:bg-violet-700"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-950">{job.title}</h3>

                                {job.isDuplicate ? (
                                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                    ⚠️ In Database ({job.duplicateReason})
                                  </span>
                                ) : job.seoStatus === 'success' ? (
                                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                                    ✅ SEO Optimized
                                  </span>
                                ) : job.seoStatus === 'failed' ? (
                                  <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-900">
                                    ❌ SEO Failed
                                  </span>
                                ) : (
                                  <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-900">
                                    ✨ Ready for SEO
                                  </span>
                                )}

                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {job.location || 'Visakhapatnam'}
                                </span>
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {job.category || 'General'}
                                </span>
                              </div>

                              <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                                {job.short_description ||
                                  job.description?.slice(0, 200) ||
                                  'No description provided.'}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <a
                                  href={job.apply_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-cyan-700 hover:underline"
                                >
                                  Application Link ↗
                                </a>

                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(job)}
                                  className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
                                >
                                  Edit Info
                                </button>
                              </div>

                              {job.seoError ? (
                                <p className="mt-2 text-xs font-semibold text-rose-600">
                                  Error: {job.seoError}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </div>

                        {/* Single Optimize Action Button */}
                        <div className="shrink-0">
                          {job.seoStatus === 'success' ? (
                            <button
                              type="button"
                              onClick={() => setStep('publish')}
                              className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                            >
                              Review SEO ↗
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy || bulkBusy}
                              onClick={() => handleOptimizeSingle(job)}
                              className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm hover:bg-violet-50 disabled:opacity-50"
                            >
                              {isBusy ? (
                                <>
                                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                                  <span>Optimizing…</span>
                                </>
                              ) : (
                                <>
                                  <span>✨</span>
                                  <span>Optimize</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STEP 2: Post-Optimize Approval & Publish List */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-900">
                    Step 2: Admin Approval After SEO — Publish to Portal
                  </p>
                  <p className="text-xs text-violet-700">
                    {stats.seoSuccess} role(s) SEO-optimized · {stats.published} published ·{' '}
                    <strong className="text-violet-950">{selectedForPublishCount}</strong> approved
                    to publish
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllReadyForPublish}
                    disabled={bulkBusy}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Select All Ready
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllForPublish}
                    disabled={bulkBusy}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishSelected}
                    disabled={bulkBusy || selectedForPublishCount === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <span>🚀 Approve &amp; Publish Selected ({selectedForPublishCount})</span>
                  </button>
                </div>
              </div>

              {jobs.filter((j) => j.seoStatus === 'success').length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  <p>No jobs have been SEO-optimized yet.</p>
                  <button
                    type="button"
                    onClick={() => setStep('review_fetch')}
                    className="mt-3 inline-flex items-center gap-1 font-bold text-violet-700 hover:underline"
                  >
                    ← Go to Step 1 to select and optimize jobs
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs
                    .filter((j) => j.seoStatus === 'success')
                    .map((job) => {
                      const isBusy = busyJobId === job.id || (bulkBusy && job.selectedForPublish);
                      const isPublished = job.publishStatus === 'success';
                      const isPreviewOpen = expandedPreviewIds.has(job.id);
                      const published = job.publishedJob;

                      return (
                        <div
                          key={job.id}
                          className={`rounded-2xl border transition-all ${
                            isPublished
                              ? 'border-emerald-300 bg-emerald-50/40'
                              : job.selectedForPublish
                                ? 'border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-300'
                                : 'border-slate-200 bg-white'
                          } p-4`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={job.selectedForPublish}
                              disabled={isPublished || bulkBusy}
                              onChange={() => toggleSelectForPublish(job.id)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-950">{job.title}</h3>

                                {isPublished ? (
                                  <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                                    ✅ Published on Portal
                                  </span>
                                ) : (
                                  <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-900">
                                    ✨ Ready for Publish Approval
                                  </span>
                                )}

                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {job.category}
                                </span>
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {job.job_type || 'Full-time'}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-slate-700">
                                <strong className="text-slate-900">SEO Slug:</strong>{' '}
                                <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-800">
                                  /jobs/{job.slug}
                                </code>
                              </p>

                              <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                                <strong className="text-slate-900">Meta:</strong>{' '}
                                {job.short_description}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                <button
                                  type="button"
                                  onClick={() => togglePreview(job.id)}
                                  className="font-bold text-violet-700 hover:underline"
                                >
                                  {isPreviewOpen ? 'Hide SEO Preview ▲' : 'View Full SEO Preview ▼'}
                                </button>

                                <a
                                  href={job.apply_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-cyan-700 hover:underline"
                                >
                                  Direct Apply Link ↗
                                </a>

                                {job.seo_meta ? (
                                  <span className="text-[11px] text-slate-400">
                                    {formatGeminiKeyUsage(job.seo_meta)}
                                  </span>
                                ) : null}
                              </div>

                              {/* Expandable Full SEO Preview */}
                              {isPreviewOpen ? (
                                <div className="mt-3 space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3.5 text-xs text-slate-800">
                                  {job.description ? (
                                    <div>
                                      <p className="font-bold uppercase tracking-wider text-violet-900">
                                        SEO Job Description:
                                      </p>
                                      <div className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-2.5 leading-5 text-slate-700">
                                        {job.description}
                                      </div>
                                    </div>
                                  ) : null}

                                  {Array.isArray(job.responsibilities) &&
                                  job.responsibilities.length > 0 ? (
                                    <div>
                                      <p className="font-bold uppercase tracking-wider text-violet-900">
                                        Key Responsibilities:
                                      </p>
                                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                                        {job.responsibilities.map((r, idx) => (
                                          <li key={idx}>{r}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}

                                  {Array.isArray(job.eligibility) && job.eligibility.length > 0 ? (
                                    <div>
                                      <p className="font-bold uppercase tracking-wider text-violet-900">
                                        Eligibility &amp; Qualifications:
                                      </p>
                                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                                        {job.eligibility.map((e, idx) => (
                                          <li key={idx}>{e}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}

                                  {Array.isArray(job.skills) && job.skills.length > 0 ? (
                                    <div>
                                      <p className="font-bold uppercase tracking-wider text-violet-900">
                                        Skills:
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {job.skills.map((s, idx) => (
                                          <span
                                            key={idx}
                                            className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700"
                                          >
                                            {s}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              {job.publishError ? (
                                <p className="mt-2 text-xs font-semibold text-rose-600">
                                  Publish Error: {job.publishError}
                                </p>
                              ) : null}
                            </div>

                            {/* Publish Action Buttons */}
                            <div className="flex shrink-0 items-center gap-2">
                              {isPublished ? (
                                <div className="flex items-center gap-2">
                                  <a
                                    href={`/jobs/${published?.slug || job.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-50"
                                  >
                                    View Job ↗
                                  </a>
                                  {published?.id ? (
                                    <a
                                      href={`/admin/edit/${published.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                    >
                                      Edit
                                    </a>
                                  ) : null}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy || bulkBusy}
                                  onClick={() => handlePublishSingle(job)}
                                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {isBusy ? (
                                    <>
                                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                      <span>Publishing…</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>🚀</span>
                                      <span>Publish</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50 p-4 sm:px-6">
          <div className="text-xs text-slate-500">
            {stats.published > 0 ? (
              <span className="font-bold text-emerald-700">
                ✅ {stats.published} Vizag job(s) live on portal
              </span>
            ) : (
              <span>Review jobs carefully before publishing.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'review_fetch' && stats.seoSuccess > 0 ? (
              <button
                type="button"
                onClick={() => setStep('publish')}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Go to Publish Step →
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              disabled={bulkBusy}
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
