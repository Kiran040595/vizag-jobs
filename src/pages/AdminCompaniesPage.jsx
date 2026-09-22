import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  fetchAdminCompanies,
  saveCompanyDetails,
} from '../services/adminCompanies';
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
  useAdminAuth();

  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'HAS_CAREERS' | 'MISSING_URL' | 'AUTO_SCRAPE'
  const [currentPage, setCurrentPage] = useState(1);

  // Edit Modal State
  const [editingCompany, setEditingCompany] = useState(null);
  const [editWebsite, setEditWebsite] = useState('');
  const [editCareersUrl, setEditCareersUrl] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editIsActiveForScrape, setEditIsActiveForScrape] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
    const withWebsite = companies.filter((c) => Boolean(c.website)).length;
    const withCareers = companies.filter((c) => Boolean(c.careersUrl)).length;
    const autoScrape = companies.filter((c) => c.isActiveForScrape && Boolean(c.careersUrl)).length;
    return { total, withWebsite, withCareers, autoScrape };
  }, [companies]);

  const handleOpenEdit = (comp) => {
    setEditingCompany(comp);
    setEditWebsite(comp.website || '');
    setEditCareersUrl(comp.careersUrl || '');
    setEditCategory(comp.category || 'General');
    setEditLocation(comp.location || 'Visakhapatnam');
    setEditIsActiveForScrape(Boolean(comp.isActiveForScrape));
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Companies</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{stats.total}</p>
          <p className="mt-1 text-xs text-slate-500">Discovered across all job postings</p>
        </div>

        <div className="rounded-3xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">With Website</p>
          <p className="mt-2 text-3xl font-black text-blue-900">{stats.withWebsite}</p>
          <p className="mt-1 text-xs text-blue-600">Have company domain URL</p>
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
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {[
            { id: 'ALL', label: 'All Companies' },
            { id: 'HAS_CAREERS', label: '💼 Has Careers URL' },
            { id: 'AUTO_SCRAPE', label: '⚡ Auto-Scrape Enabled' },
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
                        </div>

                        {/* URL Badges */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                          {comp.website ? (
                            <a
                              href={comp.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1 font-semibold text-blue-700 transition hover:bg-blue-100 hover:text-blue-900"
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
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1 font-semibold text-emerald-800 transition hover:bg-emerald-100 hover:text-emerald-950"
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
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
                        title="View all jobs for this company"
                      >
                        <span>📋 {comp.totalJobs} {comp.totalJobs === 1 ? 'Job' : 'Jobs'}</span>
                        <span aria-hidden="true" className="text-slate-400">→</span>
                      </a>

                      {/* Auto-Scrape Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleAutoScrape(comp)}
                        className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition ${
                          comp.isActiveForScrape && comp.careersUrl
                            ? 'border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
                            : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                        title="Include in weekly 6:00 AM career scraper"
                      >
                        <span>{comp.isActiveForScrape && comp.careersUrl ? '⚡ Scraper ON' : 'Scraper OFF'}</span>
                      </button>

                      {/* Edit Details Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(comp)}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
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
            <div className="mt-8 flex items-center justify-center gap-2 pt-4">
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
                      className={`h-9 w-9 rounded-xl text-xs font-bold transition ${
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Edit Company Profile</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{editingCompany.name}</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Careers / Jobs Page URL</label>
                <input
                  type="url"
                  value={editCareersUrl}
                  onChange={(e) => setEditCareersUrl(e.target.value)}
                  placeholder="https://example.com/careers"
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">Used by the weekly automated 6:00 AM job scraper.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Industry / Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="e.g. IT, Pharma, Sales"
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Location Area</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Visakhapatnam"
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
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
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition focus:border-cyan-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
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

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
