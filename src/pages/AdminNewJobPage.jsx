import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import AdminShell from '../components/admin/AdminShell';
import AdminJobForm from '../components/admin/AdminJobForm';
import { createAdminJobFromSql } from '../services/adminJobs';

const SQL_EXAMPLE = `INSERT INTO public.jobs (
  slug,
  title,
  company,
  location,
  category,
  job_type,
  work_mode,
  experience,
  is_fresher,
  salary,
  apply_link,
  short_description,
  description,
  responsibilities,
  eligibility,
  warning,
  posted_at,
  expires_at,
  source_name,
  source_url,
  skills,
  company_logo_url,
  status,
  is_featured
) VALUES (
  'java-full-stack-developer-fresher-shvintech-india-2026-05-04',
  'Java Full Stack Developer - Fresher',
  'Shvintech India',
  'Visakhapatnam',
  'IT/Software',
  'Full-Time',
  'Work From Office',
  '0 Years',
  true,
  'Not Disclosed',
  'https://example.com/apply',
  'Java Full Stack Developer role for freshers at Shvintech India.',
  'Develop backend applications using Java and build frontend interfaces using modern web technologies.',
  '{"Develop backend applications using Core and Advanced Java","Build frontend interfaces using HTML, CSS, and JavaScript","Work with SQL and MongoDB databases"}',
  '{"B.Tech (CSE/IT)","BCA","Good English communication skills"}',
  'Never pay money to apply for any job.',
  '2026-05-04T10:30:00Z',
  NULL,
  'Admin Post',
  NULL,
  '{"Core Java","Spring Boot","ReactJS","SQL","MongoDB"}',
  NULL,
  'published',
  false
);`;

export default function AdminNewJobPage() {
  const navigate = useNavigate();
  const [sqlQuery, setSqlQuery] = useState(SQL_EXAMPLE);
  const [sqlNotice, setSqlNotice] = useState('');
  const [sqlError, setSqlError] = useState('');
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  const handleExecuteSql = async () => {
    setSqlNotice('');
    setSqlError('');
    setIsExecutingSql(true);

    try {
      const savedJob = await createAdminJobFromSql(sqlQuery);
      setSqlNotice(`Job created from SQL as ${savedJob.status}.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSqlError(error instanceof Error ? error.message : 'Could not execute the SQL job import.');
    } finally {
      setIsExecutingSql(false);
    }
  };

  return (
    <AdminShell
      title="Create a new job"
      description="Use a dedicated page for fresh postings so the form stays isolated from the existing jobs list."
    >
      <SEO title="New Job | Vizag Jobs Admin" description="Create a new Vizag Jobs listing." canonical="/admin/new" />
      <div className="mx-auto max-w-4xl">
        <AdminJobForm
          mode="create"
          draftStorageKey="vizagjobs:admin-new-job-draft"
          onSaved={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Quick SQL import</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Paste one job INSERT query</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Paste a single `INSERT INTO public.jobs (...) VALUES (...)` query here. The app will parse the job data
                and post it using your admin access.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExecuteSql}
              disabled={isExecutingSql}
              className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExecutingSql ? 'Executing...' : 'Execute SQL'}
            </button>
          </div>

          {sqlNotice ? (
            <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{sqlNotice}</p>
          ) : null}

          {sqlError ? (
            <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{sqlError}</p>
          ) : null}

          <label className="mt-5 block">
            <span className="text-sm font-semibold text-slate-700">SQL query</span>
            <textarea
              value={sqlQuery}
              onChange={(event) => setSqlQuery(event.target.value)}
              className="mt-2 min-h-[28rem] w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              spellCheck={false}
            />
          </label>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Supported format: one `INSERT INTO public.jobs (...) VALUES (...)` statement for a single job. Arrays can
            use Postgres literals like `{'{'}
            "React","JavaScript"
            {'}'}` inside single quotes.
          </p>
        </section>
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Need to review or update older posts? Open the existing jobs page.
          <button
            type="button"
            onClick={() => navigate('/admin/jobs')}
            className="ml-2 font-semibold text-cyan-700 transition hover:text-cyan-600"
          >
            Go to existing jobs
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
