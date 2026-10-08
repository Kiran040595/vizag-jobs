import { EDUCATION_STATUSES, GENDER_OPTIONS, listValues } from '../../lib/candidateEligibility';

const INPUT_CLASS = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';

export default function CandidateDetailsFields({ form, onChange, section = 'all', roles = [] }) {
  const changeField = (name, value) => onChange({ target: { name, value } });
  const show = (name) => section === 'all' || section === name;

  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      {show('personal') && <>
        <label>
          Current city
          <input className={INPUT_CLASS} name="current_city" maxLength={64}
            value={form.current_city || ''} onChange={onChange} placeholder="Where you currently live" />
        </label>
        <label>
          Current area / locality
          <input className={INPUT_CLASS} name="current_area" maxLength={64}
            value={form.current_area || ''} onChange={onChange} placeholder="e.g. Gajuwaka" />
        </label>
        <label>
          Gender (optional)
          <select aria-label="Gender (optional)" className={INPUT_CLASS} name="gender"
            value={form.gender || ''} onChange={onChange}>
            <option value="">Not provided</option>
            {GENDER_OPTIONS.map(value => (
              <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
            ))}
          </select>
          <small className="block text-slate-500">Visible to you and authorized admins. Not shared in candidate exports.</small>
        </label>
      </>}
      {show('education') && (
        <label>
          Education status
          <select aria-label="Education status" className={INPUT_CLASS} name="education_status"
            value={form.education_status || ''} onChange={onChange}>
            <option value="">Select status</option>
            {EDUCATION_STATUSES.map(value => (
              <option key={value} value={value}>{value === 'studying' ? 'Currently studying' : 'Completed'}</option>
            ))}
          </select>
        </label>
      )}
      {show('career') && <>
        <label>
          Willing to relocate?
          <select aria-label="Willing to relocate?" className={INPUT_CLASS}
            value={form.willing_to_relocate == null ? '' : String(form.willing_to_relocate)}
            onChange={event => changeField('willing_to_relocate', event.target.value === '' ? null : event.target.value === 'true')}>
            <option value="">Not specified</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <label>
            Interested job roles (one per line, up to 16)
            <textarea aria-label="Interested job roles" className={INPUT_CLASS}
              value={Array.isArray(form.interested_roles) ? form.interested_roles.join('\n') : form.interested_roles || ''}
              onChange={event => changeField('interested_roles', event.target.value)}
              placeholder={'Software Developer\nQA Tester'} />
          </label>
          <small className="block text-slate-500">Specific roles, separate from your sectors. Your primary target role is also used for matching.</small>
          <div className="mt-2 flex flex-wrap gap-2">
            {roles.slice(0, 12).map(role => {
              const label = role.role || role.label;
              const selected = listValues(form.interested_roles).includes(label);
              return (
                <button key={label} type="button" aria-pressed={selected}
                  className={`rounded-full border px-2 py-1 text-xs ${selected ? 'border-indigo-500 bg-indigo-50' : ''}`}
                  onClick={() => changeField('interested_roles', selected
                    ? listValues(form.interested_roles).filter(value => value !== label)
                    : [...listValues(form.interested_roles), label].slice(0, 16))}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </>}
    </div>
  );
}
