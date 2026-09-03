import { useMemo, useState } from 'react';
import SEO from '../components/SEO';
import AdminShell from '../components/admin/AdminShell';
import AdminBillDocument from '../components/admin/AdminBillDocument';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  BILL_SERVICE_CATALOG,
  computeBillTotals,
  computeLineAmount,
  createEmptyLineItem,
  formatBillMoney,
  getServiceCatalogItem,
  todayIsoDate,
} from '../lib/adminBillCatalog';

const buildBillNumber = () => {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const timePart = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('');
  return `VJ-${datePart}-${timePart}`;
};

const emptyForm = () => ({
  billNumber: buildBillNumber(),
  companyName: '',
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

export default function AdminBillsPage() {
  useAdminAuth();
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const totals = useMemo(
    () => computeBillTotals(form.lineItems, form.taxPercent),
    [form.lineItems, form.taxPercent],
  );

  const billPreview = useMemo(() => {
    const taxPercent = Number(form.taxPercent) || 0;
    const lineItems = form.lineItems.map((item, index) => {
      const catalog = getServiceCatalogItem(item.serviceKey);
      return {
        id: item.id,
        serviceKey: item.serviceKey,
        description: String(item.description || catalog.description || catalog.label || '').trim(),
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        amount: computeLineAmount(item.quantity, item.unitPrice),
        sortOrder: index,
      };
    });

    return {
      billNumber: String(form.billNumber || '').trim() || buildBillNumber(),
      companyName: String(form.companyName || '').trim() || 'Company name',
      contactName: String(form.contactName || '').trim(),
      contactEmail: String(form.contactEmail || '').trim(),
      contactPhone: String(form.contactPhone || '').trim(),
      companyAddress: String(form.companyAddress || '').trim(),
      companyGstin: String(form.companyGstin || '').trim(),
      billDate: form.billDate,
      dueDate: form.dueDate || null,
      status: form.status || 'issued',
      paymentStatus: form.paymentStatus || 'unpaid',
      notes: String(form.notes || '').trim(),
      paymentNotes: String(form.paymentNotes || '').trim(),
      taxPercent,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      lineItems,
    };
  }, [form, totals]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
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

  const handlePrint = () => {
    setFormError('');
    const companyName = String(form.companyName || '').trim();
    if (companyName.length < 2) {
      setFormError('Enter the company name before printing.');
      return;
    }
    if (!form.lineItems.some((item) => String(item.description || '').trim().length >= 2)) {
      setFormError('Add at least one service with a description.');
      return;
    }
    window.print();
  };

  const handleReset = () => {
    setFormError('');
    setForm(emptyForm());
  };

  return (
    <>
      <SEO title="Print bill" noindex />
      <div className="print:hidden">
        <AdminShell
          title="Print bill"
          description="Type the company and service details, then print or save as PDF. Nothing is saved to the database."
        >
          <div className="mb-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear form
            </button>
          </div>

          {formError ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {formError}
            </p>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              handlePrint();
            }}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Bill number</span>
                <input
                  value={form.billNumber}
                  onChange={(event) => updateField('billNumber', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Bill date</span>
                <input
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
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
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
                      <label className="block text-sm sm:col-span-2">
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
                  placeholder="Payment terms, job title, reel delivery date…"
                />
              </label>
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear form
              </button>
            </div>
          </form>

          <section className="mt-8">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Bill preview</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <AdminBillDocument bill={billPreview} />
            </div>
          </section>
        </AdminShell>
      </div>

      <div className="hidden print:block">
        <AdminBillDocument bill={billPreview} />
      </div>

      <style>{`
        @media print {
          body {
            background: white !important;
          }
          @page {
            margin: 12mm;
          }
        }
      `}</style>
    </>
  );
}
