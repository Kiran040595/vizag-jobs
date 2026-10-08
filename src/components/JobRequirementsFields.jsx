import { STUDENT_DEGREE_OPTIONS, STUDENT_BRANCH_OPTIONS } from '../lib/studentProfileOptions';
import { listValues } from '../lib/candidateEligibility';
const cls = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';
export default function JobRequirementsFields({ values, onChange }) {
  const multi = (name, options, label) => <fieldset><legend>{label} (leave empty for any)</legend><div className="mt-2 flex flex-wrap gap-2">{options.map(v => <label key={v} className="flex gap-1 rounded-lg border px-2 py-1 text-xs"><input type="checkbox" checked={listValues(values[name]).includes(v)} onChange={e => onChange({ target: { name, value: e.target.checked ? [...listValues(values[name]), v] : listValues(values[name]).filter(x => x !== v) } })} />{v}</label>)}</div></fieldset>;
  const text = (name, label) => <label>{label}<textarea className={cls} name={name} value={Array.isArray(values[name]) ? values[name].join('\n') : values[name] || ''} onChange={onChange} placeholder="One per line" /></label>;
  return <section className="my-5 space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
    <h2 className="font-bold">Candidate requirements</h2>
    <p className="text-sm text-slate-600">Mandatory requirements determine eligibility. Preferred skills improve ranking. Job location is separate from where a candidate currently lives.</p>
    {multi('accepted_degrees', STUDENT_DEGREE_OPTIONS, 'Accepted qualifications')}
    {multi('accepted_branches', STUDENT_BRANCH_OPTIONS, 'Accepted branches / trades')}
    <div className="grid gap-4 sm:grid-cols-2">
      <label>Education status<select className={cls} name="required_education_status" value={values.required_education_status || ''} onChange={onChange}><option value="">Any</option><option value="studying">Currently studying</option><option value="completed">Completed</option></select></label>
      <label>Experience requirement<select className={cls} name="required_experience" value={values.required_experience || ''} onChange={onChange}><option value="">Any</option><option value="fresher">Fresher</option><option value="experienced">Experienced</option></select></label>
      {text('required_skills', 'Required skills')}{text('preferred_skills', 'Preferred skills')}
      {text('required_candidate_locations', 'Required candidate cities / areas (empty means any)')}
    </div>
    <label className="flex gap-2"><input type="checkbox" name="accepts_relocation" checked={Boolean(values.accepts_relocation)} onChange={onChange} />Accept candidates willing to relocate instead of current residents</label>
    <label className="flex gap-2"><input type="checkbox" name="requirements_verified" checked={Boolean(values.requirements_verified)} onChange={onChange} />I have reviewed these structured requirements (empty selections mean any)</label>
  </section>;
}
