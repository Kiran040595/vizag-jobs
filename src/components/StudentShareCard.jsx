import { useMemo } from 'react';
import { buildStudentShareCardSnapshot } from '../lib/studentProfileShare';

export default function StudentShareCard({
  student,
  fieldIds = [],
  companyLabel = '',
  card = null,
}) {
  const snapshot = useMemo(() => {
    if (card?.fields) {
      return card;
    }
    try {
      return buildStudentShareCardSnapshot(student || {}, fieldIds);
    } catch {
      return { title: student?.fullName || 'Candidate profile', fields: [] };
    }
  }, [card, student, fieldIds]);

  const fieldsByGroup = useMemo(() => {
    const groups = new Map();
    for (const field of snapshot.fields || []) {
      const group = field.group || 'Details';
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group).push(field);
    }
    return [...groups.entries()];
  }, [snapshot.fields]);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-slate-50 px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
          Jobs in Vizag
        </p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
          {snapshot.title || 'Candidate profile'}
        </h3>
        {companyLabel ? (
          <p className="mt-1 text-sm text-slate-600">Shared for {companyLabel}</p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">Shared candidate profile card</p>
        )}
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {fieldsByGroup.length === 0 ? (
          <p className="text-sm text-slate-500">Select fields to preview the card.</p>
        ) : (
          fieldsByGroup.map(([group, fields]) => (
            <section key={group}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{group}</h4>
              <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className={
                      field.id === 'skills' ||
                      field.id === 'certifications' ||
                      field.id === 'targetJobCategories' ||
                      field.id === 'preferredLocations'
                        ? 'sm:col-span-2'
                        : ''
                    }
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {field.label}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))
        )}
      </div>
    </article>
  );
}
