import { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import {
  DIRECTORY_SECTORS,
  fetchPublicDirectoryCompanies,
} from '../services/adminCompanies';

function getMonogram(name) {
  if (!name) return 'CO';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const SECTOR_GRADIENTS = {
  it: 'from-blue-600 to-indigo-600 text-white',
  pharma: 'from-emerald-600 to-teal-600 text-white',
  education: 'from-amber-500 to-orange-600 text-white',
  banking: 'from-cyan-600 to-blue-700 text-white',
  manufacturing: 'from-purple-600 to-pink-600 text-white',
  hospitality: 'from-rose-500 to-red-600 text-white',
};

function CompanyDirectoryCard({ company }) {
  const monogram = getMonogram(company.name);
  const gradientClass = SECTOR_GRADIENTS[company.sectorId] || 'from-slate-700 to-slate-900 text-white';

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-md">
      <div>
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-sm shadow-sm ${gradientClass}`}
          >
            {monogram}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold text-slate-900 text-base group-hover:text-cyan-700 transition-colors">
                {company.name}
              </h3>
              <span className="shrink-0 text-cyan-600" title="Verified Vizag Employer">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                <span>{company.sectorIcon}</span>
                <span>{company.sectorLabel}</span>
              </span>

              <span className="inline-flex items-center text-xs text-slate-500">
                <svg className="mr-1 h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {company.location}
              </span>
            </div>
          </div>
        </div>

        {company.activeJobsCount > 0 ? (
          <Link
            to={`/jobs?company=${encodeURIComponent(company.name)}`}
            className="group/jobs mt-3.5 flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-100/90"
            title={`View all ${company.activeJobsCount} live openings at ${company.name}`}
          >
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>{company.activeJobsCount} live opening{company.activeJobsCount > 1 ? 's' : ''} in Vizag</span>
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 transition-transform group-hover/jobs:translate-x-0.5">
              <span>View jobs</span>
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ) : null}
      </div>

      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
        {company.website ? (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            Website
          </a>
        ) : (
          <span className="text-slate-400">Website not listed</span>
        )}

        {company.careersUrl ? (
          <a
            href={company.careersUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-2.5 py-1.5 font-semibold text-cyan-700 transition hover:bg-cyan-100 hover:text-cyan-800"
          >
            <span>Careers Portal</span>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function CompaniesInVizagPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSector, setSelectedSector] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);

  useEffect(() => {
    let isMounted = true;
    fetchPublicDirectoryCompanies()
      .then((data) => {
        if (isMounted) {
          setCompanies(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load public directory companies:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute sector counts
  const sectorCounts = useMemo(() => {
    const counts = { all: companies.length };
    for (const s of DIRECTORY_SECTORS) {
      if (s.id !== 'all') {
        counts[s.id] = companies.filter((c) => c.sectorId === s.id).length;
      }
    }
    return counts;
  }, [companies]);

  // Filter companies
  const filteredCompanies = useMemo(() => {
    let result = companies;

    // Filter by sector tab
    if (selectedSector !== 'all') {
      result = result.filter((c) => c.sectorId === selectedSector);
    }

    // Filter by search query
    const q = deferredSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.sectorLabel.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q)
      );
    }

    return result;
  }, [companies, selectedSector, deferredSearch]);

  // Group by sector if "all" is selected and no search
  const isGrouping = selectedSector === 'all' && !deferredSearch.trim();

  const groupedBySector = useMemo(() => {
    if (!isGrouping) return [];
    return DIRECTORY_SECTORS.filter((s) => s.id !== 'all')
      .map((sector) => {
        const sectorCompanies = companies.filter((c) => c.sectorId === sector.id);
        return {
          ...sector,
          companies: sectorCompanies,
        };
      })
      .filter((group) => group.companies.length > 0);
  }, [isGrouping, companies]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <SEO
        title="Top Companies in Visakhapatnam (Vizag) | IT, Pharma, Banking & Hospitals"
        description="Explore verified top employers in Visakhapatnam. Discover premier IT hubs in Rushikonda, Pharma giants in Parawada SEZ, hospitals, universities, and official careers pages."
        canonical="/companies"
      />
      <Navbar />

      <main className="flex-1 pb-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-cyan-900 via-slate-900 to-slate-900 px-4 py-12 text-white sm:px-6 sm:py-16">
          <div className="mx-auto max-w-5xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/60 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300 backdrop-blur-sm">
              <span>🏢</span> Visakhapatnam Corporate Directory
            </span>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Top Companies & Employers in{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
                Visakhapatnam
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
              Discover verified premier employers across Rushikonda IT SEZ, Parawada Pharma City, hospitals, banks, and major institutions in Vizag.
            </p>

            {/* Search Bar */}
            <div className="mx-auto mt-8 max-w-xl">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by company name, sector, or keyword..."
                  className="w-full rounded-2xl border-0 bg-white/95 py-3.5 pl-11 pr-10 text-sm text-slate-900 shadow-xl ring-1 ring-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 sm:text-base"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Sector Tabs Navigation */}
        <div className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex gap-2 overflow-x-auto py-3 scrollbar-none">
              {DIRECTORY_SECTORS.map((sector) => {
                const isSelected = selectedSector === sector.id;
                const count = sectorCounts[sector.id] || 0;

                return (
                  <button
                    key={sector.id}
                    type="button"
                    onClick={() => setSelectedSector(sector.id)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm ${
                      isSelected
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    <span>{sector.icon}</span>
                    <span>{sector.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-xs ${
                        isSelected ? 'bg-cyan-700/60 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Directory Content Area */}
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyan-600 border-r-transparent"></div>
              <p className="mt-3 text-sm text-slate-500">Loading verified Vizag employers...</p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <span className="text-4xl">🔍</span>
              <h3 className="mt-3 text-base font-semibold text-slate-900">No companies found</h3>
              <p className="mt-1 text-sm text-slate-500">
                No verified employers match &quot;{searchQuery}&quot; in this sector.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSector('all');
                }}
                className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-700"
              >
                Reset Filters
              </button>
            </div>
          ) : isGrouping ? (
            /* Grouped Sector Sections View */
            <div className="space-y-12">
              {groupedBySector.map((group) => (
                <section key={group.id} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{group.icon}</span>
                      <h2 className="text-xl font-bold text-slate-900">{group.label}</h2>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {group.companies.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSector(group.id)}
                      className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
                    >
                      View all in {group.label} →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.companies.map((company) => (
                      <CompanyDirectoryCard key={company.id || company.name} company={company} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            /* Flat Grid View (when filtered by sector or search) */
            <div>
              <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {filteredCompanies.length} company
                  {filteredCompanies.length > 1 ? 'ies' : ''}
                </span>
                {selectedSector !== 'all' || searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedSector('all');
                    }}
                    className="font-medium text-cyan-600 hover:underline"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCompanies.map((company) => (
                  <CompanyDirectoryCard key={company.id || company.name} company={company} />
                ))}
              </div>
            </div>
          )}

          {/* Employer Callout Banner */}
          <div className="mt-16 rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-500/10 via-white to-teal-500/10 p-6 sm:p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
              Are you an employer or HR representative hiring in Visakhapatnam?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              Get your company featured in the Visakhapatnam Corporate Directory and connect with pre-screened local graduates and experienced candidates.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                to="/employer/register"
                className="rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-700"
              >
                Register as Employer →
              </Link>
              <Link
                to="/employer/jobs/new"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Post a Job in Vizag
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
