import { useEffect, useId, useMemo, useState } from 'react';
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

export default function AdminNotificationsPage() {
  useAdminAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState('dispatches'); // 'dispatches' | 'audience' | 'opens' | 'inapp'

  // Search in tables
  const [searchTerm, setSearchTerm] = useState('');

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
  const recentOpens = analyticsData?.recentOpens || [];
  const recentJobAlerts = analyticsData?.recentJobAlerts || [];

  const rawDispatches = analyticsData?.recentDispatches;
  const recentDispatches = useMemo(() => rawDispatches || [], [rawDispatches]);

  const rawSubscribers = analyticsData?.subscribers;
  const subscribers = useMemo(() => rawSubscribers || [], [rawSubscribers]);

  // Filtered dispatches
  const filteredDispatches = useMemo(() => {
    if (!searchTerm.trim()) return recentDispatches;
    const term = searchTerm.toLowerCase();
    return recentDispatches.filter(
      (d) =>
        d.title?.toLowerCase().includes(term) ||
        d.body?.toLowerCase().includes(term) ||
        d.tag?.toLowerCase().includes(term),
    );
  }, [recentDispatches, searchTerm]);

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
      description="Monitor Web Push subscribers, delivery logs, candidate alert engagement, and open rate metrics."
    >
      <SEO
        title="Notification Analytics | Vizag Jobs Admin"
        description="Admin dashboard for browser push subscriber metrics and notification CTR analytics."
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
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Dispatches</p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {isLoading ? '…' : (stats.totalDispatches ?? 0).toLocaleString()}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>{(stats.totalPushesSent ?? 0).toLocaleString()} notifications delivered</span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/90 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Opens & Clicks</p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {isLoading ? '…' : (stats.totalOpens ?? 0).toLocaleString()}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>Tracked via web push referrer</span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/90 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Open Rate (CTR)</p>
            <p className="mt-2 text-3xl font-black text-cyan-600">
              {isLoading ? '…' : `${stats.overallCtr ?? '0.0'}%`}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>{stats.totalPushesFailed ?? 0} failed / expired</span>
            </div>
          </div>
        </div>

        {/* Secondary Navigation / Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1">
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
              Push Dispatches ({recentDispatches.length})
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
                setActiveTab('opens');
                setSearchTerm('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'opens'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Recent Opens ({recentOpens.length})
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

          {activeTab !== 'opens' && activeTab !== 'inapp' ? (
            <div className="w-full sm:w-64">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </div>
          ) : null}
        </div>

        {/* Tab 1: Push Dispatches */}
        {activeTab === 'dispatches' ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Push Notification Dispatches</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Batches delivered via browser push to subscriber endpoints.
                </p>
              </div>
            </div>

            {filteredDispatches.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-500">
                  {searchTerm ? 'No dispatches match your search query.' : 'No notification dispatches recorded yet.'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Dispatches are automatically created when new jobs are published or when you trigger a test push.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="pb-3 font-semibold">Title & Details</th>
                      <th className="pb-3 font-semibold">Sent Time</th>
                      <th className="pb-3 text-right font-semibold">Target</th>
                      <th className="pb-3 text-right font-semibold">Delivered</th>
                      <th className="pb-3 text-right font-semibold">Opens</th>
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
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                              <span>{dispatch.is_test ? 'Test Broadcast' : 'Job Alert'}</span>
                              {dispatch.url ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <a
                                    href={dispatch.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyan-600 hover:underline"
                                  >
                                    View Destination
                                  </a>
                                </>
                              ) : null}
                            </div>
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
                          <td className="py-3.5 pr-4 text-right font-medium text-slate-900">{opens}</td>
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

        {/* Tab 2: Audience & Devices */}
        {activeTab === 'audience' ? (
          <div className="space-y-6">
            {/* Device breakdown summaries */}
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

            {/* Subscribers Table */}
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

        {/* Tab 3: Recent Opens */}
        {activeTab === 'opens' ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-950">Recent Notification Open Activity</h2>
              <p className="mt-1 text-xs text-slate-500">
                Logged click-through events when subscribers opened a web push notification.
              </p>
            </div>

            {recentOpens.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-500">No push notification opens logged yet.</p>
                <p className="mt-1 text-xs text-slate-400">
                  When recipients click a job alert notification on mobile or desktop, open events will be streamed here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="pb-3 font-semibold">Opened Time</th>
                      <th className="pb-3 font-semibold">Visitor Identifier</th>
                      <th className="pb-3 font-semibold">User Agent / Client</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentOpens.map((open) => (
                      <tr key={open.id} className="transition hover:bg-slate-50/80">
                        <td className="py-3.5 pr-4 text-xs whitespace-nowrap font-medium text-slate-900">
                          {formatDate(open.opened_at)}
                        </td>
                        <td className="py-3.5 pr-4 text-xs font-mono text-slate-600">
                          {open.visitor_key ? open.visitor_key.slice(0, 24) : 'anonymous'}
                        </td>
                        <td className="py-3.5 text-xs text-slate-500 max-w-md truncate font-mono">
                          {open.user_agent || 'Unknown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {/* Tab 4: In-App Alerts */}
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
