import { useEffect, useState } from 'react';
import { useNativeModal } from '../../hooks/useNativeModal';
import { updateStudentPlacementPayment } from '../../services/adminStudents';

export default function AdminCandidatePaymentModal({
  open,
  onClose,
  student,
  onSuccess,
}) {
  const dialogRef = useNativeModal(open);

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [placedCompany, setPlacedCompany] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const getTodayDateString = () => new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!open || !student) {
      setAmount('');
      setPaymentDate('');
      setPlacedCompany('');
      setPaymentNotes('');
      setFormError('');
      return;
    }

    setAmount(student.paymentAmount != null ? String(student.paymentAmount) : '');
    setPaymentDate(student.paymentDate || getTodayDateString());
    setPlacedCompany(student.placedCompany || '');
    setPaymentNotes(student.paymentNotes || '');
    setFormError('');
  }, [open, student]);

  if (!open || !student) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const numericAmount = parseFloat(amount);
    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      setFormError('Please enter a valid placement payment amount (₹).');
      return;
    }

    if (!paymentDate) {
      setFormError('Please select the payment date.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateStudentPlacementPayment({
        userId: student.userId,
        isPaid: true,
        paymentAmount: numericAmount,
        paymentDate,
        placedCompany: placedCompany.trim(),
        paymentNotes: paymentNotes.trim(),
      });

      onSuccess?.(updated);
      onClose?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save payment details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkUnpaid = async () => {
    if (!window.confirm(`Are you sure you want to remove the paid status for ${student.fullName || 'this candidate'}?`)) {
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const updated = await updateStudentPlacementPayment({
        userId: student.userId,
        isPaid: false,
        paymentAmount: null,
        paymentDate: null,
        placedCompany: '',
        paymentNotes: '',
      });

      onSuccess?.(updated);
      onClose?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not remove paid status.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="candidate-payment-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40"
    >
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl text-amber-800 shadow-2xs">
              💎
            </div>
            <div>
              <h2 id="candidate-payment-title" className="text-lg font-black text-slate-950">
                {student.isPaid ? 'Edit Placement Payment' : 'Record Placement Payment'}
              </h2>
              <p className="text-xs text-slate-500">
                Admin-only internal candidate fee tracking &amp; premium label
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Candidate Context Pill */}
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs text-slate-700 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm text-slate-950">{student.fullName || 'Candidate'}</span>
            {student.isPaid ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-0.5 font-bold text-amber-900">
                💎 Placed &amp; Paid
              </span>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600">
                Unpaid / Not Marked
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-500">
            {student.phone ? <span>📞 {student.phone}</span> : null}
            {student.contactEmail ? <span>✉️ {student.contactEmail}</span> : null}
            {student.degree ? <span>🎓 {student.degree}</span> : null}
            {(student.activePlacement || student.company) ? (
              <span className="font-semibold text-emerald-800">
                🎉 Hired at {student.activePlacement?.company || student.company}
                {(student.activePlacement?.jobTitle || student.jobTitle) ? ` (${student.activePlacement?.jobTitle || student.jobTitle})` : ''}
              </span>
            ) : null}
          </div>
        </div>

        {/* Error notification */}
        {formError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-900">
            ⚠️ {formError}
          </div>
        ) : null}

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="payment-amount-input" className="block text-xs font-bold text-slate-800">
              Placement Amount Paid (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-slate-500 pointer-events-none">
                ₹
              </span>
              <input
                id="payment-amount-input"
                type="number"
                min="0"
                step="1"
                required
                placeholder="e.g. 15000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-2.5 text-sm font-semibold text-slate-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            {amount && !Number.isNaN(parseFloat(amount)) ? (
              <p className="mt-1 text-[11px] font-semibold text-indigo-700">
                ₹ {Number(amount).toLocaleString('en-IN')} INR
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="payment-date-input" className="block text-xs font-bold text-slate-800">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setPaymentDate(getTodayDateString())}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                Set Today
              </button>
            </div>
            <input
              id="payment-date-input"
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="placed-company-input" className="block text-xs font-bold text-slate-800">
              Placed Company / Employer <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              id="placed-company-input"
              type="text"
              placeholder="e.g. Tech Mahindra, DMart, Infosys"
              value={placedCompany}
              onChange={(e) => setPlacedCompany(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="payment-notes-input" className="block text-xs font-bold text-slate-800">
              Reference / Transaction ID / Notes <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <textarea
              id="payment-notes-input"
              rows={2}
              placeholder="e.g. UTR / Transaction reference or installment details"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-4">
            {student.isPaid ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleMarkUnpaid}
                className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                Remove Paid Status
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-sm transition disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : student.isPaid ? 'Update Payment' : '💎 Mark as Paid'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
}
