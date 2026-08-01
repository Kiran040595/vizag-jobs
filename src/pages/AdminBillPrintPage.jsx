import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminBillDocument from '../components/admin/AdminBillDocument';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { fetchAdminBillById } from '../services/adminBills';

export default function AdminBillPrintPage() {
  useAdminAuth();
  const { billId } = useParams();
  const [bill, setBill] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBill = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const row = await fetchAdminBillById(billId);
      setBill(row);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load bill.');
    } finally {
      setIsLoading(false);
    }
  }, [billId]);

  useEffect(() => {
    loadBill();
  }, [loadBill]);

  useEffect(() => {
    if (!bill) return undefined;
    const previousTitle = document.title;
    document.title = `Bill ${bill.billNumber} | JobsInVizag`;
    return () => {
      document.title = previousTitle;
    };
  }, [bill]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <SEO title={bill ? `Bill ${bill.billNumber}` : 'Print bill'} noindex />

      <div className="print:hidden min-h-screen bg-slate-100">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/bills"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Bills
            </Link>
            <Link
              to="/admin/bills/new"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              New bill
            </Link>
          </div>
          {bill ? (
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400"
            >
              Print / Save PDF
            </button>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 print:max-w-none print:px-0 print:py-0">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner message="Loading bill…" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-800">
            <p>{error}</p>
            <button
              type="button"
              onClick={loadBill}
              className="mt-3 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <AdminBillDocument bill={bill} />
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            margin: 12mm;
          }
        }
      `}</style>
    </>
  );
}
