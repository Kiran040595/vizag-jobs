import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import CandidateFinderFilters, { CandidateSelect } from '../components/admin/CandidateFinderFilters';
import CandidateSearchCard from '../components/admin/CandidateSearchCard';
import CandidateTableView from '../components/admin/CandidateTableView';
import ShareStudentDialog from '../components/admin/ShareStudentDialog';
import StudentExportDialog from '../components/admin/StudentExportDialog';
import { fetchAdminStudentProfiles, setStudentActiveStatus } from '../services/adminStudents';
import { fetchCandidateMatchingJobs } from '../services/adminJobs';
import { formatJobCategoryLabel } from '../lib/studentCareerPreferences';
import { formatSkillLabel } from '../lib/studentProfileOptions';
import { countStudentRoles } from '../lib/studentRoles';
import {
  EMPTY_CANDIDATE_FILTERS, candidateFilterLabels, candidateMissingFacts, candidateSkillKey,
  findAdminCandidates, readCandidateFilters, writeCandidateFilters,
} from '../lib/adminCandidateSearch';

const countOptions = (students, getValues) => {
  const counts = new Map();
  for (const student of students) for (const value of new Set(getValues(student).filter(Boolean))) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
};

export default function AdminStudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Inputs update immediately; router transitions must not temporarily undo a checked choice.
  const [filters, setFilters] = useState(() => readCandidateFilters(searchParams));
  const filtersRef = useRef(filters);
  const outgoingSearches = useRef(new Set());
  const deferredFilters = useDeferredValue(filters);
  const [students, setStudents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [jobsError, setJobsError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [shortlist, setShortlist] = useState(() => new Set());
  const [shareStudent, setShareStudent] = useState(null);
  const [exportScope, setExportScope] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewMode, setViewMode] = useState('cards');
  const updateFilters = patch => {
    const next = { ...filtersRef.current, ...patch };
    filtersRef.current = next;
    setFilters(next);
    setCurrentPage(1);
    const encoded = writeCandidateFilters(next).toString();
    outgoingSearches.current.add(encoded);
    setSearchParams(encoded, { replace: true });
  };
  const resetFilters = () => updateFilters({ ...EMPTY_CANDIDATE_FILTERS, skills: [], degrees: [] });
  useEffect(() => {
    const encoded = searchParams.toString();
    if (outgoingSearches.current.has(encoded)) {
      outgoingSearches.current.delete(encoded);
      return;
    }
    const next = readCandidateFilters(searchParams);
    filtersRef.current = next;
    setFilters(next);
    setCurrentPage(1);
  }, [searchParams]);
  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try { setStudents(await fetchAdminStudentProfiles()); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load candidates.'); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => {
    let active = true;
    fetchCandidateMatchingJobs().then(rows => { if (active) setJobs(rows); })
      .catch(error => { if (active) setJobsError(error.message); });
    return () => { active = false; };
  }, []);

  const selectedJob = jobs.find(job => job.id === deferredFilters.job);
  const result = useMemo(() => findAdminCandidates(students, deferredFilters, selectedJob), [students, deferredFilters, selectedJob]);
  const filteredStudents = useMemo(() => result.entries.map(entry => entry.student), [result]);
  const filteredIds = useMemo(() => new Set(filteredStudents.map(student => student.userId)), [filteredStudents]);
  const pageCount = Math.max(1, Math.ceil(result.entries.length / pageSize));
  const page = Math.min(currentPage, pageCount);
  const visibleEntries = result.entries.slice((page - 1) * pageSize, page * pageSize);
  const selectedStudents = useMemo(() => students.filter(student => shortlist.has(student.userId)), [students, shortlist]);
  const selectedOutsideFilters = selectedStudents.filter(student => !filteredIds.has(student.userId)).length;
  const canExport = !isLoading && !loadError && filters === deferredFilters;
  const summary = useMemo(() => ({
    total: students.length,
    active: students.filter(student => student.isActive).length,
    missing: students.filter(student => candidateMissingFacts(student).length > 0).length,
  }), [students]);
  const options = useMemo(() => {
    const scoped = filters.accountStatus === 'all' ? students : students.filter(student => filters.accountStatus === 'active' ? student.isActive : !student.isActive);
    return {
      roles: countStudentRoles(scoped).map(item => ({ ...item, label: `${item.value} (${item.count})` })),
      categories: countOptions(scoped, student => student.targetJobCategories || []).map(item => ({ ...item, label: `${formatJobCategoryLabel(item.value)} (${item.count})` })),
      skills: countOptions(scoped, student => (student.skills || []).map(candidateSkillKey)).map(item => ({ ...item, label: formatSkillLabel(item.value) })),
      degrees: countOptions(scoped, student => [student.degree]),
      branches: countOptions(scoped, student => [student.branch]).map(item => ({ ...item, label: `${item.value} (${item.count})` })),
      years: countOptions(scoped, student => [student.graduationYear ? String(student.graduationYear) : '']).sort((a, b) => Number(b.value) - Number(a.value)).map(item => ({ ...item, label: `Batch ${item.value} (${item.count})` })),
      locations: countOptions(scoped, student => student.preferredLocations || []).map(item => ({ ...item, label: `${item.value} (${item.count})` })),
    };
  }, [students, filters.accountStatus]);
  const criteriaLabels = candidateFilterLabels(deferredFilters);
  if (selectedJob) criteriaLabels.push(`Job: ${selectedJob.title}`);
  const exportLabel = criteriaLabels.length ? criteriaLabels.join(' · ') : 'Active student candidates';

  const toggleShortlist = userId => setShortlist(current => {
    const next = new Set(current);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    return next;
  });
  const toggleSkill = skill => {
    const key = candidateSkillKey(skill);
    updateFilters({ skills: filters.skills.some(value => candidateSkillKey(value) === key)
      ? filters.skills.filter(value => candidateSkillKey(value) !== key) : [...filters.skills, key].slice(0, 16) });
  };
  const toggleActive = async student => {
    setBusyUserId(student.userId);
    setNotice('');
    try {
      const saved = await setStudentActiveStatus({ userId: student.userId, isActive: !student.isActive });
      setStudents(current => current.map(row => row.userId === saved.userId ? saved : row));
      setNotice(saved.isActive ? 'Candidate account activated.' : 'Candidate account deactivated.');
    } catch (error) { setNotice(error.message || 'Could not update candidate.'); }
    finally { setBusyUserId(''); }
  };

  return <>
    <SEO title="Student candidate finder" noindex />
    <AdminShell title="Student candidate finder" description="Find students by the skills, qualifications and roles that matter for your vacancy.">
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Registered students', summary.total], ['Active accounts', summary.active], ['Matching your criteria', result.entries.length]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>)}
        <button type="button" onClick={() => updateFilters({ dataStatus: filters.dataStatus === 'missing' ? '' : 'missing', accountStatus: 'all' })} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left" aria-pressed={filters.dataStatus === 'missing'}><span className="block text-xs font-semibold text-amber-900">Missing matching details</span><span className="mt-1 block text-2xl font-black text-amber-950">{summary.missing}</span></button>
      </div>
      <CandidateFinderFilters filters={filters} onChange={updateFilters} {...options} jobs={jobs} jobCounts={result.jobCounts} onClear={resetFilters} />
      {jobsError && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Reviewed jobs could not load: {jobsError}. You can still search using skills and qualifications.</p>}

      <details className="mb-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-700">Browse popular desired roles and career sectors</summary>
        <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">
          <div><h2 className="mb-2 text-sm font-bold">Popular desired roles</h2><div className="flex flex-wrap gap-2">{options.roles.slice(0, 12).map(item => <button key={item.value} type="button" onClick={() => updateFilters({ role: item.value })} className="min-h-11 max-w-full rounded-xl border px-3 py-2 text-left text-sm [overflow-wrap:anywhere]">{item.label}</button>)}</div></div>
          <div><h2 className="mb-2 text-sm font-bold">Career sectors</h2><div className="flex flex-wrap gap-2">{options.categories.slice(0, 12).map(item => <button key={item.value} type="button" onClick={() => updateFilters({ category: item.value })} className="min-h-11 max-w-full rounded-xl border px-3 py-2 text-left text-sm [overflow-wrap:anywhere]">{item.label}</button>)}</div></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Group counts follow the selected account status. The candidate list also applies your other criteria. Export the resulting list below.</p>
      </details>

      <section aria-label="Candidate search results" aria-busy={isLoading || filters !== deferredFilters} className="min-w-0">
        <div className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" aria-live="polite" className="font-bold text-slate-950">{isLoading ? 'Loading candidates…' : `${result.entries.length} matching candidates`}</p>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={loadStudents} className="min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold">Refresh data</button><button type="button" disabled={isLoading || filters !== deferredFilters || Boolean(loadError) || !filteredStudents.length} onClick={() => setExportScope({ students: filteredStudents, label: exportLabel })} className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Export matching ({filteredStudents.length})</button></div>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <CandidateSelect label="Account status" value={filters.accountStatus} onChange={accountStatus => updateFilters({ accountStatus })} emptyLabel={null} options={[{ value: 'active', label: 'Active accounts' }, { value: 'all', label: 'All accounts' }, { value: 'inactive', label: 'Deactivated accounts' }]} />
            <CandidateSelect label="Sort candidates" value={filters.sort} onChange={sort => updateFilters({ sort })} emptyLabel={null} options={[{ value: 'relevance', label: 'Most matching selected / preferred skills' }, { value: 'newest', label: 'Newest registration' }, { value: 'oldest', label: 'Oldest registration' }, { value: 'name', label: 'Name A–Z' }]} />
            <CandidateSelect label="Candidates per page" value={String(pageSize)} onChange={value => { setPageSize(Number(value) || 25); setCurrentPage(1); }} emptyLabel={null} options={['25', '50', '100']} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                aria-pressed={viewMode === 'cards'}
                className={`min-h-9 rounded-lg px-3 py-1 font-bold transition ${
                  viewMode === 'cards'
                    ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🗂️ Cards View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
                className={`min-h-9 rounded-lg px-3 py-1 font-bold transition ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 Recruiter Table View
              </button>
            </div>
            {criteriaLabels.length > 0 && <p className="text-xs text-slate-600 [overflow-wrap:anywhere]">Applied: {criteriaLabels.join(' · ')}</p>}
          </div>
          <p className="text-xs text-slate-500">Only recorded facts are matched. Skills/qualifications aid discovery; they do not guarantee suitability. Demographic information is excluded from matching and sorting.</p>
        </div>

        {selectedStudents.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <div>
              <p className="text-sm font-bold text-indigo-950">Shortlist: {selectedStudents.length} candidates (this visit)</p>
              {selectedOutsideFilters > 0 && <p className="text-xs text-indigo-800">{selectedOutsideFilters} shortlisted candidates are outside the current filters. Shortlist export includes them.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!canExport} onClick={() => setExportScope({ students: selectedStudents, label: 'Selected candidate shortlist' })} className="min-h-11 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Export shortlist ({selectedStudents.length})</button>
              <button type="button" onClick={() => setShortlist(new Set())} className="min-h-11 rounded-xl border border-indigo-200 px-3 py-2 text-sm font-semibold">Clear shortlist</button>
            </div>
          </div>
        )}

        {notice && <p role="status" className="mb-4 rounded-xl border p-3 text-sm">{notice}</p>}
        {loadError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{loadError} Results may be out of date. Refresh data before exporting.</p>}
        {isLoading ? <LoadingSpinner label="Loading student registrations…" /> : !result.entries.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center"><h2 className="text-lg font-bold">No candidates match all current requirements</h2><p className="mt-2 text-sm text-slate-600">Try “Any selected skill”, fewer qualifications, or a broader desired role. Missing profile information never counts as a match.</p><button type="button" onClick={resetFilters} className="mt-4 min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold">Reset filters</button></div> : <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, result.entries.length)} of {result.entries.length}</p><button type="button" onClick={() => setShortlist(current => new Set([...current, ...visibleEntries.map(entry => entry.student.userId)]))} className="min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold">Shortlist this page ({visibleEntries.length})</button></div>
          {viewMode === 'table' ? (
            <CandidateTableView
              visibleEntries={visibleEntries}
              filters={deferredFilters}
              shortlist={shortlist}
              onToggleShortlist={toggleShortlist}
              onSkill={toggleSkill}
              onShare={setShareStudent}
              onToggleActive={toggleActive}
              busyUserId={busyUserId}
            />
          ) : (
            <div className="space-y-3">{visibleEntries.map(entry => <CandidateSearchCard key={entry.student.userId} entry={entry} filters={deferredFilters} selected={shortlist.has(entry.student.userId)} onSelect={() => toggleShortlist(entry.student.userId)} onSkill={toggleSkill} onShare={() => setShareStudent(entry.student)} onToggleActive={() => toggleActive(entry.student)} busy={busyUserId === entry.student.userId} />)}</div>
          )}
          {pageCount > 1 && <nav aria-label="Candidate result pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3"><span className="text-sm">Page {page} of {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setCurrentPage(page - 1)} className="min-h-11 rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setCurrentPage(page + 1)} className="min-h-11 rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Next</button></div></nav>}
        </>}
      </section>
      {shareStudent && <ShareStudentDialog key={shareStudent.userId} open student={shareStudent} onClose={() => setShareStudent(null)} />}
      <StudentExportDialog open={Boolean(exportScope)} onClose={() => setExportScope(null)} students={exportScope?.students || []} scopeLabel={exportScope?.label || ''} />
    </AdminShell>
  </>;
}
