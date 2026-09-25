import StudentAuthRequiredAlert from './StudentAuthRequiredAlert';

export default function StudentAuthRequiredShell({
  returnPath,
  jobTitle = '',
  jobCompany = '',
  intent = 'view',
  source = 'job_gate',
  apply = false,
  headline = 'Sign in to continue',
  description = 'Create a free student account or sign in to view this job and apply.',
}) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 11V7a4 4 0 1 1 8 0v4" strokeLinecap="round" />
            <rect x="4" y="11" width="16" height="10" rx="2" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-black text-slate-950">{headline}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        {jobTitle ? (
          <p className="mt-4 text-sm font-semibold text-slate-900">
            {jobTitle}
            {jobCompany ? ` · ${jobCompany}` : ''}
          </p>
        ) : null}
      </div>

      <StudentAuthRequiredAlert
        returnPath={returnPath}
        jobTitle={jobTitle}
        jobCompany={jobCompany}
        intent={intent}
        source={source}
        apply={apply}
      />
    </div>
  );
}
