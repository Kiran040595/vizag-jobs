import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import WhatsAppContactLink from '../components/WhatsAppContactLink';
import AdminShell from '../components/admin/AdminShell';
import ShareStudentDialog from '../components/admin/ShareStudentDialog';
import StudentExportDialog from '../components/admin/StudentExportDialog';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { formatJobCategoryLabel } from '../lib/studentCareerPreferences';
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
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [shareStudent, setShareStudent] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStudents, setExportStudents] = useState([]);
  const [exportLabel, setExportLabel] = useState('All students');
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

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = !deferredSearch || studentSearchBlob(student).includes(deferredSearch);
      const matchesCategory =
        !categoryFilter || student.targetJobCategories?.includes(categoryFilter);
      const matchesRole =
        !roleFilter ||
        String(student.primaryTargetRole || '').trim().toLowerCase() ===
          String(roleFilter).trim().toLowerCase();
      return matchesSearch && matchesCategory && matchesRole;
    });
  }, [students, deferredSearch, categoryFilter, roleFilter]);

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

  const downloadScopeLabel = useMemo(() => {
    if (categoryFilter) {
      return formatJobCategoryLabel(categoryFilter);
    }
    if (roleFilter) {
      return roleFilter;
    }
    if (deferredSearch) {
      return 'Filtered students';
    }
    return 'All students';
  }, [categoryFilter, roleFilter, deferredSearch]);

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

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, college, role, category, skills…"
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <select
              value={categoryFilter}
              onChange={(event) => {
                setRoleFilter('');
                setCategoryFilter(event.target.value);
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="">All job categories / roles</option>
              {availabilityBreakdown.categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {formatJobCategoryLabel(item.value)} ({item.count})
                </option>
              ))}
            </select>
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
                className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Download Excel
                {filteredStudents.length !== students.length
                  ? ` (${filteredStudents.length})`
                  : ` (all ${students.length})`}
              </button>
            ) : null}
          </div>
        </div>

        {(categoryFilter || roleFilter) && (
          <p className="mb-4 text-sm text-slate-600">
            Showing{' '}
            <span className="font-semibold text-slate-900">
              {categoryFilter ? formatJobCategoryLabel(categoryFilter) : roleFilter}
            </span>{' '}
            · {filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'}{' '}
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('');
                setRoleFilter('');
              }}
              className="font-semibold text-cyan-700 hover:underline"
            >
              Clear filter
            </button>
          </p>
        )}

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

        {isLoading ? (
          <LoadingSpinner label="Loading student registrations…" />
        ) : filteredStudents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-lg font-semibold text-slate-900">No student registrations found</p>
            <p className="mt-2 text-sm text-slate-600">
              {searchTerm || categoryFilter || roleFilter
                ? 'Try another search or clear the category/role filter.'
                : 'Student sign-ups at /student/register will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStudents.map((student) => (
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
                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                          Fresher
                        </span>
                      ) : null}
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
                        <dd className="mt-0.5 text-slate-800">
                          {[student.degree, student.branch].filter(Boolean).join(' · ') || 'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Graduation year</dt>
                        <dd className="mt-0.5 text-slate-800">{student.graduationYear || 'Not provided'}</dd>
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
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred locations</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {student.preferredLocations?.length > 0
                            ? student.preferredLocations.join(', ')
                            : 'Not provided'}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {student.skillLabels?.length > 0
                            ? student.skillLabels.join(', ')
                            : student.skills.length > 0
                              ? student.skills.join(', ')
                              : 'Not provided'}
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
