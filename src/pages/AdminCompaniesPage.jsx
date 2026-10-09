import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  fetchAdminCompanies,
  saveCompanyDetails,
  toggleCompanyDirectoryApproval,
  detectCareerPortalFromWebsite,
} from '../services/adminCompanies';
import { fetchAdminPlatformJobs } from '../services/adminJobs';
import {
  fetchAndClassifyCompanyJobs,
} from '../lib/companyCareerFetchAutomation';
import CompanyCareerJobApprovalModal from '../components/admin/CompanyCareerJobApprovalModal';
import { pushToast } from '../lib/toast';

const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-violet-600 to-purple-700',
  'from-amber-500 to-orange-600',
  'from-rose-600 to-pink-700',
  'from-cyan-600 to-blue-700',
];

const getAvatarGradient = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const getCompanyInitials = (name = '') => {
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (!clean) return 'CO';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const ITEMS_PER_PAGE = 25;

export default function AdminCompaniesPage() {
  const { session } = useAdminAuth();

  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'DIRECTORY_APPROVED' | 'PENDING_APPROVAL' | 'HAS_CAREERS' | 'AUTO_SCRAPE' | 'MISSING_URL'
  const [currentPage, setCurrentPage] = useState(1);

  // Edit Modal State
  const [editingCompany, setEditingCompany] = useState(null);
  const [editWebsite, setEditWebsite] = useState('');
  const [editCareersUrl, setEditCareersUrl] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editIsActiveForScrape, setEditIsActiveForScrape] = useState(false);
  const [editIsDirectoryApproved, setEditIsDirectoryApproved] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDetectingPortalInModal, setIsDetectingPortalInModal] = useState(false);
  const [detectingPortalCompanyName, setDetectingPortalCompanyName] = useState('');
  const [batchDetectProgress, setBatchDetectProgress] = useState(null);

  // Single-Company Manual Fetch + Gemini SEO + Auto-Publish State
  const [fetchingCompanyName, setFetchingCompanyName] = useState('');
  const [fetchProgress, setFetchProgress] = useState(null);
  const [fetchReportModal, setFetchReportModal] = useState(null);
  const [approvalModalData, setApprovalModalData] = useState(null);
  const existingJobsCacheRef = useRef(null);
  const fetchAbortRef = useRef(null);

  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await fetchAdminCompanies();
      setCompanies(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load companies.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Categories list for filter dropdown
  const categoriesList = useMemo(() => {
    const set = new Set();
    companies.forEach((c) => {
      if (c.category && c.category !== 'General') {
        set.add(c.category);
      }
    });
    return Array.from(set).sort();
  }, [companies]);

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      // 1. Search filter
      if (deferredSearch) {
        const blob = `${c.name} ${c.category} ${c.website} ${c.careersUrl} ${c.location}`.toLowerCase();
        if (!blob.includes(deferredSearch)) return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) {
        return false;
      }

      // 3. Quick filter mode
      if (filterMode === 'DIRECTORY_APPROVED' && !c.isDirectoryApproved) return false;
      if (filterMode === 'PENDING_APPROVAL' && c.isDirectoryApproved) return false;
      if (filterMode === 'HAS_CAREERS' && !c.careersUrl) return false;
      if (filterMode === 'MISSING_URL' && Boolean(c.website || c.careersUrl)) return false;
      if (filterMode === 'AUTO_SCRAPE' && !c.isActiveForScrape) return false;

      return true;
    });
  }, [companies, deferredSearch, selectedCategory, filterMode]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, selectedCategory, filterMode]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / ITEMS_PER_PAGE));
  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCompanies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCompanies, currentPage]);

  // Stats Counters
  const stats = useMemo(() => {
    const total = companies.length;
    const directoryApproved = companies.filter((c) => Boolean(c.isDirectoryApproved)).length;
    const pendingApproval = total - directoryApproved;
    const withWebsite = companies.filter((c) => Boolean(c.website)).length;
    const withCareers = companies.filter((c) => Boolean(c.careersUrl)).length;
    const autoScrape = companies.filter((c) => c.isActiveForScrape && Boolean(c.careersUrl)).length;
    return { total, directoryApproved, pendingApproval, withWebsite, withCareers, autoScrape };
  }, [companies]);

  const handleOpenEdit = (comp) => {
    setEditingCompany(comp);
    setEditWebsite(comp.website || '');
    setEditCareersUrl(comp.careersUrl || '');
    setEditCategory(comp.category || 'General');
    setEditLocation(comp.location || 'Visakhapatnam');
    setEditIsActiveForScrape(Boolean(comp.isActiveForScrape));
    setEditIsDirectoryApproved(Boolean(comp.isDirectoryApproved));
    setEditNotes(comp.notes || '');
  };

  const handleCloseEdit = () => {
    setEditingCompany(null);
    setIsSaving(false);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCompany) return;

    setIsSaving(true);
    try {
      const payload = {
        name: editingCompany.name,
        website: editWebsite,
        careersUrl: editCareersUrl,
        category: editCategory,
        location: editLocation,
        isActiveForScrape: editIsActiveForScrape,
        isDirectoryApproved: editIsDirectoryApproved,
        notes: editNotes,
      };

      await saveCompanyDetails(payload);

      // Optimistic update
      setCompanies((prev) =>
        prev.map((item) =>
          item.name === editingCompany.name
            ? { ...item, ...payload }
            : item,
        ),
      );

      pushToast({
        message: `Saved details for ${editingCompany.name}.`,
        type: 'success',
      });

      handleCloseEdit();
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : 'Could not save company details.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleDirectoryApproval = async (comp) => {
    const nextVal = !comp.isDirectoryApproved;
    try {
      await toggleCompanyDirectoryApproval({
        name: comp.name,
        isDirectoryApproved: nextVal,
      });

      setCompanies((prev) =>
        prev.map((item) =>
          item.name === comp.name
            ? { ...item, isDirectoryApproved: nextVal }
            : item,
        ),
      );

      pushToast({
        message: nextVal
          ? `🌟 ${comp.name} approved for public directory.`
          : `${comp.name} hidden from public directory.`,
        type: 'success',
      });
    } catch {
      pushToast({
        message: 'Could not update directory approval.',
        type: 'error',
      });
    }
  };

  const handleToggleAutoScrape = async (comp) => {
    const nextVal = !comp.isActiveForScrape;
    try {
      await saveCompanyDetails({
        name: comp.name,
        website: comp.website,
        careersUrl: comp.careersUrl,
        category: comp.category,
        location: comp.location,
        isActiveForScrape: nextVal,
        isDirectoryApproved: comp.isDirectoryApproved,
        notes: comp.notes,
      });

      setCompanies((prev) =>
        prev.map((item) =>
          item.name === comp.name
            ? { ...item, isActiveForScrape: nextVal }
            : item,
        ),
      );

      pushToast({
        message: nextVal
          ? `${comp.name} added to auto-scrape.`
          : `${comp.name} removed from auto-scrape.`,
        type: 'success',
      });
    } catch {
      pushToast({
        message: 'Could not toggle auto-scrape.',
        type: 'error',
      });
    }
  };

  // Auto-detect career portal inside the Edit Modal
  const handleDetectPortalInModal = async () => {
    if (!editWebsite?.trim()) {
      pushToast({
        message: 'Enter a website URL first.',
        type: 'error',
      });
      return;
    }
    setIsDetectingPortalInModal(true);
    try {
      const res = await detectCareerPortalFromWebsite(editWebsite, editingCompany?.name);
      if (res?.careersUrl) {
        setEditCareersUrl(res.careersUrl);
        pushToast({
          message: `✨ Found career portal: ${res.careersUrl}`,
          type: 'success',
        });
      }
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : 'Could not detect career portal.',
        type: 'error',
      });
    } finally {
      setIsDetectingPortalInModal(false);
    }
  };

  // Quick single-company auto-detect & save career portal directly from card
  const handleQuickDetectCareerPortal = async (comp) => {
    if (!comp.website) {
      handleOpenEdit(comp);
      pushToast({
        message: `Add a website for ${comp.name} first.`,
        type: 'info',
      });
      return;
    }

    setDetectingPortalCompanyName(comp.name);
    try {
      const res = await detectCareerPortalFromWebsite(comp.website, comp.name);
      if (res?.careersUrl) {
        await saveCompanyDetails({
          name: comp.name,
          website: comp.website,
          careersUrl: res.careersUrl,
          category: comp.category,
          location: comp.location,
          isActiveForScrape: comp.isActiveForScrape,
          isDirectoryApproved: comp.isDirectoryApproved,
          notes: comp.notes,
        });

        setCompanies((prev) =>
          prev.map((item) =>
            item.name === comp.name ? { ...item, careersUrl: res.careersUrl } : item,
          ),
        );

        pushToast({
          message: `✨ Updated ${comp.name} careers portal: ${res.careersUrl}`,
          type: 'success',
        });
      }
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : `Could not detect career portal for ${comp.name}.`,
        type: 'error',
      });
    } finally {
      setDetectingPortalCompanyName('');
    }
  };

  // Batch auto-detect career portals for all matching companies with a website
  const handleBatchDetectCareerPortals = async () => {
    const candidates = filteredCompanies.filter((c) => Boolean(c.website));
    if (candidates.length === 0) {
      pushToast({
        message: 'No companies with websites found in the current view.',
        type: 'info',
      });
      return;
    }

    if (
      !window.confirm(
        `Visit websites and auto-detect career portals for ${candidates.length} companies?`,
      )
    ) {
      return;
    }

    setBatchDetectProgress({ current: 0, total: candidates.length, updated: 0 });

    let updated = 0;
    for (let i = 0; i < candidates.length; i++) {
      const comp = candidates[i];
      setBatchDetectProgress({ current: i + 1, total: candidates.length, updated });

      try {
        const res = await detectCareerPortalFromWebsite(comp.website, comp.name);
        if (res?.careersUrl && res.careersUrl !== comp.careersUrl) {
          await saveCompanyDetails({
            name: comp.name,
            website: comp.website,
            careersUrl: res.careersUrl,
            category: comp.category,
            location: comp.location,
            isActiveForScrape: comp.isActiveForScrape,
            isDirectoryApproved: comp.isDirectoryApproved,
            notes: comp.notes,
          });

          setCompanies((prev) =>
            prev.map((item) =>
              item.name === comp.name ? { ...item, careersUrl: res.careersUrl } : item,
            ),
          );
          updated++;
        }
      } catch {
        // Continue to next company
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    setBatchDetectProgress(null);
    pushToast({
      message: `Finished! Successfully updated ${updated} company career portal(s) from website.`,
      type: 'success',
    });
  };

  const handleCancelCompanyFetch = () => {
    fetchAbortRef.current?.abort();
  };

  const handleFetchCompanyJobs = async (comp) => {
    if (!comp.careersUrl) {
      handleOpenEdit(comp);
      pushToast({
        message: `Add a Careers Page URL for ${comp.name} first to fetch Vizag jobs.`,
        type: 'info',
      });
      return;
    }

    if (fetchingCompanyName) {
      pushToast({
        message: `Already fetching jobs for ${fetchingCompanyName}. Please wait or cancel.`,
        type: 'info',
      });
      return;
    }

    if (!session?.access_token) {
      pushToast({
        message: 'Sign in as admin to fetch and publish company jobs.',
        type: 'error',
      });
      return;
    }

    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setFetchingCompanyName(comp.name);
    setFetchProgress({
      phase: 'fetching',
      company: comp.name,
      message: `Scraping ${comp.name} careers page & extracting Vizag roles…`,
    });

    try {
      if (!existingJobsCacheRef.current) {
        try {
          existingJobsCacheRef.current = await fetchAdminPlatformJobs();
        } catch {
          existingJobsCacheRef.current = [];
        }
      }

      const classifiedResult = await fetchAndClassifyCompanyJobs({
        company: comp,
        accessToken: session.access_token,
        existingJobs: existingJobsCacheRef.current,
        signal: controller.signal,
      });

      setApprovalModalData({
        company: comp,
        initialData: classifiedResult,
      });

      if (classifiedResult.jobs.length === 0) {
        pushToast({
          message: `No active Vizag openings found on ${comp.name}'s careers page.`,
          type: 'info',
        });
      } else {
        const newCount = classifiedResult.jobs.filter((j) => !j.isDuplicate).length;
        pushToast({
          message: `Found ${classifiedResult.jobs.length} Vizag role(s) for ${comp.name} (${newCount} new). Review & approve before optimizing.`,
          type: 'success',
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        pushToast({
          message: `Cancelled job fetch for ${comp.name}.`,
          type: 'info',
        });
      } else {
        pushToast({
          message: err instanceof Error ? err.message : `Failed to fetch jobs for ${comp.name}.`,
          type: 'error',
        });
      }
    } finally {
      setFetchingCompanyName('');
      setFetchProgress(null);
      fetchAbortRef.current = null;
    }
  };

  return (
    <AdminShell
      title="Companies Directory"
      description="Explore companies discovered from job postings, manage their official website and careers page URLs, and configure auto-scraping."
    >
      <SEO
        title="Admin Companies Directory | Jobs in Vizag"
        description="Admin company directory management"
        noindex
      />

      {/* Summary KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Companies</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{stats.total}</p>
          <p className="mt-1 text-xs text-slate-500">Discovered across job postings</p>
        </div>

        <div className="rounded-3xl border border-cyan-200 bg-cyan-50/60 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-800">Public Directory</p>
          <p className="mt-2 text-3xl font-black text-cyan-950">{stats.directoryApproved}</p>
          <p className="mt-1 text-xs text-cyan-700">Approved for /companies</p>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending Approval</p>
          <p className="mt-2 text-3xl font-black text-amber-950">{stats.pendingApproval}</p>
          <p className="mt-1 text-xs text-amber-700">Hidden from public directory</p>
        </div>

        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">With Careers URL</p>
          <p className="mt-2 text-3xl font-black text-emerald-900">{stats.withCareers}</p>
          <p className="mt-1 text-xs text-emerald-600">Direct hiring portal links</p>
        </div>

        <div className="rounded-3xl border border-violet-200 bg-violet-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Weekly Auto-Scrape</p>
          <p className="mt-2 text-3xl font-black text-violet-900">{stats.autoScrape}</p>
          <p className="mt-1 text-xs text-violet-600">Active for 6:00 AM crawler</p>
        </div>
      </section>

      {/* Controls Bar: Search & Filters */}
      <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              🔍
            </span>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by company name, category, website, or location..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm font-semibold text-slate-700 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Industries ({companies.length})</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadCompanies}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
              title="Refresh company data from database"
            >
              🔄 Refresh
            </button>

            <button
              type="button"
              disabled={Boolean(batchDetectProgress)}
              onClick={handleBatchDetectCareerPortals}
              className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900 shadow-2xs transition hover:bg-cyan-100 disabled:opacity-50"
              title="Visit websites of companies and auto-discover their live career portals"
            >
              {batchDetectProgress ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-900 border-t-transparent" />
                  <span>
                    Detecting ({batchDetectProgress.current}/{batchDetectProgress.total})…
                  </span>
                </span>
              ) : (
                <span>🌐 Auto-Detect Career Portals</span>
              )}
            </button>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {[
            { id: 'ALL', label: `All Companies (${stats.total})` },
            { id: 'DIRECTORY_APPROVED', label: `🌟 Public Directory (${stats.directoryApproved})` },
            { id: 'PENDING_APPROVAL', label: `⏳ Pending Approval (${stats.pendingApproval})` },
            { id: 'HAS_CAREERS', label: `💼 Has Careers URL (${stats.withCareers})` },
            { id: 'AUTO_SCRAPE', label: `⚡ Auto-Scrape Enabled (${stats.autoScrape})` },
            { id: 'MISSING_URL', label: '⚠️ Missing Website' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                filterMode === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Active Single-Company Fetch Progress Banner */}
      {fetchingCompanyName && fetchProgress ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-emerald-300 bg-emerald-50/90 p-5 text-sm text-emerald-950 shadow-sm">
          <div className="flex items-center gap-3.5">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent"
              aria-hidden="true"
            />
            <div>
              <p className="font-extrabold text-emerald-950">
                Fetching &amp; Refining Vizag Jobs: {fetchingCompanyName}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-800">
                {fetchProgress.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelCompanyFetch}
            className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-900 shadow-2xs transition hover:bg-emerald-100"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* Error Notice */}
      {loadError ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      {/* Loading Spinner */}
      {isLoading ? (
        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <LoadingSpinner message="Aggregating companies from job database..." />
        </div>
      ) : null}

      {/* Companies List Table / Cards */}
      {!isLoading && filteredCompanies.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <p className="text-3xl">🏢</p>
          <h2 className="mt-3 text-lg font-bold text-slate-900">No companies found</h2>
          <p className="mt-1 text-sm text-slate-500">
            {searchTerm ? `No companies matching "${searchTerm}".` : 'No companies in this filter.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('ALL');
              setFilterMode('ALL');
            }}
            className="mt-4 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
          >
            Clear all filters
          </button>
        </div>
      ) : null}

      {!isLoading && filteredCompanies.length > 0 ? (
        <section className="mt-6 space-y-3" aria-label="Companies list">
          <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-500">
            <span>
              Showing {paginatedCompanies.length} of {filteredCompanies.length} companies
            </span>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <div className="space-y-3">
            {paginatedCompanies.map((comp) => {
              const gradient = getAvatarGradient(comp.name);
              const initials = getCompanyInitials(comp.name);

              return (
                <article
                  key={comp.name}
                  className="group rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left: Avatar + Names + Badges */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-sm font-black tracking-wider text-white shadow-sm`}
                        aria-hidden="true"
                      >
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-950 sm:text-lg">
                            {comp.name}
                          </h3>

                          {comp.category && comp.category !== 'General' ? (
                            <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {comp.category}
                            </span>
                          ) : null}

                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            📍 {comp.location}
                          </span>

                          {comp.isDirectoryApproved ? (
                            <span className="rounded-lg border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-[11px] font-bold text-cyan-800">
                              🌟 Public Directory
                            </span>
                          ) : null}
                        </div>

                        {/* URL Badges */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                          {comp.website ? (
                            <a
                              href={comp.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1 font-semibold text-blue-700 transition hover:bg-blue-100 hover:text-blue-900"
                              title={`Open ${comp.website}`}
                            >
                              <span>🌐 Website</span>
                              <span aria-hidden="true" className="text-[10px]">↗</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(comp)}
                              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-500 transition hover:border-slate-400 hover:text-slate-800"
                            >
                              <span>+ Add Website</span>
                            </button>
                          )}

                          {comp.careersUrl ? (
                            <a
                              href={comp.careersUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1 font-semibold text-emerald-800 transition hover:bg-emerald-100 hover:text-emerald-950"
                              title={`Open Careers Portal: ${comp.careersUrl}`}
                            >
                              <span>💼 Careers Page</span>
                              <span aria-hidden="true" className="text-[10px]">↗</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(comp)}
                              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 px-2.5 py-1 text-emerald-700 transition hover:bg-emerald-100"
                            >
                              <span>+ Add Careers URL</span>
                            </button>
                          )}

                          {comp.website ? (
                            <button
                              type="button"
                              disabled={detectingPortalCompanyName === comp.name}
                              onClick={() => handleQuickDetectCareerPortal(comp)}
                              className="inline-flex items-center gap-1 rounded-xl border border-cyan-200 bg-cyan-50/70 px-2.5 py-1 text-xs font-bold text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-50"
                              title={`Visit ${comp.website} and auto-detect live career portal`}
                            >
                              {detectingPortalCompanyName === comp.name ? (
                                <>
                                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-800 border-t-transparent" />
                                  <span>Detecting…</span>
                                </>
                              ) : (
                                <span>✨ Fetch Portal</span>
                              )}
                            </button>
                          ) : null}

                          {comp.notes ? (
                            <span className="text-[11px] text-slate-400 italic">
                              Note: {comp.notes}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Right: Job count + Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
                      {/* Job Count Button */}
                      <a
                        href={`/admin/admin-jobs?search=${encodeURIComponent(comp.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
                        title="View all jobs for this company"
                      >
                        <span>📋 {comp.totalJobs} {comp.totalJobs === 1 ? 'Job' : 'Jobs'}</span>
                        <span aria-hidden="true" className="text-slate-400">→</span>
                      </a>

                      {/* Public Directory Approval Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleDirectoryApproval(comp)}
                        className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition ${
                          comp.isDirectoryApproved
                            ? 'border border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                            : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                        title="Toggle visibility in public /companies directory"
                      >
                        <span>{comp.isDirectoryApproved ? '🌟 In Directory' : '+ Add to Directory'}</span>
                      </button>

                      {/* Auto-Scrape Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleAutoScrape(comp)}
                        className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition ${
                          comp.isActiveForScrape && comp.careersUrl
                            ? 'border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
                            : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                        title="Include in weekly 6:00 AM career scraper"
                      >
                        <span>{comp.isActiveForScrape && comp.careersUrl ? '⚡ Scraper ON' : 'Scraper OFF'}</span>
                      </button>

                      {/* Manual Fetch + Gemini SEO + Auto-Publish Button */}
                      <button
                        type="button"
                        disabled={Boolean(fetchingCompanyName) && fetchingCompanyName !== comp.name}
                        onClick={() => handleFetchCompanyJobs(comp)}
                        className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold shadow-2xs transition active:scale-95 disabled:opacity-45 ${
                          fetchingCompanyName === comp.name
                            ? 'border border-emerald-400 bg-emerald-600 text-white'
                            : comp.careersUrl
                              ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-600 hover:text-white'
                              : 'border border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-800'
                        }`}
                        title={
                          comp.careersUrl
                            ? `Fetch Vizag jobs from ${comp.careersUrl}, refine with Gemini SEO, and publish`
                            : `Add Careers URL for ${comp.name} first to fetch jobs`
                        }
                      >
                        {fetchingCompanyName === comp.name ? (
                          <>
                            <span
                              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
                              aria-hidden="true"
                            />
                            <span>
                              {fetchProgress?.phase === 'seo'
                                ? `Gemini SEO (${fetchProgress.current || 1}/${fetchProgress.total || 1})…`
                                : fetchProgress?.phase === 'publishing'
                                  ? `Publishing (${fetchProgress.current || 1}/${fetchProgress.total || 1})…`
                                  : 'Fetching…'}
                            </span>
                          </>
                        ) : (
                          <span>🚀 Fetch Jobs</span>
                        )}
                      </button>

                      {/* Edit Details Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(comp)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
                      >
                        <span>✏️ Edit URLs</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 pt-4">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                ← Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 3 + i + 1;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-11 w-11 rounded-xl text-xs font-bold transition ${
                        currentPage === pageNum
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Edit Company URLs Modal */}
      {editingCompany ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Edit Company Profile</p>
                <h2 className="mt-1 break-words text-xl font-black text-slate-950">{editingCompany.name}</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Official Website URL</label>
                <input
                  type="url"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Careers / Jobs Page URL</label>
                  {editWebsite ? (
                    <button
                      type="button"
                      disabled={isDetectingPortalInModal}
                      onClick={handleDetectPortalInModal}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700 hover:text-cyan-900 disabled:opacity-50"
                      title="Visit company website and auto-detect career portal"
                    >
                      {isDetectingPortalInModal ? (
                        <>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-700 border-t-transparent" />
                          <span>Visiting website…</span>
                        </>
                      ) : (
                        <span>✨ Fetch from Website</span>
                      )}
                    </button>
                  ) : null}
                </div>
                <input
                  type="url"
                  value={editCareersUrl}
                  onChange={(e) => setEditCareersUrl(e.target.value)}
                  placeholder="https://example.com/careers"
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">Used by the weekly automated 6:00 AM job scraper.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Industry / Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="e.g. IT, Pharma, Sales"
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Location Area</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Visakhapatnam"
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Admin Notes (optional)</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Hiring HR contact, walk-in venue..."
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="directoryApprovalCheck"
                    checked={editIsDirectoryApproved}
                    onChange={(e) => setEditIsDirectoryApproved(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <label htmlFor="directoryApprovalCheck" className="text-xs font-bold text-slate-800">
                    🌟 Show in Public &quot;Companies in Vizag&quot; Directory (/companies)
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoScrapeCheck"
                    checked={editIsActiveForScrape}
                    onChange={(e) => setEditIsActiveForScrape(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <label htmlFor="autoScrapeCheck" className="text-xs font-bold text-slate-800">
                    Include in weekly 6:00 AM careers crawler
                  </label>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-11 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Company Fetch Results Summary Modal */}
      {fetchReportModal ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          onClick={() => setFetchReportModal(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Company Career Fetch &amp; Gemini SEO Report
                </p>
                <h2 className="mt-1 break-words text-xl font-black text-slate-950">
                  {fetchReportModal.company}
                </h2>
                <a
                  href={fetchReportModal.careersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline"
                >
                  <span>{fetchReportModal.careersUrl}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
              <button
                type="button"
                onClick={() => setFetchReportModal(null)}
                className="flex h-11 w-11 shrink-0 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-center">
                <p className="text-[11px] font-bold uppercase text-slate-500">Vizag Found</p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {fetchReportModal.stats?.fetched ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-center">
                <p className="text-[11px] font-bold uppercase text-emerald-800">Published</p>
                <p className="mt-1 text-2xl font-black text-emerald-950">
                  {fetchReportModal.stats?.published ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-center">
                <p className="text-[11px] font-bold uppercase text-amber-800">Skipped</p>
                <p className="mt-1 text-2xl font-black text-amber-950">
                  {fetchReportModal.stats?.skipped ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-center">
                <p className="text-[11px] font-bold uppercase text-rose-800">Failed</p>
                <p className="mt-1 text-2xl font-black text-rose-950">
                  {(fetchReportModal.stats?.seoFailed ?? 0) +
                    (fetchReportModal.stats?.publishFailed ?? 0)}
                </p>
              </div>
            </div>

            {Array.isArray(fetchReportModal.jobs) && fetchReportModal.jobs.length > 0 ? (
              <div className="mt-5 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Processed Vizag Roles ({fetchReportModal.jobs.length})
                </p>
                <div className="space-y-2">
                  {fetchReportModal.jobs.map((item, idx) => (
                    <div
                      key={`${item.title}-${idx}`}
                      className="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{item.title}</span>
                          {item.status === 'published' ? (
                            <span className="rounded-lg border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                              ✅ Published
                            </span>
                          ) : item.status === 'skipped' ? (
                            <span className="rounded-lg border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                              ⏭️ Skipped
                            </span>
                          ) : (
                            <span className="rounded-lg border border-rose-300 bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-900">
                              ⚠️ Failed
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {item.reason}
                          {item.error ? ` — ${item.error}` : ''}
                        </p>
                      </div>

                      {item.status === 'published' && item.publishedSlug ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={`/jobs/${item.publishedSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                          >
                            View Job ↗
                          </a>
                          {item.id ? (
                            <a
                              href={`/admin/edit/${item.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                            >
                              Edit
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No active Visakhapatnam / Vizag job vacancies were listed on this careers page.
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
              <span>
                Scrape mode: {fetchReportModal.scrapeSource || 'direct_html'} (
                {fetchReportModal.scrapedChars || 0} chars)
              </span>
              <button
                type="button"
                onClick={() => setFetchReportModal(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {approvalModalData ? (
        <CompanyCareerJobApprovalModal
          isOpen={Boolean(approvalModalData)}
          company={approvalModalData.company}
          accessToken={session?.access_token}
          initialData={approvalModalData.initialData}
          onClose={() => setApprovalModalData(null)}
          onJobsPublished={(publishedList) => {
            if (Array.isArray(publishedList) && publishedList.length > 0) {
              existingJobsCacheRef.current = [
                ...publishedList,
                ...(existingJobsCacheRef.current || []),
              ];
              setCompanies((prev) =>
                prev.map((item) =>
                  item.name === approvalModalData.company?.name
                    ? {
                        ...item,
                        totalJobs: (item.totalJobs || 0) + publishedList.length,
                        publishedJobs: (item.publishedJobs || 0) + publishedList.length,
                      }
                    : item,
                ),
              );
            }
          }}
          pushToast={pushToast}
        />
      ) : null}
    </AdminShell>
  );
}
