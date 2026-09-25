import {
  formatBillDate,
  formatBillMoney,
  getServiceCatalogItem,
} from '../../lib/adminBillCatalog';
import {
  SITE_CONTACT_EMAIL,
  SITE_LEGAL_NAME,
  SITE_LOCATION_DISPLAY,
  SITE_PUBLISHER_NAME,
} from '../../lib/siteLegal';

const statusLabel = (status) => {
  if (status === 'paid') return 'PAID';
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'draft') return 'DRAFT';
  return 'ISSUED';
};

export default function AdminBillDocument({ bill }) {
  if (!bill) return null;

  return (
    <article className="bill-document mx-auto w-full max-w-3xl bg-white text-slate-900">
      <header className="border-b-2 border-slate-900 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Tax Invoice / Bill
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {SITE_LEGAL_NAME}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{SITE_PUBLISHER_NAME}</p>
            <p className="text-sm text-slate-600">{SITE_LOCATION_DISPLAY}</p>
            <p className="text-sm text-slate-600">{SITE_CONTACT_EMAIL}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill no.</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-950">{bill.billNumber}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{statusLabel(bill.status)}</p>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill to</p>
          <p className="mt-2 text-lg font-bold text-slate-950">{bill.companyName}</p>
          {bill.contactName ? <p className="mt-1 text-sm text-slate-700">{bill.contactName}</p> : null}
          {bill.companyAddress ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{bill.companyAddress}</p>
          ) : null}
          {bill.contactEmail ? <p className="mt-1 text-sm text-slate-700">{bill.contactEmail}</p> : null}
          {bill.contactPhone ? <p className="mt-1 text-sm text-slate-700">{bill.contactPhone}</p> : null}
          {bill.companyGstin ? (
            <p className="mt-1 text-sm text-slate-700">GSTIN: {bill.companyGstin}</p>
          ) : null}
        </div>
        <div className="sm:text-right">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 sm:justify-end">
              <dt className="font-semibold text-slate-500">Bill date</dt>
              <dd className="font-medium text-slate-900">{formatBillDate(bill.billDate)}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:justify-end">
              <dt className="font-semibold text-slate-500">Due date</dt>
              <dd className="font-medium text-slate-900">
                {bill.dueDate ? formatBillDate(bill.dueDate) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:justify-end">
              <dt className="font-semibold text-slate-500">Payment</dt>
              <dd className="font-medium capitalize text-slate-900">{bill.paymentStatus}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border border-slate-300">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-3 font-semibold">#</th>
              <th className="px-3 py-3 font-semibold">Service</th>
              <th className="px-3 py-3 text-right font-semibold">Qty</th>
              <th className="px-3 py-3 text-right font-semibold">Rate</th>
              <th className="px-3 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(bill.lineItems || []).map((item, index) => {
              const catalog = getServiceCatalogItem(item.serviceKey);
              return (
                <tr key={item.id || index} className="border-t border-slate-200">
                  <td className="px-3 py-3 align-top text-slate-500">{index + 1}</td>
                  <td className="px-3 py-3 align-top">
                    <p className="font-semibold text-slate-900">{catalog.label}</p>
                    <p className="mt-0.5 text-slate-600">{item.description}</p>
                  </td>
                  <td className="px-3 py-3 align-top text-right tabular-nums text-slate-800">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-3 align-top text-right tabular-nums text-slate-800">
                    {formatBillMoney(item.unitPrice)}
                  </td>
                  <td className="px-3 py-3 align-top text-right tabular-nums font-semibold text-slate-900">
                    {formatBillMoney(item.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-6 flex justify-end">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="tabular-nums font-medium text-slate-900">
              {formatBillMoney(bill.subtotal)}
            </dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-slate-600">
              Tax{bill.taxPercent ? ` (${bill.taxPercent}%)` : ''}
            </dt>
            <dd className="tabular-nums font-medium text-slate-900">
              {formatBillMoney(bill.taxAmount)}
            </dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-slate-300 pt-2 text-base">
            <dt className="font-bold text-slate-950">Total</dt>
            <dd className="tabular-nums font-black text-slate-950">
              {formatBillMoney(bill.totalAmount)}
            </dd>
          </div>
        </dl>
      </section>

      {bill.notes ? (
        <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{bill.notes}</p>
        </section>
      ) : null}

      {bill.paymentNotes ? (
        <section className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{bill.paymentNotes}</p>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
        <p>
          Thank you for partnering with {SITE_LEGAL_NAME}. Services may include website job posts,
          Instagram reel promotions, featured listings, and related marketing.
        </p>
        <p className="mt-2">This is a computer-generated bill.</p>
      </footer>
    </article>
  );
}
