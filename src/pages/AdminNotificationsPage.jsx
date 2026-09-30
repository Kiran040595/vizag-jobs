import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  fetchNotificationAnalyticsData,
  sendTestPushNotification,
} from '../services/adminNotificationAnalytics';

function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function TriggerBadge({ triggerType }) {
  const map = {
    auto_employer: {
      label: 'Auto: Company Posted',
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      dot: 'bg-emerald-500',
    },
    auto_admin: {
      label: 'Auto: Admin Posted',
      classes: 'border-sky-200 bg-sky-50 text-sky-700',
      dot: 'bg-sky-500',
    },
    manual_admin: {
      label: 'Manual: Admin Bell',
      classes: 'border-amber-200 bg-amber-50 text-amber-800',
      dot: 'bg-amber-500',
    },
    manual_test: {
      label: 'Manual: Test Alert',
      classes: 'border-purple-200 bg-purple-50 text-purple-700',
      dot: 'bg-purple-500',
    },
    manual_custom: {
      label: 'Manual: Broadcast',
      classes: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      dot: 'bg-indigo-500',
    },
  };

  const config = map[triggerType] || {
    label: triggerType === 'auto' ? 'Automatic' : 'Manual',
    classes: 'border-slate-200 bg-slate-50 text-slate-700',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${config.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export default function AdminNotificationsPage() {
  useAdminAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);

  // Active sub-tab: 'jobs' | 'dispatches' | 'opens' | 'audience' | 'inapp'
  const [activeTab, setActiveTab] = useState('jobs');

  // Search & Trigger Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('all'); // 'all' | 'auto' | 'auto_employer' | 'auto_admin' | 'manual'

  // Selected job for click inspection modal
  const [selectedJobForClicks, setSelectedJobForClicks] = useState(null);

  // Send Test Push Modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testForm, setTestForm] = useState({
    title: 'New Job Alert: Software Engineer in Vizag',
    body: 'Acme Corp is hiring Freshers & Experienced candidates in Vizag. Tap to apply.',
    url: '/jobs',
  });
  const [testError, setTestError] = useState('');

  const testTitleInputId = useId();
  const testBodyInputId = useId();
  const testUrlInputId = useId();

  const loadData = async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    setLoadError('');

    try {
      const data = await fetchNotificationAnalyticsData();
      setAnalyticsData(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load notification analytics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSendTestPush = async (e) => {
    e.preventDefault();
    if (!testForm.title.trim()) {
      setTestError('Notification title is required.');
      return;
    }

    setIsSendingTest(true);
    setTestError('');
    try {
      const result = await sendTestPushNotification({
        title: testForm.title.trim(),
        body: testForm.body.trim(),
        url: testForm.url.trim(),
      });
      setNotice(`Test notification sent successfully to ${result.sent ?? 0} active subscriber(s).`);
      setIsTestModalOpen(false);
      await loadData(true);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to send test push notification.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const stats = analyticsData?.stats || {};
  const deviceBreakdown = analyticsData?.deviceBreakdown || {};
  const rawJobAnalytics = analyticsData?.jobAnalytics;
  const jobAnalytics = useMemo(() => rawJobAnalytics || [], [rawJobAnalytics]);

  const rawDispatches = analyticsData?.recentDispatches;
  const recentDispatches = useMemo(() => rawDispatches || [], [rawDispatches]);

  const rawOpens = analyticsData?.recentOpens;
  const recentOpens = useMemo(() => rawOpens || [], [rawOpens]);

  const recentJobAlerts = analyticsData?.recentJobAlerts || [];

  const rawSubscribers = analyticsData?.subscribers;
  const subscribers = useMemo(() => rawSubscribers || [], [rawSubscribers]);

  const matchesTriggerFilter = (triggersOrSingle, filterValue) => {
    if (filterValue === 'all') return true;
    const list = Array.isArray(triggersOrSingle) ? triggersOrSingle : [triggersOrSingle];
    if (filterValue === 'auto') {
      return list.includes('auto_employer') || list.includes('auto_admin');
    }
    if (filterValue === 'manual') {
      return (
        list.includes('manual_admin') ||
        list.includes('manual_test') ||
        list.includes('manual_custom')
      );
    }
    return list.includes(filterValue);
  };

  // Filtered job analytics
  const filteredJobAnalytics = useMemo(() => {
    return jobAnalytics.filter((job) => {
      if (!matchesTriggerFilter(job.triggers || [], triggerFilter)) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        job.title?.toLowerCase().includes(term) ||
        job.company?.toLowerCase().includes(term) ||
        job.location?.toLowerCase().includes(term) ||
        job.posterName?.toLowerCase().includes(term)
      );
    });
  }, [jobAnalytics, searchTerm, triggerFilter]);

  // Filtered dispatches
  const filteredDispatches = useMemo(() => {
    return recentDispatches.filter((d) => {
      if (!matchesTriggerFilter(d.triggerType || 'auto_admin', triggerFilter)) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        d.title?.toLowerCase().includes(term) ||
        d.jobTitle?.toLowerCase().includes(term) ||
        d.jobCompany?.toLowerCase().includes(term) ||
        d.body?.toLowerCase().includes(term) ||
        d.tag?.toLowerCase().includes(term)
      );
    });
  }, [recentDispatches, searchTerm, triggerFilter]);

  // Filtered opens
  const filteredOpens = useMemo(() => {
    if (!searchTerm.trim()) return recentOpens;
    const term = searchTerm.toLowerCase();
    return recentOpens.filter(
      (o) =>
        o.jobTitle?.toLowerCase().includes(term) ||
        o.jobCompany?.toLowerCase().includes(term) ||
        o.browser?.toLowerCase().includes(term) ||
        o.os?.toLowerCase().includes(term) ||
        o.deviceType?.toLowerCase().includes(term) ||
        o.visitor_key?.toLowerCase().includes(term),
    );
  }, [recentOpens, searchTerm]);

  // Filtered subscribers
  const filteredSubscribers = useMemo(() => {
    if (!searchTerm.trim()) return subscribers;
    const term = searchTerm.toLowerCase();
    return subscribers.filter(
      (s) =>
        s.browser?.toLowerCase().includes(term) ||
        s.os?.toLowerCase().includes(term) ||
        s.deviceType?.toLowerCase().includes(term) ||
        s.userAgentSnippet?.toLowerCase().includes(term),
    );
  }, [subscribers, searchTerm]);

  return (
    <AdminShell
      title="Notification Analytics"
      description="Track job-wise push alerts, subscriber click-through rates, and automatic vs manual notification dispatches."
    >
      <SEO
        title="Notification Analytics | Vizag Jobs Admin"
        description="Admin dashboard for job-wise browser push subscriber metrics, automatic vs manual send tracking, and click analytics."
        canonical="/admin/notifications"
      />

      <div className="space-y-6">
        {/* Notice & Error Banners */}
        {notice ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p>{notice}</p>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {loadError ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="text-xs font-semibold text-rose-800 underline hover:text-rose-950"
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Push Delivery Pipeline</span>
            <span aria-hidden="true">·</span>
            <span>{stats.vapidConfigured ? 'VAPID Config Active' : 'VAPID Pending'}</span>
            <span aria-hidden="true">·</span>
            <span>Updated live from Supabase</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <svg
                className={`h-4 w-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={() => {
                setTestError('');
                setIsTestModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              Send Test Push
            </button>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[2rem] border border-slate-200/90 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Push Subscribers</p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {isLoading ? '…' : (stats.totalSubscribers ?? 0).toLocaleString()}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>{stats.registeredCount ?? 0} signed-in</span>
              <span aria-hidden="true">·</span>
              <span>{stats.anonymousCount ?? 0} anonymous</span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/90 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dispatches (Auto vs Manual)</p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {isLoading ? '…' : (stats.totalDispatches ?? 0).toLocaleString()}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-emerald-700">{stats.autoDispatchesCount ?? 0} automatic</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-amber-700">{stats.manualDispatchesCount ?? 0} manual</span>
              <span aria-hidden="true">·</span>
              <span>{stats.totalJobsNotified ?? jobAnalytics.length} jobs</span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/90 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Clicks / Opens</p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {isLoading ? '…' : (stats.totalOpens ?? 0).toLocaleString()}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>{(stats.totalPushesSent ?? 0).toLocaleString()} total delivered</span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/90 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Click Rate (CTR)</p>
            <p className="mt-2 text-3xl font-black text-cyan-600">
              {isLoading ? '…' : `${stats.overallCtr ?? '0.0'}%`}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>{stats.totalPushesFailed ?? 0} failed / expired</span>
            </div>
          </div>
        </div>

        {/* Secondary Navigation / Tabs & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('jobs');
                setSearchTerm('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'jobs'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Job-Wise Analytics ({jobAnalytics.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('dispatches');
                setSearchTerm('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'dispatches'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              All Dispatches ({recentDispatches.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('opens');
                setSearchTerm('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'opens'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Click Stream ({recentOpens.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('audience');
                setSearchTerm('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'audience'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Audience & Devices ({subscribers.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('inapp');
                setSearchTerm('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'inapp'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              In-App Alerts ({recentJobAlerts.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(activeTab === 'jobs' || activeTab === 'dispatches') ? (
              <select
                value={triggerFilter}
                onChange={(e) => setTriggerFilter(e.target.value)}
                aria-label="Filter by notification trigger type"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="all">All Trigger Types</option>
                <option value="auto">All Automatic (Company + Admin)</option>
                <option value="auto_employer">Auto: Company Posted</option>
                <option value="auto_admin">Auto: Admin Posted</option>
                <option value="manual">All Manual (Bell & Test)</option>
                <option value="manual_admin">Manual: Admin Bell</option>
                <option value="manual_test">Manual: Test Broadcast</option>
              </select>
            ) : null}

            {activeTab !== 'inapp' ? (
              <div className="w-full sm:w-64">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search jobs, companies, devices..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Tab 1: Job-Wise Analytics */}
        {activeTab === 'jobs' ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Job-Wise Push & Click Analytics</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Complete performance breakdown for every job that received push notifications — showing whether it was sent automatically (upon company or admin post) or manually (via the admin bell icon), along with subscriber clicks and CTR.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <TriggerBadge triggerType="auto_employer" />
                <TriggerBadge triggerType="auto_admin" />
                <TriggerBadge triggerType="manual_admin" />
              </div>
            </div>

            {filteredJobAnalytics.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-500">
                  {searchTerm || triggerFilter !== 'all'
                    ? 'No jobs match the selected filters.'
                    : 'No job push notifications recorded yet.'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  When a company or admin publishes a job, or when you click the bell icon on a job details page, full analytics appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="pb-3 font-semibold">Job & Company</th>
                      <th className="pb-3 font-semibold">Notification Mode (Auto / Manual)</th>
                      <th className="pb-3 font-semibold">Last Sent</th>
                      <th className="pb-3 text-right font-semibold">Subscribers</th>
                      <th className="pb-3 text-right font-semibold">Delivered</th>
                      <th className="pb-3 text-right font-semibold">People Clicked</th>
                      <th className="pb-3 text-right font-semibold">Click Rate (CTR)</th>
                      <th className="pb-3 text-right font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredJobAnalytics.map((job) => {
                      const ctrNum = parseFloat(job.ctr || '0');
                      return (
                        <tr key={job.jobId} className="transition hover:bg-slate-50/80">
                          <td className="py-4 pr-4">
                            <div className="flex items-start gap-2">
                              <div>
                                <Link
                                  to={job.url}
                                  className="font-bold text-slate-900 hover:text-cyan-600 hover:underline"
                                >
                                  {job.title}
                                </Link>
                                <p className="mt-0.5 text-xs font-medium text-slate-600">
                                  {job.company} · <span className="text-slate-400">{job.location}</span>
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                  Posted by: <span className="font-semibold text-slate-600">{job.posterRole}</span> ({job.posterName})
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(job.triggers || []).map((t) => (
                                <TriggerBadge key={t} triggerType={t} />
                              ))}
                            </div>
                            <p className="mt-1.5 text-[11px] text-slate-500">
                              {job.dispatchesCount} dispatch{job.dispatchesCount === 1 ? '' : 'es'} (
                              {job.autoCount > 0 ? `${job.autoCount} auto` : ''}
                              {job.autoCount > 0 && job.manualCount > 0 ? ', ' : ''}
                              {job.manualCount > 0 ? `${job.manualCount} manual` : ''})
                            </p>
                          </td>

                          <td className="py-4 pr-4 text-xs whitespace-nowrap text-slate-500">
                            {formatDate(job.lastSentAt)}
                          </td>

                          <td className="py-4 pr-4 text-right font-medium text-slate-700">
                            {job.totalTarget.toLocaleString()}
                          </td>

                          <td className="py-4 pr-4 text-right">
                            <span className="font-semibold text-emerald-600">
                              {job.totalSent.toLocaleString()}
                            </span>
                            {job.totalFailed > 0 ? (
                              <span className="block text-[11px] text-rose-500">
                                {job.totalFailed} failed
                              </span>
                            ) : null}
                          </td>

                          <td className="py-4 pr-4 text-right">
                            <span className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-2.5 py-1 text-sm font-black text-slate-900">
                              {job.totalOpens.toLocaleString()}
                            </span>
                          </td>

                          <td className="py-4 pr-4 text-right">
                            <span
                              className={`inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-bold ${
                                ctrNum >= 5
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : ctrNum > 0
                                    ? 'bg-cyan-50 text-cyan-700'
                                    : 'bg-slate-50 text-slate-400'
                              }`}
                            >
                              {job.ctr}%
                            </span>
                          </td>

                          <td className="py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedJobForClicks(job)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
                            >
                              View Clicks ({job.clicks?.length || job.totalOpens || 0})
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {/* Tab 2: All Push Dispatches */}
        {activeTab === 'dispatches' ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">All Push Notification Dispatches</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Chronological log of every notification batch sent automatically or manually.
                </p>
              </div>
            </div>

            {filteredDispatches.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-500">
                  {searchTerm || triggerFilter !== 'all'
                    ? 'No dispatches match your filter criteria.'
                    : 'No notification dispatches recorded yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="pb-3 font-semibold">Job / Alert Details</th>
                      <th className="pb-3 font-semibold">Trigger Method</th>
                      <th className="pb-3 font-semibold">Sent Time</th>
                      <th className="pb-3 text-right font-semibold">Target</th>
                      <th className="pb-3 text-right font-semibold">Delivered</th>
                      <th className="pb-3 text-right font-semibold">People Clicked</th>
                      <th className="pb-3 text-right font-semibold">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDispatches.map((dispatch) => {
                      const sent = dispatch.sent_count || 0;
                      const opens = dispatch.open_count || 0;
                      const ctr = sent > 0 ? ((opens / sent) * 100).toFixed(1) : '0.0';

                      return (
                        <tr key={dispatch.id} className="transition hover:bg-slate-50/80">
                          <td className="py-3.5 pr-4">
                            <p className="font-semibold text-slate-900">{dispatch.title}</p>
                            {dispatch.body ? (
                              <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">{dispatch.body}</p>
                            ) : null}
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              {dispatch.job_id ? (
                                <span>
                                  Job by <strong className="text-slate-600">{dispatch.posterRole}</strong> ({dispatch.posterName})
                                </span>
                              ) : (
                                <span>Custom / Test Broadcast</span>
                              )}
                              {dispatch.jobPath || dispatch.url ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <a
                                    href={dispatch.jobPath || dispatch.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-cyan-600 hover:underline"
                                  >
                                    Open Job Page
                                  </a>
                                </>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3.5 pr-4">
                            <TriggerBadge triggerType={dispatch.triggerType} />
                          </td>
                          <td className="py-3.5 pr-4 text-xs whitespace-nowrap text-slate-500">
                            {formatDate(dispatch.created_at)}
                          </td>
                          <td className="py-3.5 pr-4 text-right font-medium text-slate-700">
                            {dispatch.target_subscribers ?? 0}
                          </td>
                          <td className="py-3.5 pr-4 text-right">
                            <span className="font-medium text-emerald-600">{sent}</span>
                            {dispatch.failed_count > 0 ? (
                              <span className="ml-1 text-xs text-rose-500">({dispatch.failed_count} failed)</span>
                            ) : null}
                          </td>
                          <td className="py-3.5 pr-4 text-right font-bold text-slate-900">{opens}</td>
                          <td className="py-3.5 text-right font-bold text-cyan-600">{ctr}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {/* Tab 3: Click Stream (Recent Opens) */}
        {activeTab === 'opens' ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-950">Subscriber Click Stream</h2>
              <p className="mt-1 text-xs text-slate-500">
                Real-time log of every user click on a job push notification across mobile and desktop devices.
              </p>
            </div>

            {filteredOpens.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-500">No push notification clicks logged yet.</p>
                <p className="mt-1 text-xs text-slate-400">
                  When subscribers tap or click a job alert notification, each click event is recorded here with job and device info.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="pb-3 font-semibold">Clicked Time</th>
                      <th className="pb-3 font-semibold">Job Clicked</th>
                      <th className="pb-3 font-semibold">Device & Browser</th>
                      <th className="pb-3 font-semibold">Visitor Identifier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOpens.map((open) => (
                      <tr key={open.id} className="transition hover:bg-slate-50/80">
                        <td className="py-3.5 pr-4 text-xs whitespace-nowrap font-medium text-slate-900">
                          {formatDate(open.opened_at)}
                        </td>
                        <td className="py-3.5 pr-4">
                          {open.jobSlug || open.job_id ? (
                            <Link
                              to={`/job/${open.jobSlug || open.job_id}`}
                              className="font-semibold text-slate-900 hover:text-cyan-600 hover:underline"
                            >
                              {open.jobTitle}
                            </Link>
                          ) : (
                            <span className="font-semibold text-slate-900">{open.jobTitle}</span>
                          )}
                          {open.jobCompany ? (
                            <span className="block text-xs text-slate-500">{open.jobCompany}</span>
                          ) : null}
                        </td>
                        <td className="py-3.5 pr-4 text-xs">
                          <span className="font-semibold text-slate-800">{open.browser || 'Browser'}</span>
                          <span className="text-slate-400"> on </span>
                          <span className="text-slate-700">{open.os || 'OS'}</span>
                          <span className="ml-1 text-slate-400">({open.deviceType || 'Device'})</span>
                        </td>
                        <td className="py-3.5 text-xs font-mono text-slate-500">
                          {open.visitor_key ? open.visitor_key.slice(0, 24) : 'anonymous'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {/* Tab 4: Audience & Devices */}
        {activeTab === 'audience' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Device Types</h3>
                <div className="mt-4 space-y-2.5">
                  {Object.entries(deviceBreakdown.devices || {}).map(([dev, count]) => {
                    const total = stats.totalSubscribers || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={dev}>
                        <div className="flex justify-between text-xs text-slate-700">
                          <span className="font-medium">{dev}</span>
                          <span>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Browsers</h3>
                <div className="mt-4 space-y-2.5">
                  {Object.entries(deviceBreakdown.browsers || {}).map(([browser, count]) => {
                    const total = stats.totalSubscribers || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={browser}>
                        <div className="flex justify-between text-xs text-slate-700">
                          <span className="font-medium">{browser}</span>
                          <span>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Operating Systems</h3>
                <div className="mt-4 space-y-2.5">
                  {Object.entries(deviceBreakdown.operatingSystems || {}).map(([os, count]) => {
                    const total = stats.totalSubscribers || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={os}>
                        <div className="flex justify-between text-xs text-slate-700">
                          <span className="font-medium">{os}</span>
                          <span>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-slate-800" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Subscribed Endpoints</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Browsers and progressive web apps opted in to receive live updates.
                  </p>
                </div>
              </div>

              {filteredSubscribers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-slate-500">No push subscribers found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                        <th className="pb-3 font-semibold">Device & Browser</th>
                        <th className="pb-3 font-semibold">User Type</th>
                        <th className="pb-3 font-semibold">Subscribed At</th>
                        <th className="pb-3 font-semibold">User Agent Snippet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSubscribers.map((sub) => (
                        <tr key={sub.key} className="transition hover:bg-slate-50/80">
                          <td className="py-3.5 pr-4">
                            <span className="font-semibold text-slate-900">{sub.browser}</span>
                            <span className="text-slate-400"> on </span>
                            <span className="text-slate-700">{sub.os}</span>
                            <span className="text-xs text-slate-400"> ({sub.deviceType})</span>
                          </td>
                          <td className="py-3.5 pr-4 text-xs">
                            {sub.isRegistered ? (
                              <span className="font-medium text-blue-700">Registered User</span>
                            ) : (
                              <span className="text-slate-500">Guest Visitor</span>
                            )}
                          </td>
                          <td className="py-3.5 pr-4 text-xs whitespace-nowrap text-slate-500">
                            {formatDate(sub.createdAt)}
                          </td>
                          <td className="py-3.5 text-xs text-slate-400 font-mono max-w-xs truncate">
                            {sub.userAgentSnippet}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {/* Tab 5: In-App Alerts */}
        {activeTab === 'inapp' ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-950">Recent Job Alerts (In-App)</h2>
              <p className="mt-1 text-xs text-slate-500">
                Job notifications published to the seeker portal and notification bell.
              </p>
            </div>

            {recentJobAlerts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-500">No in-app job alerts recorded.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="pb-3 font-semibold">Alert Title</th>
                      <th className="pb-3 font-semibold">Preview Content</th>
                      <th className="pb-3 font-semibold">Published At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentJobAlerts.map((alert) => (
                      <tr key={alert.id} className="transition hover:bg-slate-50/80">
                        <td className="py-3.5 pr-4 font-semibold text-slate-900">{alert.title}</td>
                        <td className="py-3.5 pr-4 text-xs text-slate-500 max-w-sm truncate">{alert.preview}</td>
                        <td className="py-3.5 text-xs whitespace-nowrap text-slate-500">
                          {formatDate(alert.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </div>

      {/* Job Clicks Inspector Modal */}
      {selectedJobForClicks ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-600">
                  Job Click Analytics
                </span>
                <h3 className="mt-0.5 text-lg font-bold text-slate-950">
                  {selectedJobForClicks.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedJobForClicks.company} · {selectedJobForClicks.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobForClicks(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Delivered</p>
                <p className="mt-1 text-xl font-black text-slate-900">{selectedJobForClicks.totalSent}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase text-slate-400">People Clicked</p>
                <p className="mt-1 text-xl font-black text-emerald-600">{selectedJobForClicks.totalOpens}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Click Rate (CTR)</p>
                <p className="mt-1 text-xl font-black text-cyan-600">{selectedJobForClicks.ctr}%</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Dispatches</p>
                <p className="mt-1 text-xl font-black text-slate-900">{selectedJobForClicks.dispatchesCount}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold">Trigger Modes:</span>
              {(selectedJobForClicks.triggers || []).map((t) => (
                <TriggerBadge key={t} triggerType={t} />
              ))}
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Individual Click Log ({selectedJobForClicks.clicks?.length || 0})
              </h4>
              {!selectedJobForClicks.clicks || selectedJobForClicks.clicks.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 py-8 text-center text-xs text-slate-500">
                  No individual click records found for this job yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-400">
                      <th className="pb-2 font-semibold">Clicked At</th>
                      <th className="pb-2 font-semibold">Device</th>
                      <th className="pb-2 font-semibold">Browser & OS</th>
                      <th className="pb-2 font-semibold">Visitor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedJobForClicks.clicks.map((click) => (
                      <tr key={click.id}>
                        <td className="py-2.5 pr-3 font-medium text-slate-900 whitespace-nowrap">
                          {formatDate(click.opened_at)}
                        </td>
                        <td className="py-2.5 pr-3">{click.deviceType || 'Desktop'}</td>
                        <td className="py-2.5 pr-3">
                          {click.browser || 'Browser'} · {click.os || 'OS'}
                        </td>
                        <td className="py-2.5 font-mono text-slate-500">
                          {click.visitor_key ? click.visitor_key.slice(0, 18) : 'anon'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setSelectedJobForClicks(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Send Test Push Modal */}
      {isTestModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950">Send Test Push Alert</h3>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {testError ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {testError}
              </div>
            ) : null}

            <form onSubmit={handleSendTestPush} className="mt-4 space-y-4">
              <div>
                <label htmlFor={testTitleInputId} className="block text-xs font-semibold text-slate-700">
                  Notification Title
                </label>
                <input
                  id={testTitleInputId}
                  type="text"
                  value={testForm.title}
                  onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  required
                />
              </div>

              <div>
                <label htmlFor={testBodyInputId} className="block text-xs font-semibold text-slate-700">
                  Notification Body
                </label>
                <textarea
                  id={testBodyInputId}
                  rows={3}
                  value={testForm.body}
                  onChange={(e) => setTestForm({ ...testForm, body: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div>
                <label htmlFor={testUrlInputId} className="block text-xs font-semibold text-slate-700">
                  Target Destination URL
                </label>
                <input
                  id={testUrlInputId}
                  type="text"
                  value={testForm.url}
                  onChange={(e) => setTestForm({ ...testForm, url: e.target.value })}
                  placeholder="/jobs or https://jobsinvizag.in/jobs"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Preview</p>
                <p className="mt-1 font-bold text-slate-900">{testForm.title || 'Notification Title'}</p>
                <p className="mt-0.5 text-slate-600">{testForm.body || 'Notification message description...'}</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  disabled={isSendingTest}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50"
                >
                  {isSendingTest ? 'Sending…' : 'Send Push to All'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
