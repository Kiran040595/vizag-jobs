import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
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

export default function AdminStudentsPage() {
  useAdminAuth();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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
    if (!deferredSearch) return students;
    return students.filter((student) => studentSearchBlob(student).includes(deferredSearch));
  }, [students, deferredSearch]);

  const summary = useMemo(() => {
    const total = students.length;
    const complete = students.filter((row) => row.profileComplete).length;
    const active = students.filter((row) => row.isActive).length;
    const freshers = students.filter((row) => row.isFresher).length;
    return { total, complete, active, freshers };
  }, [students]);

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

  return (
    <>
      <SEO title="Student registrations" noindex />
      <AdminShell
        title="Student registrations"
        description="Education and contact details from student sign-ups."
      >
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Registered', value: summary.total },
            { label: 'Profile complete', value: summary.complete },
            { label: 'Active accounts', value: summary.active },
            { label: 'Fresher flag', value: summary.freshers },
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

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, college, branch, skills…"
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
          <button
            type="button"
            onClick={loadStudents}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Refresh
          </button>
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

        {isLoading ? (
          <LoadingSpinner label="Loading student registrations…" />
        ) : filteredStudents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-lg font-semibold text-slate-900">No student registrations found</p>
            <p className="mt-2 text-sm text-slate-600">
              {searchTerm
                ? 'Try another search term.'
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
                        <dd className="mt-0.5 text-slate-800">{student.phone || 'Not provided'}</dd>
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
      </AdminShell>
    </>
  );
}
