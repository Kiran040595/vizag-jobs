import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  employerSearchBlob,
  fetchAdminEmployerProfiles,
  formatEmployerRegisteredAt,
  setEmployerActiveStatus,
} from '../services/adminEmployers';

const upsertEmployer = (employers, nextEmployer) => {
  const index = employers.findIndex((row) => row.userId === nextEmployer.userId);
  if (index === -1) {
    return [nextEmployer, ...employers];
  }
  const copy = [...employers];
  copy[index] = { ...copy[index], ...nextEmployer };
  return copy;
};

function EmployerLogo({ url, companyName }) {
  if (!url?.trim()) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">
        {(companyName || '?').slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"
    />
  );
}

export default function AdminEmployersPage() {
  useAdminAuth();
  const [employers, setEmployers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());

  const loadEmployers = useCallback(async () => {
    setLoadError('');
    setIsLoading(true);
    try {
      const rows = await fetchAdminEmployerProfiles();
      setEmployers(rows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load employers.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployers();
  }, [loadEmployers]);

  const filteredEmployers = useMemo(() => {
    if (!deferredSearch) return employers;
    return employers.filter((employer) => employerSearchBlob(employer).includes(deferredSearch));
  }, [employers, deferredSearch]);

  const summary = useMemo(() => {
    const total = employers.length;
    const complete = employers.filter((row) => row.profileComplete).length;
    const active = employers.filter((row) => row.isActive).length;
    const withPendingJobs = employers.filter((row) => row.jobStats.pending > 0).length;
    return { total, complete, active, withPendingJobs };
  }, [employers]);

  const handleToggleActive = async (employer) => {
    setNotice('');
    setBusyUserId(employer.userId);
    try {
      const updated = await setEmployerActiveStatus({
        userId: employer.userId,
        isActive: !employer.isActive,
      });
      setEmployers((current) => upsertEmployer(current, { ...updated, jobStats: employer.jobStats }));
      setNotice(
        updated.isActive
          ? `${updated.companyName} can post jobs again.`
          : `${updated.companyName} is deactivated and cannot post new jobs.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update employer status.');
    } finally {
      setBusyUserId('');
    }
  };

  return (
    <>
      <SEO title="Employer registrations" noindex />
      <AdminShell
        title="Employer registrations"
        description="Company profiles created when employers sign up or complete their profile."
      >
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Registered', value: summary.total },
            { label: 'Profile complete', value: summary.complete },
            { label: 'Active accounts', value: summary.active },
            { label: 'With pending jobs', value: summary.withPendingJobs },
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
            placeholder="Search company, contact, email, phone…"
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
          <button
            type="button"
            onClick={loadEmployers}
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
          <LoadingSpinner label="Loading employer registrations…" />
        ) : filteredEmployers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-lg font-semibold text-slate-900">No employer registrations found</p>
            <p className="mt-2 text-sm text-slate-600">
              {searchTerm
                ? 'Try another search term.'
                : 'Employer sign-ups will appear here with company and contact details.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmployers.map((employer) => (
              <article
                key={employer.userId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <EmployerLogo url={employer.companyLogoUrl} companyName={employer.companyName} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-950">{employer.companyName}</h2>
                        {!employer.profileComplete ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            Profile incomplete
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            employer.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {employer.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Registered {formatEmployerRegisteredAt(employer.createdAt)}
                      </p>

                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Contact person
                          </dt>
                          <dd className="mt-0.5 text-slate-800">
                            {employer.contactName || 'Not provided'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Contact email
                          </dt>
                          <dd className="mt-0.5 break-all text-slate-800">
                            {employer.contactEmail ? (
                              <a
                                href={`mailto:${employer.contactEmail}`}
                                className="text-cyan-700 hover:underline"
                              >
                                {employer.contactEmail}
                              </a>
                            ) : (
                              'Not provided'
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Phone
                          </dt>
                          <dd className="mt-0.5 text-slate-800">{employer.phone || 'Not provided'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Website
                          </dt>
                          <dd className="mt-0.5 break-all text-slate-800">
                            {employer.website ? (
                              <a
                                href={employer.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-700 hover:underline"
                              >
                                {employer.website}
                              </a>
                            ) : (
                              'Not provided'
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 lg:items-end">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-900">{employer.jobStats.total}</span> jobs
                        submitted
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {employer.jobStats.pending} pending · {employer.jobStats.published} published
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {employer.jobStats.pending > 0 ? (
                        <Link
                          to={`/admin/jobs?status=pending&q=${encodeURIComponent(employer.companyName)}`}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
                        >
                          Review pending jobs
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyUserId === employer.userId}
                        onClick={() => handleToggleActive(employer)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {employer.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
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
