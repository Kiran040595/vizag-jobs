import { hasVerifiedCompanyCareers } from '../lib/companyCareerVerification';

export default function VerifiedCareersBadge({ company }) {
  if (!hasVerifiedCompanyCareers(company)) return null;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800"
      title="This careers URL has been checked for this company's Vizag vacancies."
    >
      <span aria-hidden="true">✓</span> Verified careers
    </span>
  );
}
