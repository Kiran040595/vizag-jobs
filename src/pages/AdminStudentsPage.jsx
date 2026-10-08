import { fetchCandidateMatchingJobs } from '../services/adminJobs';
import { evaluateJobEligibility, matchesCandidateFilters } from '../lib/candidateEligibility';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import WhatsAppContactLink from '../components/WhatsAppContactLink';
import AdminShell from '../components/admin/AdminShell';
import ShareStudentDialog from '../components/admin/ShareStudentDialog';
import StudentExportDialog from '../components/admin/StudentExportDialog';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { formatJobCategoryLabel } from '../lib/studentCareerPreferences';
import { formatSkillLabel, normalizeSkillValue } from '../lib/studentProfileOptions';
import {
  fetchAdminStudentProfiles,
  formatStudentRegisteredAt,
  setStudentActiveStatus,
  studentSearchBlob,
} from '../services/adminStudents';

const upsertStudent = (students, nextStudent) => {
  const index = students.findIndex((row) => row.userId === nextStudent.userId);
  if (index === -1) {
    return [nextStudent, ...students];
  }
  const copy = [...students];
  copy[index] = { ...copy[index], ...nextStudent };
  return copy;
};

const countByValue = (students, getValues) => {
  const counts = new Map();
  for (const student of students) {
    for (const value of getValues(student)) {
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
};

const formatSalaryRange = (student) => {
  if (student.expectedSalaryMin && student.expectedSalaryMax) {
    return `₹${student.expectedSalaryMin} - ₹${student.expectedSalaryMax}`;
  }
  if (student.expectedSalaryMin) {
    return `From ₹${student.expectedSalaryMin}`;
  }
  if (student.expectedSalaryMax) {
    return `Up to ₹${student.expectedSalaryMax}`;
  }
  return 'Not provided';
};

const studentsForCategory = (students, categoryValue) =>
  students.filter((student) => student.targetJobCategories?.includes(categoryValue));

const studentsForRole = (students, roleValue) =>
  students.filter(
    (student) =>
      String(student.primaryTargetRole || '').trim().toLowerCase() ===
      String(roleValue || '').trim().toLowerCase(),
  );

export default function AdminStudentsPage() {
  useAdminAuth();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || searchParams.get('q') || '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || '');
  const [roleFilter, setRoleFilter] = useState(() => searchParams.get('role') || '');
  const [graduationYearFilter, setGraduationYearFilter] = useState(() => searchParams.get('year') || searchParams.get('batch') || '');
  const [degreeFilter, setDegreeFilter] = useState(() => searchParams.get('degree') || '');
  const [branchFilter, setBranchFilter] = useState(() => searchParams.get('branch') || '');
  const [fresherFilter, setFresherFilter] = useState(() => searchParams.get('fresher') || searchParams.get('exp') || '');
  const [skillFilter, setSkillFilter] = useState(() => searchParams.get('skill') || '');
  const [candidateFilters, setCandidateFilters] = useState({ currentCity: '', currentArea: '', educationStatus: '', willingToRelocate: '', gender: '' });
  const [matchingJobId, setMatchingJobId] = useState(() => searchParams.get('job') || '');
  const [matchingJobs, setMatchingJobs] = useState([]);
  const [matchingJobsError, setMatchingJobsError] = useState('');
  useEffect(() => { let active = true; fetchCandidateMatchingJobs().then(rows => { if (active) setMatchingJobs(rows); }).catch(error => { if (active) setMatchingJobsError(error.message); }); return () => { active = false; }; }, []);
  const [shareStudent, setShareStudent] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStudents, setExportStudents] = useState([]);
  const [exportLabel, setExportLabel] = useState('All students');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());

  const loadStudents = useCallback(async () => {
    setLoadError('');
    setIsLoading(true);
    try {
      const rows = await fetchAdminStudentProfiles();
      setStudents(rows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load students.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    candidateFilters, matchingJobId, matchingJobs,
    deferredSearch,
    categoryFilter,
    roleFilter,
    graduationYearFilter,
    degreeFilter,
    branchFilter,
    fresherFilter,
    skillFilter,
    pageSize,
  ]);

  const filteredStudents = useMemo(() => {
    const matchingJob = matchingJobs.find(job => job.id === matchingJobId);
    return students.filter((student) => {
      const matchesCandidateDetails = matchesCandidateFilters(student, candidateFilters);
      const matchesJob = !matchingJobId || (matchingJob && evaluateJobEligibility(matchingJob, student).status === 'eligible');
      const matchesSearch = !deferredSearch || studentSearchBlob(student).includes(deferredSearch);

      const matchesCategory =
        !categoryFilter || student.targetJobCategories?.includes(categoryFilter);

      const matchesRole =
        !roleFilter ||
        String(student.primaryTargetRole || '').trim().toLowerCase() ===
          String(roleFilter).trim().toLowerCase() ||
        student.interestedRoles?.some(role => role.toLowerCase() === String(roleFilter).trim().toLowerCase());

      const matchesYear =
        !graduationYearFilter ||
        String(student.graduationYear || '').trim() === String(graduationYearFilter).trim();

      const matchesDegree =
        !degreeFilter ||
        String(student.degree || '').trim().toLowerCase() ===
          String(degreeFilter).trim().toLowerCase();

      const matchesBranch =
        !branchFilter ||
        String(student.branch || '').trim().toLowerCase() ===
          String(branchFilter).trim().toLowerCase();

      const matchesFresher =
        !fresherFilter
          ? true
          : fresherFilter === 'fresher'
            ? student.isFresher === true || student.roleExperienceLevel === 'fresher'
            : fresherFilter === 'experienced'
              ? student.isFresher === false ||
                (Boolean(student.roleExperienceLevel) && student.roleExperienceLevel !== 'fresher')
              : student.roleExperienceLevel === fresherFilter;

      const matchesSkill =
        !skillFilter ||
        (Array.isArray(student.skills) &&
          student.skills.some(
            (s) => normalizeSkillValue(s) === normalizeSkillValue(skillFilter),
          ));

      return (
        matchesCandidateDetails && matchesJob &&
        matchesSearch &&
        matchesCategory &&
        matchesRole &&
        matchesYear &&
        matchesDegree &&
        matchesBranch &&
        matchesFresher &&
        matchesSkill
      );
    });
  }, [
    students,
    candidateFilters, matchingJobId, matchingJobs,
    deferredSearch,
    categoryFilter,
    roleFilter,
    graduationYearFilter,
    degreeFilter,
    branchFilter,
    fresherFilter,
    skillFilter,
  ]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredStudents.length / (Number(pageSize) || 50)));
  const paginatedStudents = useMemo(() => {
    if (pageSize === 'all') return filteredStudents;
    const size = Number(pageSize) || 50;
    const start = (currentPage - 1) * size;
    return filteredStudents.slice(start, start + size);
  }, [filteredStudents, currentPage, pageSize]);

  const summary = useMemo(() => {
    const total = students.length;
    const complete = students.filter((row) => row.profileComplete).length;
    const active = students.filter((row) => row.isActive).length;
    const freshers = students.filter((row) => row.isFresher).length;
    const withCareerPreference = students.filter(
      (row) => row.targetJobCategories?.length > 0 && row.primaryTargetRole,
    ).length;
    return { total, complete, active, freshers, withCareerPreference };
  }, [students]);

  const availabilityBreakdown = useMemo(() => {
    const activeStudents = students.filter((student) => student.isActive);
    return {
      categories: countByValue(activeStudents, (student) => student.targetJobCategories || []),
      roles: countByValue(activeStudents, (student) => [student.primaryTargetRole].filter(Boolean)),
    };
  }, [students]);

  const filterBreakdown = useMemo(() => {
    // Graduation Years: sorted descending (e.g. 2026, 2025, 2024...)
    const years = countByValue(students, (s) => (s.graduationYear ? [String(s.graduationYear)] : []))
      .sort((a, b) => Number(b.value) - Number(a.value));

    // Degrees: sorted by count descending
    const degrees = countByValue(students, (s) => (s.degree ? [s.degree] : []));

    // Branches: sorted by count descending
    const branches = countByValue(students, (s) => (s.branch ? [s.branch] : []));

    // Skills: sorted by count descending
    const rawSkills = countByValue(students, (s) =>
      Array.isArray(s.skills) ? s.skills.map(normalizeSkillValue).filter(Boolean) : [],
    );
    const skills = rawSkills.map((item) => ({
      value: item.value,
      label: formatSkillLabel(item.value),
      count: item.count,
    }));

    return { years, degrees, branches, skills };
  }, [students]);

  const openExport = (rows, label) => {
    setExportStudents(rows);
    setExportLabel(label);
    setExportOpen(true);
  };

  const handleToggleActive = async (student) => {
    setNotice('');
    setBusyUserId(student.userId);
    try {
      const updated = await setStudentActiveStatus({
        userId: student.userId,
        isActive: !student.isActive,
      });
      setStudents((current) => upsertStudent(current, updated));
      setNotice(
        updated.isActive
          ? `${updated.fullName} is active again.`
          : `${updated.fullName} is deactivated.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update student status.');
    } finally {
      setBusyUserId('');
    }
  };

  const hasActiveFilters = Boolean(
    matchingJobId || Object.values(candidateFilters).some(Boolean) ||
    searchTerm ||
    categoryFilter ||
    roleFilter ||
    graduationYearFilter ||
    degreeFilter ||
    branchFilter ||
    fresherFilter ||
    skillFilter
  );

  const clearAllFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setRoleFilter('');
    setGraduationYearFilter('');
    setDegreeFilter('');
    setBranchFilter('');
    setFresherFilter('');
    setSkillFilter('');
    setCandidateFilters({ currentCity: '', currentArea: '', educationStatus: '', willingToRelocate: '', gender: '' });
    setMatchingJobId('');
  };

  const downloadScopeLabel = useMemo(() => {
    const parts = [];
    if (graduationYearFilter) {
      parts.push(`Batch ${graduationYearFilter}`);
    }
    if (degreeFilter) {
      parts.push(degreeFilter);
    }
    if (branchFilter) {
      parts.push(branchFilter);
    }
    if (fresherFilter) {
      parts.push(
        fresherFilter === 'fresher'
          ? 'Freshers'
          : fresherFilter === 'experienced'
            ? 'Experienced'
            : `Exp: ${fresherFilter}`,
      );
    }
    if (skillFilter) {
      parts.push(`Skill: ${formatSkillLabel(skillFilter)}`);
    }
    if (categoryFilter) {
      parts.push(formatJobCategoryLabel(categoryFilter));
    }
    if (roleFilter) {
      parts.push(roleFilter);
    }
    Object.entries(candidateFilters).forEach(([field, value]) => { if (value) parts.push(`${field}: ${value}`); });
    const selectedJob = matchingJobs.find(job => job.id === matchingJobId);
    if (selectedJob) parts.push(`Matches: ${selectedJob.title}`);
    if (deferredSearch) {
      parts.push(`Search "${deferredSearch}"`);
    }
    if (parts.length > 0) {
      return parts.join(' · ');
    }
    return 'All students';
  }, [
    graduationYearFilter,
    degreeFilter,
    branchFilter,
    fresherFilter,
    skillFilter,
    categoryFilter,
    roleFilter,
    candidateFilters, matchingJobId, matchingJobs,
    deferredSearch,
  ]);

  return (
    <>
      <SEO title="Student registrations" noindex />
      <AdminShell
        title="Student registrations"
        description="Education, contact details, and career preferences from student sign-ups."
      >
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Registered', value: summary.total },
            { label: 'Profile complete', value: summary.complete },
            { label: 'Active accounts', value: summary.active },
            { label: 'Fresher flag', value: summary.freshers },
            { label: 'Career preference', value: summary.withCareerPreference },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-950">Available by job category / role</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Click a chip to filter the list, or use Download to export that group to Excel.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {availabilityBreakdown.categories.length > 0 ? (
                availabilityBreakdown.categories.slice(0, 12).map((item) => {
                  const selected = categoryFilter === item.value;
                  const label = formatJobCategoryLabel(item.value);
                  return (
                    <div key={item.value} className="inline-flex overflow-hidden rounded-full border border-cyan-200">
                      <button
                        type="button"
                        onClick={() => {
                          setRoleFilter('');
                          setCategoryFilter((current) => (current === item.value ? '' : item.value));
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold transition ${
                          selected
                            ? 'bg-cyan-500 text-white'
                            : 'bg-cyan-50 text-cyan-900 hover:bg-cyan-100'
                        }`}
                      >
                        {label}: {item.count}
                      </button>
                      <button
                        type="button"
                        title={`Download Excel for ${label}`}
                        onClick={() =>
                          openExport(
                            studentsForCategory(students.filter((row) => row.isActive), item.value),
                            label,
                          )
                        }
                        className="border-l border-cyan-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-50"
                      >
                        Excel
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No career preferences yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-950">Top target roles</h2>
            <p className="mt-1 text-xs text-slate-500">
              Primary roles students entered. Click to filter, or Excel to download that role.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {availabilityBreakdown.roles.length > 0 ? (
                availabilityBreakdown.roles.slice(0, 12).map((item) => {
                  const selected =
                    String(roleFilter || '').trim().toLowerCase() ===
                    String(item.value || '').trim().toLowerCase();
                  return (
                    <div
                      key={item.value}
                      className="inline-flex overflow-hidden rounded-full border border-indigo-200"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryFilter('');
                          setRoleFilter((current) =>
                            String(current || '').trim().toLowerCase() ===
                            String(item.value || '').trim().toLowerCase()
                              ? ''
                              : item.value,
                          );
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold transition ${
                          selected
                            ? 'bg-indigo-500 text-white'
                            : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                        }`}
                      >
                        {item.value}: {item.count}
                      </button>
                      <button
                        type="button"
                        title={`Download Excel for ${item.value}`}
                        onClick={() =>
                          openExport(
                            studentsForRole(students.filter((row) => row.isActive), item.value),
                            item.value,
                          )
                        }
                        className="border-l border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-50"
                      >
                        Excel
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No target roles yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* Filters Card */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, college, email, phone, role, category, skills…"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
              <span className="absolute left-3.5 top-3.5 text-slate-400">🔍</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadStudents}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Refresh
              </button>
              {!isLoading && students.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openExport(filteredStudents, downloadScopeLabel)}
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                  Download Excel
                  {filteredStudents.length !== students.length
                    ? ` (${filteredStudents.length})`
                    : ` (all ${students.length})`}
                </button>
              ) : null}
            </div>
          </div>

          {/* Detailed Filters Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 border-t border-slate-100 pt-3">
            {/* 1. Graduation Year / Batch */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Passout Year / Batch
              </label>
              <select
                value={graduationYearFilter}
                onChange={(e) => setGraduationYearFilter(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition ${
                  graduationYearFilter
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <option value="">All Batches</option>
                {filterBreakdown.years.map((y) => (
                  <option key={y.value} value={y.value}>
                    Batch {y.value} ({y.count})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Degree */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Degree Qualification
              </label>
              <select
                value={degreeFilter}
                onChange={(e) => setDegreeFilter(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition ${
                  degreeFilter
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <option value="">All Degrees</option>
                {filterBreakdown.degrees.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.value} ({d.count})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Branch / Stream */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Branch / Stream
              </label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition ${
                  branchFilter
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <option value="">All Branches</option>
                {filterBreakdown.branches.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.value} ({b.count})
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Fresher vs Experienced */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Fresher / Experience
              </label>
              <select
                value={fresherFilter}
                onChange={(e) => setFresherFilter(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition ${
                  fresherFilter
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <option value="">All Experience Levels</option>
                <option value="fresher">Freshers Only ({summary.freshers})</option>
                <option value="experienced">Experienced Only ({students.length - summary.freshers})</option>
                <option value="0_1">0 – 1 Year Exp</option>
                <option value="1_3">1 – 3 Years Exp</option>
                <option value="3_5">3 – 5 Years Exp</option>
                <option value="5_plus">5+ Years Exp</option>
              </select>
            </div>

            {/* 5. Key Skills */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Technical / Business Skill
              </label>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition ${
                  skillFilter
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <option value="">All Skills</option>
                {filterBreakdown.skills.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({s.count})
                  </option>
                ))}
              </select>
            </div>

            {/* 6. Job Category */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Career Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setRoleFilter('');
                  setCategoryFilter(e.target.value);
                }}
                className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition ${
                  categoryFilter
                    ? 'border-cyan-500 bg-cyan-50/70 text-cyan-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <option value="">All Categories</option>
                {availabilityBreakdown.categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {formatJobCategoryLabel(item.value)} ({item.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filter Badges */}
          <section className="my-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
            <label>Current area<input className="mt-1 w-full rounded-lg border p-2" value={candidateFilters.currentArea} onChange={e => setCandidateFilters(v => ({ ...v, currentArea: e.target.value }))} /></label>
            <label>Current city<input className="mt-1 w-full rounded-lg border p-2" value={candidateFilters.currentCity} onChange={e => setCandidateFilters(v => ({ ...v, currentCity: e.target.value }))} /></label>
            {[['educationStatus', 'Education status', [['studying', 'Studying'], ['completed', 'Completed']]], ['willingToRelocate', 'Willing to relocate', [['true', 'Yes'], ['false', 'No']]], ['gender', 'Gender (admin only)', [['female', 'Female'], ['male', 'Male'], ['other', 'Other']]]].map(([field, label, options]) => <label key={field}>{label}<select className="mt-1 w-full rounded-lg border p-2" value={candidateFilters[field]} onChange={e => setCandidateFilters(v => ({ ...v, [field]: e.target.value }))}><option value="">Any</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
            <label>Find matching candidates for a job<select className="mt-1 w-full rounded-lg border p-2" value={matchingJobId} onChange={e => setMatchingJobId(e.target.value)}><option value="">All candidates</option>{matchingJobs.filter(job => job.requirements_verified).map(job => <option key={job.id} value={job.id}>{job.title} — {job.company}</option>)}</select></label>
            {matchingJobId && <p className="text-xs text-slate-600">Shows candidates meeting all reviewed mandatory requirements. Missing information requires a profile update.</p>}
            {matchingJobsError && <p className="text-sm text-rose-700">Could not load matching jobs: {matchingJobsError}</p>}
          </section>
          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span className="font-bold text-slate-700">
                Filtered: <span className="text-indigo-600">{filteredStudents.length}</span> of {students.length} students
              </span>

              {graduationYearFilter ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">
                  Batch: {graduationYearFilter}
                  <button
                    type="button"
                    onClick={() => setGraduationYearFilter('')}
                    className="hover:text-indigo-950 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ) : null}

              {degreeFilter ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">
                  Degree: {degreeFilter}
                  <button
                    type="button"
                    onClick={() => setDegreeFilter('')}
                    className="hover:text-indigo-950 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ) : null}

              {branchFilter ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">
                  Branch: {branchFilter}
                  <button
                    type="button"
                    onClick={() => setBranchFilter('')}
                    className="hover:text-indigo-950 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ) : null}

              {fresherFilter ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">
                  Exp: {fresherFilter === 'fresher' ? 'Freshers Only' : fresherFilter === 'experienced' ? 'Experienced Only' : fresherFilter}
                  <button
                    type="button"
                    onClick={() => setFresherFilter('')}
                    className="hover:text-indigo-950 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ) : null}

              {skillFilter ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">
                  Skill: {formatSkillLabel(skillFilter)}
                  <button
                    type="button"
                    onClick={() => setSkillFilter('')}
                    className="hover:text-indigo-950 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ) : null}

              {categoryFilter ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-800">
                  Category: {formatJobCategoryLabel(categoryFilter)}
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('')}
                    className="hover:text-cyan-950 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ) : null}

              {roleFilter ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-800">
                  Role: {roleFilter}
                  <button
                    type="button"
                    onClick={() => setRoleFilter('')}
                    className="hover:text-indigo-950 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ) : null}

              {searchTerm ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-800">
                  Search: "{searchTerm}"
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="hover:text-slate-950 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ) : null}

              <button
                type="button"
                onClick={clearAllFilters}
                className="ml-auto font-bold text-rose-600 hover:text-rose-700 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : null}
        </div>

        {notice ? (
          <p className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            {notice}
          </p>
        ) : null}
        {loadError ? (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </p>
        ) : null}

        {!isLoading && filteredStudents.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p>
              Showing{' '}
              <span className="font-semibold text-slate-900">
                {pageSize === 'all' ? 1 : (currentPage - 1) * Number(pageSize) + 1}
              </span>
              {' - '}
              <span className="font-semibold text-slate-900">
                {pageSize === 'all'
                  ? filteredStudents.length
                  : Math.min(filteredStudents.length, currentPage * Number(pageSize))}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{filteredStudents.length}</span> registered students
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-500"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <LoadingSpinner label="Loading student registrations…" />
        ) : filteredStudents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-lg font-semibold text-slate-900">No student registrations found</p>
            <p className="mt-2 text-sm text-slate-600">
              {hasActiveFilters
                ? 'No students matched your active filter combination. Try clearing some filters.'
                : 'Student sign-ups at /student/register will appear here.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 shadow-sm"
              >
                <span>✕</span> Clear all filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedStudents.map((student) => (
              <article
                key={student.userId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-950">{student.fullName}</h2>
                      {!student.hasRegistrationConsents ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                          Consent pending
                        </span>
                      ) : null}
                      {!student.profileComplete ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          Profile incomplete
                        </span>
                      ) : null}
                      {student.isFresher ? (
                        <button
                          type="button"
                          onClick={() => setFresherFilter((curr) => (curr === 'fresher' ? '' : 'fresher'))}
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                            fresherFilter === 'fresher'
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                          }`}
                          title="Click to filter Freshers only"
                        >
                          Fresher
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFresherFilter((curr) => (curr === 'experienced' ? '' : 'experienced'))}
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                            fresherFilter === 'experienced'
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          }`}
                          title="Click to filter Experienced only"
                        >
                          Experienced
                        </button>
                      )}
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          student.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {student.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Registered {formatStudentRegisteredAt(student.createdAt)}
                    </p>

                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">College</dt>
                        <dd className="mt-0.5 text-slate-800">{student.college || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Degree / branch</dt>
                        <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 text-slate-800">
                          {student.degree ? (
                            <button
                              type="button"
                              onClick={() => setDegreeFilter((curr) => (curr === student.degree ? '' : student.degree))}
                              className="font-medium text-slate-900 hover:text-indigo-600 hover:underline"
                              title={`Filter candidates with degree: ${student.degree}`}
                            >
                              {student.degree}
                            </button>
                          ) : null}
                          {student.degree && student.branch ? <span className="text-slate-300">·</span> : null}
                          {student.branch ? (
                            <button
                              type="button"
                              onClick={() => setBranchFilter((curr) => (curr === student.branch ? '' : student.branch))}
                              className="font-medium text-slate-800 hover:text-indigo-600 hover:underline"
                              title={`Filter candidates with branch: ${student.branch}`}
                            >
                              {student.branch}
                            </button>
                          ) : null}
                          {!student.degree && !student.branch ? 'Not provided' : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Graduation year</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {student.graduationYear ? (
                            <button
                              type="button"
                              onClick={() => setGraduationYearFilter((curr) => (curr === String(student.graduationYear) ? '' : String(student.graduationYear)))}
                              className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                              title={`Filter Batch ${student.graduationYear}`}
                            >
                              Batch {student.graduationYear}
                            </button>
                          ) : (
                            'Not provided'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact email</dt>
                        <dd className="mt-0.5 break-all text-slate-800">
                          {student.contactEmail ? (
                            <a href={`mailto:${student.contactEmail}`} className="text-cyan-700 hover:underline">
                              {student.contactEmail}
                            </a>
                          ) : (
                            'Not provided'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
                        <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-800">
                          <span>{student.phone || 'Not provided'}</span>
                          {student.phone ? <WhatsAppContactLink phone={student.phone} /> : null}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Career preference</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {student.targetJobCategoryLabels?.length > 0
                            ? student.targetJobCategoryLabels.join(', ')
                            : 'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target role</dt>
                        <dd className="mt-0.5 text-slate-800">{student.primaryTargetRole || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role experience</dt>
                        <dd className="mt-0.5 text-slate-800">{student.roleExperienceLabel || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Availability</dt>
                        <dd className="mt-0.5 text-slate-800">{student.availabilityLabel || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected salary</dt>
                        <dd className="mt-0.5 text-slate-800">{formatSalaryRange(student)}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current location / Education status</dt><dd>{[student.currentCity, student.currentArea, student.educationStatus].filter(Boolean).join(" · ") || "Not provided"}</dd><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred locations</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {student.preferredLocations?.length > 0
                            ? student.preferredLocations.join(', ')
                            : 'Not provided'}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</dt>
                        <dd className="mt-1 flex flex-wrap gap-1.5 text-slate-800">
                          {student.skillLabels?.length > 0 ? (
                            student.skillLabels.map((lbl, idx) => {
                              const rawVal = student.skills?.[idx] || lbl.toLowerCase();
                              const isSelected =
                                skillFilter && normalizeSkillValue(skillFilter) === normalizeSkillValue(rawVal);
                              return (
                                <button
                                  key={lbl}
                                  type="button"
                                  onClick={() =>
                                    setSkillFilter((curr) =>
                                      normalizeSkillValue(curr) === normalizeSkillValue(rawVal) ? '' : rawVal,
                                    )
                                  }
                                  className={`rounded-lg border px-2 py-0.5 text-xs font-medium transition ${
                                    isSelected
                                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                      : 'border-indigo-100 bg-indigo-50/70 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100'
                                  }`}
                                  title={`Filter candidates with skill: ${lbl}`}
                                >
                                  {lbl}
                                </button>
                              );
                            })
                          ) : student.skills?.length > 0 ? (
                            student.skills.map((rawVal) => {
                              const lbl = formatSkillLabel(rawVal);
                              const isSelected =
                                skillFilter && normalizeSkillValue(skillFilter) === normalizeSkillValue(rawVal);
                              return (
                                <button
                                  key={rawVal}
                                  type="button"
                                  onClick={() =>
                                    setSkillFilter((curr) =>
                                      normalizeSkillValue(curr) === normalizeSkillValue(rawVal) ? '' : rawVal,
                                    )
                                  }
                                  className={`rounded-lg border px-2 py-0.5 text-xs font-medium transition ${
                                    isSelected
                                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                      : 'border-indigo-100 bg-indigo-50/70 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100'
                                  }`}
                                  title={`Filter candidates with skill: ${lbl}`}
                                >
                                  {lbl}
                                </button>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-400">Not provided</span>
                          )}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Certifications</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {student.certificationsText || 'Not provided'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                    <button
                      type="button"
                      onClick={() => setShareStudent(student)}
                      className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-100"
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      disabled={busyUserId === student.userId}
                      onClick={() => handleToggleActive(student)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {student.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!isLoading && totalPages > 1 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">
              Page <span className="font-bold text-slate-900">{currentPage}</span> of{' '}
              <span className="font-bold text-slate-900">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {shareStudent ? (
          <ShareStudentDialog
            key={shareStudent.userId}
            open
            student={shareStudent}
            onClose={() => setShareStudent(null)}
          />
        ) : null}

        <StudentExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          students={exportStudents}
          scopeLabel={exportLabel}
        />
      </AdminShell>
    </>
  );
}
