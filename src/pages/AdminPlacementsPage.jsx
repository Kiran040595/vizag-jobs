import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import AdminCandidatePaymentModal from '../components/admin/AdminCandidatePaymentModal';
import { fetchAdminPlacements } from '../services/adminPlacements';
import { createResumeSignedUrl } from '../services/studentResume';

export default function AdminPlacementsPage() {
  const [placements, setPlacements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feeFilter, setFeeFilter] = useState('all'); // 'all', 'pending', 'paid'
  const [viewMode, setViewMode] = useState('table'); // 'table', 'cards'
  const [paymentPlacement, setPaymentPlacement] = useState(null);
  const [notice, setNotice] = useState('');
  const [loadingResumeId, setLoadingResumeId] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchAdminPlacements();
      setPlacements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load placements.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const total = placements.length;
    const paidList = placements.filter((p) => p.isPaid);
    const pendingList = placements.filter((p) => !p.isPaid);
    const totalCollected = paidList.reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0);

    return {
      total,
      paidCount: paidList.length,
      pendingCount: pendingList.length,
      totalCollected,
    };
  }, [placements]);

  const filteredPlacements = useMemo(() => {
    let result = placements;

    if (feeFilter === 'pending') {
      result = result.filter((p) => !p.isPaid);
    } else if (feeFilter === 'paid') {
      result = result.filter((p) => p.isPaid);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const name = (p.fullName || '').toLowerCase();
        const company = (p.company || '').toLowerCase();
        const role = (p.jobTitle || '').toLowerCase();
        const phone = (p.phone || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        return name.includes(q) || company.includes(q) || role.includes(q) || phone.includes(q) || email.includes(q);
      });
    }

    return result;
  }, [placements, feeFilter, searchQuery]);

  const handleOpenResume = async (resumePath, id) => {
    if (!resumePath) return;
    setLoadingResumeId(id);
    try {
      const url = await createResumeSignedUrl(resumePath, 604800);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else alert('Could not generate resume link.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open resume.');
    } finally {
      setLoadingResumeId(null);
    }
  };

  return (
    <>
      <SEO title="Company Placements & Hires" noindex />
      <AdminShell
        title="🎉 Company Placements & Hires"
        description="Live dashboard of candidates hired by companies across Vizag, with placement fee collection tracking."
      >
        {/* Top Summary Metrics */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Total Hired Candidates</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 shadow-2xs">
            <p className="text-xs font-bold text-amber-800">⏳ Pending Fee Collection</p>
            <p className="mt-1 text-2xl font-black text-amber-950">{summary.pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-2xs">
            <p className="text-xs font-bold text-emerald-800">💎 Paid Placements</p>
            <p className="mt-1 text-2xl font-black text-emerald-950">{summary.paidCount}</p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3.5 shadow-2xs">
            <p className="text-xs font-bold text-indigo-800">Total Fees Collected</p>
            <p className="mt-1 text-2xl font-black text-indigo-950">₹ {summary.totalCollected.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input
                type="search"
                placeholder="Search candidate name, company, job role, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-300 pl-9 pr-8 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                🔄 Refresh
              </button>

              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-pressed={viewMode === 'table'}
                  className={`rounded-lg px-3 py-1 font-bold transition ${
                    viewMode === 'table' ? 'bg-white text-indigo-950 shadow-xs border border-slate-200' : 'text-slate-600'
                  }`}
                >
                  📊 Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  aria-pressed={viewMode === 'cards'}
                  className={`rounded-lg px-3 py-1 font-bold transition ${
                    viewMode === 'cards' ? 'bg-white text-indigo-950 shadow-xs border border-slate-200' : 'text-slate-600'
                  }`}
                >
                  🗂️ Cards
                </button>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] mr-1">Fee Status:</span>
            <button
              type="button"
              onClick={() => setFeeFilter('all')}
              className={`rounded-lg px-3 py-1 font-semibold transition ${
                feeFilter === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Hires ({summary.total})
            </button>
            <button
              type="button"
              onClick={() => setFeeFilter('pending')}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                feeFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              ⏳ Pending Fee Collection ({summary.pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFeeFilter('paid')}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                feeFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              💎 Paid Placements ({summary.paidCount})
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            ⚠️ {error}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <LoadingSpinner label="Loading company placements..." />
        ) : filteredPlacements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-3xl">🎉</p>
            <h3 className="mt-2 text-base font-bold text-slate-900">No placements matching your filter</h3>
            <p className="mt-1 text-xs text-slate-500">
              {feeFilter === 'pending'
                ? 'All placed candidates have completed their placement fee payments!'
                : 'When companies change candidate status to Hired or Joined, they automatically appear here.'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[950px] text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3.5">Candidate</th>
                  <th scope="col" className="px-4 py-3.5">Hired At</th>
                  <th scope="col" className="px-4 py-3.5">Placement Date</th>
                  <th scope="col" className="px-4 py-3.5">Fee Status</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlacements.map((p) => {
                  const phoneDigits = p.phone ? p.phone.replace(/\D/g, '') : '';
                  const waGreeting = encodeURIComponent(
                    `Hello ${p.fullName}, congratulations on your placement at ${p.company} through VizagJobs!`
                  );

                  return (
                    <tr key={`${p.id}_${p.userId}`} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-bold text-slate-950">{p.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {[p.degree, p.branch, p.college].filter(Boolean).join(' · ')}
                        </div>
                        {p.phone && (
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                            <a href={`tel:${p.phone}`} className="hover:text-indigo-600">📞 {p.phone}</a>
                            <a
                              href={`https://wa.me/91${phoneDigits}?text=${waGreeting}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 font-semibold"
                            >
                              💬 WhatsApp
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-bold text-slate-900">{p.company}</div>
                        <div className="text-xs font-medium text-slate-600">{p.jobTitle}</div>
                        {p.jobLocation && <div className="text-[11px] text-slate-400">📍 {p.jobLocation}</div>}
                        {p.jobId && (
                          <Link
                            to={`/admin/jobs/${p.jobId}/applications`}
                            className="mt-1 inline-block text-[11px] text-indigo-600 hover:underline"
                          >
                            🔗 View Job Applications
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top text-xs text-slate-600">
                        {p.hiredAt ? new Date(p.hiredAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }) : 'Recent'}
                        <div className="mt-0.5">
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900">
                            {p.hiredStatus === 'joined' ? 'Joined' : 'Hired'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        {p.isPaid ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-2xs">
                              💎 Placed &amp; Paid (₹{p.paymentAmount?.toLocaleString('en-IN')})
                            </span>
                            {p.paymentDate && (
                              <div className="mt-0.5 text-[11px] text-slate-500">Paid on {p.paymentDate}</div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-900">
                              ⏳ Pending Collection
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPaymentPlacement(p)}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-950 hover:bg-amber-100 shadow-2xs"
                            title="Record or update candidate placement payment"
                          >
                            💎 {p.isPaid ? 'Edit Fee' : 'Record Fee'}
                          </button>
                          {p.studentProfile?.resume_path && (
                            <button
                              type="button"
                              disabled={loadingResumeId === p.id}
                              onClick={() => handleOpenResume(p.studentProfile.resume_path, p.id)}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              📄 Resume
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredPlacements.map((p) => {
              const phoneDigits = p.phone ? p.phone.replace(/\D/g, '') : '';
              const waGreeting = encodeURIComponent(
                `Hello ${p.fullName}, congratulations on your placement at ${p.company} through VizagJobs!`
              );

              return (
                <div key={`${p.id}_${p.userId}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-950 text-base">{p.fullName}</h3>
                      <p className="text-xs text-slate-500">{[p.degree, p.branch, p.college].filter(Boolean).join(' · ')}</p>
                    </div>
                    {p.isPaid ? (
                      <span className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-950">
                        💎 Paid ₹{p.paymentAmount?.toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-900">
                        ⏳ Pending Fee
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5 text-xs text-emerald-950 space-y-0.5">
                    <p className="font-bold">🎉 Hired at {p.company}</p>
                    <p className="text-emerald-900">{p.jobTitle}</p>
                    <p className="text-[11px] text-emerald-800">
                      Placed: {p.hiredAt ? new Date(p.hiredAt).toLocaleDateString('en-IN') : 'Recent'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    {p.phone ? (
                      <div className="flex items-center gap-2 text-xs">
                        <a href={`tel:${p.phone}`} className="font-semibold text-slate-800 hover:text-indigo-600">📞 Call</a>
                        <a href={`https://wa.me/91${phoneDigits}?text=${waGreeting}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600">💬 WhatsApp</a>
                      </div>
                    ) : <span />}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentPlacement(p)}
                        className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-100 shadow-2xs"
                      >
                        💎 {p.isPaid ? 'Edit Fee' : 'Record Fee'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Payment Modal */}
        {paymentPlacement && (
          <AdminCandidatePaymentModal
            open={Boolean(paymentPlacement)}
            onClose={() => setPaymentPlacement(null)}
            student={{
              ...paymentPlacement.studentProfile,
              userId: paymentPlacement.userId,
              fullName: paymentPlacement.fullName,
              phone: paymentPlacement.phone,
              contactEmail: paymentPlacement.email,
              isPaid: paymentPlacement.isPaid,
              paymentAmount: paymentPlacement.paymentAmount,
              paymentDate: paymentPlacement.paymentDate,
              placedCompany: paymentPlacement.placedCompany || paymentPlacement.company,
              paymentNotes: paymentPlacement.paymentNotes || `Hired for ${paymentPlacement.jobTitle}`,
            }}
            onSuccess={(updated) => {
              setPlacements((current) =>
                current.map((item) =>
                  item.userId === updated.userId
                    ? {
                        ...item,
                        isPaid: updated.isPaid,
                        paymentAmount: updated.paymentAmount,
                        paymentDate: updated.paymentDate,
                        placedCompany: updated.placedCompany,
                        paymentNotes: updated.paymentNotes,
                        studentProfile: { ...item.studentProfile, ...updated },
                      }
                    : item
                )
              );
              setNotice(
                updated.isPaid
                  ? `💎 Recorded placement fee of ₹${updated.paymentAmount?.toLocaleString('en-IN')} for ${paymentPlacement.fullName}.`
                  : `Removed placement fee record for ${paymentPlacement.fullName}.`
              );
            }}
          />
        )}
      </AdminShell>
    </>
  );
}
