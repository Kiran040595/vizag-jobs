import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  BILL_PAYMENT_STATUS_OPTIONS,
  BILL_SERVICE_CATALOG,
  BILL_STATUS_OPTIONS,
  computeBillTotals,
  computeLineAmount,
  createEmptyLineItem,
  formatBillMoney,
  getServiceCatalogItem,
  todayIsoDate,
} from '../lib/adminBillCatalog';
import { fetchAdminEmployerProfiles } from '../services/adminEmployers';
import { createAdminBill } from '../services/adminBills';

const emptyForm = () => ({
  companyName: '',
  employerUserId: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  companyAddress: '',
  companyGstin: '',
  billDate: todayIsoDate(),
  dueDate: '',
  status: 'issued',
  paymentStatus: 'unpaid',
  taxPercent: '0',
  notes: '',
  paymentNotes: '',
  lineItems: [createEmptyLineItem('website_job_post'), createEmptyLineItem('instagram_reel')],
});

export default function AdminNewBillPage() {
  useAdminAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(() => {
    const initial = emptyForm();
    return {
      ...initial,
      companyName: searchParams.get('company') || '',
      employerUserId: searchParams.get('employer') || '',
      contactEmail: searchParams.get('email') || '',
      contactPhone: searchParams.get('phone') || '',
      contactName: searchParams.get('contact') || '',
    };
  });
  const [employers, setEmployers] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadEmployers = useCallback(async () => {
    try {
      const rows = await fetchAdminEmployerProfiles();
      setEmployers(rows.filter((row) => row.profileComplete));
    } catch {
      setEmployers([]);
    }
  }, []);

  useEffect(() => {
    void loadEmployers();
  }, [loadEmployers]);

  const totals = useMemo(
    () => computeBillTotals(form.lineItems, form.taxPercent),
    [form.lineItems, form.taxPercent],
  );

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleEmployerSelect = (userId) => {
    if (!userId) {
      updateField('employerUserId', '');
      return;
    }
    const employer = employers.find((row) => row.userId === userId);
    if (!employer) {
      updateField('employerUserId', userId);
      return;
    }
    setForm((current) => ({
      ...current,
      employerUserId: employer.userId,
      companyName: employer.companyName || current.companyName,
      contactName: employer.contactName || current.contactName,
      contactEmail: employer.contactEmail || current.contactEmail,
      contactPhone: employer.phone || current.contactPhone,
    }));
  };

  const updateLineItem = (itemId, patch) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    }));
  };

  const handleServiceChange = (itemId, serviceKey) => {
    const catalog = getServiceCatalogItem(serviceKey);
    updateLineItem(itemId, {
      serviceKey: catalog.key,
      description: catalog.description || catalog.label,
      unitPrice: catalog.defaultUnitPrice,
    });
  };

  const addLineItem = (serviceKey = 'custom') => {
    setForm((current) => ({
      ...current,
      lineItems: [...current.lineItems, createEmptyLineItem(serviceKey)],
    }));
  };

  const removeLineItem = (itemId) => {
    setForm((current) => ({
      ...current,
      lineItems:
        current.lineItems.length <= 1
          ? current.lineItems
          : current.lineItems.filter((item) => item.id !== itemId),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);

    try {
      const bill = await createAdminBill({
        companyName: form.companyName,
        employerUserId: form.employerUserId || null,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        companyAddress: form.companyAddress,
        companyGstin: form.companyGstin,
        billDate: form.billDate,
        dueDate: form.dueDate || null,
        status: form.status,
        paymentStatus: form.paymentStatus,
        taxPercent: Number(form.taxPercent) || 0,
        notes: form.notes,
        paymentNotes: form.paymentNotes,
        lineItems: form.lineItems,
      });
      navigate(`/admin/bills/${bill.id}/print`, { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create bill.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SEO title="Create bill" noindex />
      <AdminShell
        title="Create bill"
        description="Bill a company for website job posts, Instagram reels, featured listings, or custom services."
      >
        <div className="mb-5">
          <Link
            to="/admin/bills"
            className="text-sm font-semibold text-cyan-700 hover:text-cyan-800"
          >
            ← Back to bills
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <section className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Registered employer (optional)</span>
              <select
                value={form.employerUserId}
                onChange={(event) => handleEmployerSelect(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="">Walk-in / not registered — enter details below</option>
                {employers.map((employer) => (
                  <option key={employer.userId} value={employer.userId}>
                    {employer.companyName}
                    {employer.contactEmail ? ` (${employer.contactEmail})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Company name *</span>
              <input
                required
                value={form.companyName}
                onChange={(event) => updateField('companyName', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="Acme Pvt Ltd"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Contact name</span>
              <input
                value={form.contactName}
                onChange={(event) => updateField('contactName', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Phone</span>
              <input
                value={form.contactPhone}
                onChange={(event) => updateField('contactPhone', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) => updateField('contactEmail', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Company GSTIN</span>
              <input
                value={form.companyGstin}
                onChange={(event) => updateField('companyGstin', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Company address</span>
              <textarea
                rows={2}
                value={form.companyAddress}
                onChange={(event) => updateField('companyAddress', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Bill date *</span>
              <input
                required
                type="date"
                value={form.billDate}
                onChange={(event) => updateField('billDate', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Due date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => updateField('dueDate', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                {BILL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Payment</span>
              <select
                value={form.paymentStatus}
                onChange={(event) => updateField('paymentStatus', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                {BILL_PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900">Services</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => addLineItem('website_job_post')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  + Job post
                </button>
                <button
                  type="button"
                  onClick={() => addLineItem('instagram_reel')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  + Instagram reel
                </button>
                <button
                  type="button"
                  onClick={() => addLineItem('custom')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  + Custom
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {form.lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Line {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      disabled={form.lineItems.length <= 1}
                      className="text-xs font-semibold text-rose-700 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-sm sm:col-span-2 lg:col-span-2">
                      <span className="font-medium text-slate-700">Service</span>
                      <select
                        value={item.serviceKey}
                        onChange={(event) => handleServiceChange(item.id, event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
                      >
                        {BILL_SERVICE_CATALOG.map((service) => (
                          <option key={service.key} value={service.key}>
                            {service.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-slate-700">Qty</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) =>
                          updateLineItem(item.id, { quantity: event.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-slate-700">Rate (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateLineItem(item.id, { unitPrice: event.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2 lg:col-span-3">
                      <span className="font-medium text-slate-700">Description</span>
                      <input
                        value={item.description}
                        onChange={(event) =>
                          updateLineItem(item.id, { description: event.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
                        placeholder="What was delivered for this company"
                      />
                    </label>
                    <div className="flex items-end text-sm">
                      <div className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                        <span className="text-slate-500">Amount </span>
                        <span className="font-bold tabular-nums text-slate-900">
                          {formatBillMoney(computeLineAmount(item.quantity, item.unitPrice))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Tax / GST %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.taxPercent}
                onChange={(event) => updateField('taxPercent', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold tabular-nums">{formatBillMoney(totals.subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between gap-4">
                <span className="text-slate-600">Tax</span>
                <span className="font-semibold tabular-nums">{formatBillMoney(totals.taxAmount)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4 border-t border-slate-200 pt-2 text-base">
                <span className="font-bold text-slate-900">Total</span>
                <span className="font-black tabular-nums text-slate-950">
                  {formatBillMoney(totals.totalAmount)}
                </span>
              </div>
            </div>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Notes (shown on bill)</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="Payment terms, job title reference, reel delivery date…"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Internal payment notes</span>
              <textarea
                rows={2}
                value={form.paymentNotes}
                onChange={(event) => updateField('paymentNotes', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="UPI reference, bank transfer details…"
              />
            </label>
          </section>

          {formError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save & print bill'}
            </button>
            <Link
              to="/admin/bills"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </AdminShell>
    </>
  );
}
