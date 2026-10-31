import { useEffect, useState } from 'react';
import { fetchNotificationAnalyticsData } from '../../services/adminNotificationAnalytics';

const ranges = [
  ['24h', 'Last 24 hours'],
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['1y', 'Last 1 year'],
];

export default function AdminGrowthAnalytics() {
  const [range, setRange] = useState('24h');
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchNotificationAnalyticsData().then(setData).catch(() => setData(null));
  }, []);

  const selected = data?.stats?.timeRangeAnalytics?.find((item) => item.id === range);
  const cards = [
    ['Push subscribers', selected?.pushSubscribers, 'text-cyan-700'],
    ['Student registrations', selected?.studentRegistrations, 'text-indigo-700'],
    ['Employer registrations', selected?.employerRegistrations, 'text-emerald-700'],
    ['Employer submissions', selected?.employerSubmissions, 'text-amber-700'],
  ];

  return (
    <section className="mb-6 rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Admin overview</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Growth analytics</h2>
          <p className="mt-1 text-sm text-slate-600">New activity during the selected period. Push counts are browser/device subscriptions.</p>
        </div>
        <select aria-label="Analytics period" value={range} onChange={(event) => setRange(event.target.value)} className="min-h-11 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100">
          {ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-white/80 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-black ${color}`}>{value == null ? '…' : value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500">{selected?.label || 'Loading…'}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
