import { Link } from 'react-router-dom';
import { evaluateJobEligibility } from '../../lib/candidateEligibility';
import { useStudentAuth } from '../../hooks/useStudentAuth';
export default function JobEligibilityNotice({ job }) {
  const { profile } = useStudentAuth();
  if (!job) return null;
  const result = evaluateJobEligibility(job, profile || {});
  return <aside className="my-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
    <p className="font-semibold">{({ eligible: 'You meet the listed requirements', ineligible: 'Some requirements do not match your profile', needs_information: 'More profile information needed', unverified: 'Eligibility not verified' })[result.status]}</p>
    {result.reasons.concat(result.missing).map(reason => <p key={reason}>{reason}</p>)}
    {result.status === 'needs_information' && <Link className="text-indigo-700 underline" to="/student/profile">Complete your profile to check eligibility</Link>}
    <p className="mt-1 text-xs text-slate-500">Review the job description before applying.</p>
  </aside>;
}
