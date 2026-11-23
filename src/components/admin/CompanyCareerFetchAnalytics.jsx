import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchDirectCompanyJobsTotalCount, updateCompanyLastFetchedAt } from '../../services/adminCompanies';
import { runSingleCompanyCareerPipeline } from '../../lib/companyCareerFetchAutomation';
import { pushToast } from '../../lib/toast';

function detectPortalPlatform(url = '') {
  const u = String(url).toLowerCase();
  if (u.includes('.myworkdayjobs.com')) return { label: 'Workday CXS', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
  if (u.includes('smartrecruiters.com')) return { label: 'SmartRecruiters', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
  if (u.includes('lever.co')) return { label: 'Lever API', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (u.includes('careers.gmrgroup.in') || u.includes('careers.brandix.com') || u.includes('careers.asianpaints.com') || u.includes('careers.dmartindia.com') || u.includes('careers.vodafoneidea.com')) {
    return { label: 'SuccessFactors', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  if (u.includes('zohorecruit.in')) return { label: 'Zoho Recruit', bg: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
  if (u.includes('sailssoftware.com')) return { label: 'Zwayam API', bg: 'bg-teal-100 text-teal-800 border-teal-200' };
  if (u.includes('pms.inventrax.com')) return { label: 'Inventrax PMS', bg: 'bg-orange-100 text-orange-800 border-orange-200' };
  return { label: 'Direct Portal', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
}

function formatRelativeTime(date) {
  if (!date) return 'Never';
  const time = new Date(date).getTime();
  if (isNaN(time)) return 'Never';
  const diffMs = Date.now() - time;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatFullDateTime(date) {
  if (!date) return 'Never fetched';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Never fetched';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calculateNextFetch(lastFetchedAt) {
  if (!lastFetchedAt) {
    return { isDue: true, label: 'Due Now', fullDate: 'Immediate', badgeClass: 'bg-emerald-500 text-white font-bold animate-pulse' };
  }
  const lastTime = new Date(lastFetchedAt).getTime();
  if (isNaN(lastTime)) {
    return { isDue: true, label: 'Due Now', fullDate: 'Immediate', badgeClass: 'bg-emerald-500 text-white font-bold animate-pulse' };
  }

  const cooldownMs = 7 * 24 * 60 * 60 * 1000;
  const nextTime = lastTime + cooldownMs;
  const now = Date.now();

  if (now >= nextTime) {
    return { isDue: true, label: 'Due Now', fullDate: 'Eligible for next run', badgeClass: 'bg-emerald-500 text-white font-bold' };
  }

  const remainingDays = Math.ceil((nextTime - now) / (24 * 60 * 60 * 1000));
  const nextDateFormatted = new Date(nextTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return {
    isDue: false,
    label: `In ${remainingDays}d (${nextDateFormatted})`,
    fullDate: new Date(nextTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-medium',
  };
}

export default function CompanyCareerFetchAnalytics({ companies = [], onRefresh, session }) {
  const [directJobsCount, setDirectJobsCount] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'DUE' | 'COOLDOWN' | 'WITH_JOBS'
  const [searchFilter, setSearchFilter] = useState('');
  const [isFetchingSingle, setIsFetchingSingle] = useState(null); // company.name
  const [isLoadingCount, setIsLoadingCount] = useState(true);

  // Load exact total direct jobs count from DB
  const loadDirectJobsCount = useCallback(async () => {
    setIsLoadingCount(true);
    try {
      const count = await fetchDirectCompanyJobsTotalCount();
      setDirectJobsCount(count);
    } catch {
      setDirectJobsCount(0);
    } finally {
      setIsLoadingCount(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectJobsCount();
  }, [loadDirectJobsCount]);

  // Verified companies with approved careers URLs
  const verifiedCompanies = useMemo(() => {
    return companies.filter(
      (c) => c.verifiedCareersUrl && c.careersUrl && c.verifiedCareersUrl === c.careersUrl
    );
  }, [companies]);

  // Aggregated analytics metrics
  const analytics = useMemo(() => {
    let dueCount = 0;
    let cooldownCount = 0;
    let fetchedTodayCount = 0;
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    for (const c of verifiedCompanies) {
      if (!c.lastFetchedAt) {
        dueCount++;
      } else {
        const lastTime = new Date(c.lastFetchedAt).getTime();
        if (isNaN(lastTime) || now - lastTime > sevenDaysMs) {
          dueCount++;
        } else {
          cooldownCount++;
        }
        if (!isNaN(lastTime) && now - lastTime <= oneDayMs) {
          fetchedTodayCount++;
        }
      }
    }

    const totalActiveJobs = verifiedCompanies.reduce((acc, c) => acc + (c.activeJobsCount || 0), 0);

    return {
      totalVerifiedPortals: verifiedCompanies.length,
      dueCount,
      cooldownCount,
      fetchedTodayCount,
      totalActiveJobs,
    };
  }, [verifiedCompanies]);

  // Filtered companies based on tabs and search
  const filteredList = useMemo(() => {
    let list = verifiedCompanies;

    if (activeTab === 'DUE') {
      list = list.filter((c) => {
        if (!c.lastFetchedAt) return true;
        const time = new Date(c.lastFetchedAt).getTime();
        return isNaN(time) || Date.now() - time > 7 * 24 * 60 * 60 * 1000;
      });
    } else if (activeTab === 'COOLDOWN') {
      list = list.filter((c) => {
        if (!c.lastFetchedAt) return false;
        const time = new Date(c.lastFetchedAt).getTime();
        return !isNaN(time) && Date.now() - time <= 7 * 24 * 60 * 60 * 1000;
      });
    } else if (activeTab === 'WITH_JOBS') {
      list = list.filter((c) => (c.activeJobsCount || 0) > 0);
    }

    const q = searchFilter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.category && c.category.toLowerCase().includes(q)) ||
          (c.verifiedCareersUrl && c.verifiedCareersUrl.toLowerCase().includes(q))
      );
    }

    // Sort: Due first, then by live jobs count descending
    return [...list].sort((a, b) => {
      const aDue = !a.lastFetchedAt || Date.now() - new Date(a.lastFetchedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
      const bDue = !b.lastFetchedAt || Date.now() - new Date(b.lastFetchedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return (b.activeJobsCount || 0) - (a.activeJobsCount || 0);
    });
  }, [verifiedCompanies, activeTab, searchFilter]);

  // Handle manual single-company fetch trigger
  const handleManualFetch = async (company) => {
    if (isFetchingSingle) return;
    setIsFetchingSingle(company.name);

    try {
      pushToast({
        message: `🔍 Fetching active Vizag openings for ${company.name}...`,
        type: 'info',
      });

      const report = await runSingleCompanyCareerPipeline({
        company: {
          name: company.name,
          careersUrl: company.verifiedCareersUrl || company.careersUrl,
          website: company.website,
          category: company.category,
          location: company.location,
        },
        accessToken: session?.access_token,
      });

      // Update cooldown in Supabase
      if (company.id) {
        await updateCompanyLastFetchedAt(company.id);
      }

      const published = report?.stats?.published || 0;
      const fetched = report?.stats?.fetched || 0;

      pushToast({
        message: `✅ Finished ${company.name}: ${published} job(s) published, ${fetched} role(s) reviewed.`,
        type: 'success',
      });

      // Refresh data
      if (onRefresh) onRefresh();
      void loadDirectJobsCount();
    } catch (err) {
      pushToast({
        message: `Fetch failed for ${company.name}: ${err.message || 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setIsFetchingSingle(null);
    }
  };

  return (
    <div className="mb-8 rounded-3xl border border-cyan-800/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-4 text-white shadow-xl sm:p-6 lg:p-7">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-950/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Admin Intelligence</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
              <span>● Cloud Runner Active</span>
            </span>
          </div>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Direct Company Career Fetch & Schedule Intelligence
          </h2>
          <p className="mt-1 text-xs text-slate-300 sm:text-sm">
            Real-time status of official employer career portals, 7-day fetch cooldowns, and live published Vizag jobs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              if (onRefresh) onRefresh();
              void loadDirectJobsCount();
            }}
            aria-label="Refresh company analytics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white active:scale-95"
            title="Reload company status and job counts"
          >
            <svg className={`h-4 w-4 ${isLoadingCount ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-xl border border-cyan-500/40 bg-cyan-950/60 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-900 active:scale-95"
          >
            <span>{isExpanded ? 'Collapse' : 'Expand Analytics'}</span>
            <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Card 1: Verified Portals */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3.5 backdrop-blur-sm sm:p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Perfect URLs</span>
            <span className="text-lg">🎯</span>
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-300 sm:text-3xl">
            {analytics.totalVerifiedPortals}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <span>✓ 100% Verified ATS</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Workday, SmartRecruiters, Lever, SuccessFactors.
          </p>
        </div>

        {/* Card 2: Total Direct Jobs Published */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3.5 backdrop-blur-sm sm:p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Direct Jobs Fetched</span>
            <span className="text-lg">💼</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-300 sm:text-3xl">
            {directJobsCount !== null ? directJobsCount : '...'}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
            <span>{analytics.totalActiveJobs} active on directory</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Source: Direct Company Website
          </p>
        </div>

        {/* Card 3: Due for Fetch */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3.5 backdrop-blur-sm sm:p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Due For Next Fetch</span>
            <span className="text-lg">🟢</span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
            {analytics.dueCount}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-400">
            <span>Ready for next run</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            7-day cooldown elapsed or never checked
          </p>
        </div>

        {/* Card 4: On Cooldown */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3.5 backdrop-blur-sm sm:p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">On 7-Day Cooldown</span>
            <span className="text-lg">🛡️</span>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-300 sm:text-3xl">
            {analytics.cooldownCount}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-purple-300">
            <span>{analytics.fetchedTodayCount} fetched in last 24h</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Protects database egress & rate limits
          </p>
        </div>
      </div>

      {isExpanded ? (
        <>
          {/* Automation Schedule Banner */}
          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-3.5 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="inline-flex items-center gap-1.5 font-bold text-cyan-300">
                <span>⏱️ Automation Schedule:</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span>☁️ GitHub Cloud:</span>
                <strong className="text-white">Daily at 4:00 PM IST</strong> (runs 24/7)
              </span>
              <span className="hidden text-slate-600 sm:inline">•</span>
              <span className="inline-flex items-center gap-1">
                <span>💻 Local Runner:</span>
                <strong className="text-white">8:30 AM & 6:30 PM IST</strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              <span>Batch size: <strong>3 companies per run</strong></span>
            </div>
          </div>

          {/* Table Controls & Filter Tabs */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`rounded-xl px-3 py-1.5 font-bold transition ${
                  activeTab === 'ALL'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Verified ({verifiedCompanies.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('DUE')}
                className={`rounded-xl px-3 py-1.5 font-bold transition ${
                  activeTab === 'DUE'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Due for Fetch ({analytics.dueCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('COOLDOWN')}
                className={`rounded-xl px-3 py-1.5 font-bold transition ${
                  activeTab === 'COOLDOWN'
                    ? 'bg-purple-400 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                On Cooldown ({analytics.cooldownCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('WITH_JOBS')}
                className={`rounded-xl px-3 py-1.5 font-bold transition ${
                  activeTab === 'WITH_JOBS'
                    ? 'bg-emerald-400 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                With Live Jobs ({verifiedCompanies.filter((c) => (c.activeJobsCount || 0) > 0).length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="search"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search verified company..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
              />
              {searchFilter ? (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  aria-label="Clear company filter"
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>

          {/* Companies Detailed Table (Desktop) */}
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-700/80 md:block">
            <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
              <thead className="bg-slate-950/80 font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Company & Platform</th>
                  <th className="px-4 py-3">Verified Portal URL</th>
                  <th className="px-4 py-3">Last Fetched Date</th>
                  <th className="px-4 py-3">Next Scheduled Fetch</th>
                  <th className="px-4 py-3 text-center">Live Jobs</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 bg-slate-900/60">
                {filteredList.map((company) => {
                  const platform = detectPortalPlatform(company.verifiedCareersUrl);
                  const nextFetch = calculateNextFetch(company.lastFetchedAt);
                  const isBusy = isFetchingSingle === company.name;

                  return (
                    <tr key={company.id || company.name} className="transition hover:bg-slate-800/50">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white text-sm">{company.name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${platform.bg}`}>
                            {platform.label}
                          </span>
                          <span className="text-[11px] text-slate-400">{company.sectorLabel || company.category}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <a
                          href={company.verifiedCareersUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open verified portal for ${company.name}`}
                          className="inline-flex max-w-xs items-center gap-1 truncate text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
                          title={company.verifiedCareersUrl}
                        >
                          <span className="truncate">{company.verifiedCareersUrl}</span>
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-200">
                          {formatRelativeTime(company.lastFetchedAt)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatFullDateTime(company.lastFetchedAt)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${nextFetch.badgeClass}`}>
                          {nextFetch.label}
                        </span>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {nextFetch.fullDate}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {company.activeJobsCount > 0 ? (
                          <Link
                            to={`/jobs?company=${encodeURIComponent(company.name)}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-900"
                            title="View jobs"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            <span>{company.activeJobsCount} jobs</span>
                          </Link>
                        ) : (
                          <span className="text-[11px] text-slate-500">0 live</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleManualFetch(company)}
                          disabled={isBusy || Boolean(isFetchingSingle)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-950/80 px-3 py-1.5 text-xs font-bold text-cyan-200 transition hover:bg-cyan-800 hover:text-white active:scale-95 disabled:opacity-50"
                          title="Trigger manual scraper run for this company"
                        >
                          {isBusy ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                              <span>Fetching...</span>
                            </>
                          ) : (
                            <>
                              <span>⚡</span>
                              <span>Fetch Now</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Companies List (Mobile Responsive Cards) */}
          <div className="mt-4 divide-y divide-slate-800 rounded-2xl border border-slate-700/80 bg-slate-900/60 md:hidden">
            {filteredList.map((company) => {
              const platform = detectPortalPlatform(company.verifiedCareersUrl);
              const nextFetch = calculateNextFetch(company.lastFetchedAt);
              const isBusy = isFetchingSingle === company.name;

              return (
                <div key={company.id || company.name} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-base">{company.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${platform.bg}`}>
                          {platform.label}
                        </span>
                        <span className="text-xs text-slate-400">{company.sectorLabel || company.category}</span>
                      </div>
                    </div>
                    {company.activeJobsCount > 0 ? (
                      <Link
                        to={`/jobs?company=${encodeURIComponent(company.name)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2 py-1 text-xs font-bold text-emerald-300"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>{company.activeJobsCount} jobs</span>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-slate-500">0 live</span>
                    )}
                  </div>

                  <div className="text-xs">
                    <a
                      href={company.verifiedCareersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-cyan-400 hover:underline"
                    >
                      <span className="truncate">{company.verifiedCareersUrl}</span>
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Last Fetched:</span>
                      <span className="font-semibold text-slate-200">{formatRelativeTime(company.lastFetchedAt)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Next Scheduled:</span>
                      <span className={`inline-block rounded px-2 py-0.5 text-[11px] mt-0.5 ${nextFetch.badgeClass}`}>
                        {nextFetch.label}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleManualFetch(company)}
                      disabled={isBusy || Boolean(isFetchingSingle)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-950/80 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-800 hover:text-white active:scale-95 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                          <span>Fetching now...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span>Fetch Now (Manual Scrape)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredList.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
              No verified companies match your current filter.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
