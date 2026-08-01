import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  BILL_PAYMENT_STATUS_OPTIONS,
  BILL_STATUS_OPTIONS,
  formatBillDate,
  formatBillMoney,
} from '../lib/adminBillCatalog';
import {
  deleteAdminBill,
  fetchAdminBills,
  updateAdminBillPayment,
} from '../services/adminBills';

const statusBadgeClass = (status) => {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (status === 'cancelled') return 'bg-rose-100 text-rose-800';
  if (status === 'draft') return 'bg-slate-100 text-slate-700';
  return 'bg-cyan-100 text-cyan-900';
};

const paymentBadgeClass = (status) => {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  if (status === 'partial') return 'bg-amber-50 text-amber-800 ring-amber-200';
  return 'bg-slate-50 text-slate-700 ring-slate-200';
};

export default function AdminBillsPage() {
  useAdminAuth();
  const [bills, setBills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());

  const loadBills = useCallback(async () => {
    setLoadError('');
    setIsLoading(true);
    try {
      const rows = await fetchAdminBills();
      setBills(rows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load bills.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      if (statusFilter !== 'all' && bill.status !== statusFilter) return false;
      if (!deferredSearch) return true;
      const blob = [
        bill.billNumber,
        bill.companyName,
        bill.contactName,
        bill.contactEmail,
        bill.contactPhone,
        bill.paymentStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(deferredSearch);
    });
  }, [bills, deferredSearch, statusFilter]);

  const summary = useMemo(() => {
    const total = bills.length;
    const unpaid = bills.filter((b) => b.paymentStatus === 'unpaid').length;
    const paid = bills.filter((b) => b.paymentStatus === 'paid').length;
    const revenue = bills
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
    return { total, unpaid, paid, revenue };
  }, [bills]);

  const handleMarkPaid = async (bill) => {
    setNotice('');
    setBusyId(bill.id);
    try {
      const updated = await updateAdminBillPayment({
        billId: bill.id,
        paymentStatus: 'paid',
        paymentNotes: bill.paymentNotes,
        status: 'paid',
      });
      setBills((current) =>
        current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
      );
      setNotice(`${updated.billNumber} marked as paid.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update bill.');
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (bill) => {
    if (!window.confirm(`Delete bill ${bill.billNumber}? This cannot be undone.`)) {
      return;
    }
    setNotice('');
    setBusyId(bill.id);
    try {
      await deleteAdminBill(bill.id);
      setBills((current) => current.filter((row) => row.id !== bill.id));
      setNotice(`${bill.billNumber} deleted.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete bill.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <SEO title="Bills" noindex />
      <AdminShell
        title="Bills"
        description="Create and print bills for companies that book website job posts, Instagram reels, and related promotions."
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <span className="text-slate-500">Total</span>{' '}
              <span className="font-bold text-slate-900">{summary.total}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <span className="text-slate-500">Unpaid</span>{' '}
              <span className="font-bold text-amber-700">{summary.unpaid}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <span className="text-slate-500">Paid</span>{' '}
              <span className="font-bold text-emerald-700">{summary.paid}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <span className="text-slate-500">Billed</span>{' '}
              <span className="font-bold text-slate-900">{formatBillMoney(summary.revenue)}</span>
            </div>
          </div>
          <Link
            to="/admin/bills/new"
            className="rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
          >
            Create bill
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search company, bill no, phone…"
            className="min-w-[16rem] flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400"
          >
            <option value="all">All statuses</option>
            {BILL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {notice ? (
          <p className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            {notice}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner message="Loading bills…" />
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-800">
            <p>{loadError}</p>
            <p className="mt-2 text-rose-700">
              If this is the first time using bills, apply the{' '}
              <code className="rounded bg-rose-100 px-1">create_bills</code> Supabase migration, then
              retry.
            </p>
            <button
              type="button"
              onClick={loadBills}
              className="mt-3 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold text-rose-800"
            >
              Retry
            </button>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-lg font-bold text-slate-900">No bills yet</p>
            <p className="mt-2 text-sm text-slate-600">
              Create a bill when a company books a website job post, Instagram reel, or other service.
            </p>
            <Link
              to="/admin/bills/new"
              className="mt-5 inline-flex rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950"
            >
              Create first bill
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Bill</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill) => (
                    <tr key={bill.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">
                        {bill.billNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{bill.companyName}</p>
                        {bill.contactName ? (
                          <p className="text-xs text-slate-500">{bill.contactName}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatBillDate(bill.billDate)}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                        {formatBillMoney(bill.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadgeClass(bill.status)}`}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${paymentBadgeClass(bill.paymentStatus)}`}
                        >
                          {BILL_PAYMENT_STATUS_OPTIONS.find((o) => o.value === bill.paymentStatus)
                            ?.label || bill.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/admin/bills/${bill.id}/print`}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Print
                          </Link>
                          {bill.paymentStatus !== 'paid' ? (
                            <button
                              type="button"
                              disabled={busyId === bill.id}
                              onClick={() => handleMarkPaid(bill)}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                            >
                              Mark paid
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busyId === bill.id}
                            onClick={() => handleDelete(bill)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AdminShell>
    </>
  );
}
