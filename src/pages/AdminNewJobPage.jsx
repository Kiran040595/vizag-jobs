import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import AdminShell from '../components/admin/AdminShell';
import AdminJobForm from '../components/admin/AdminJobForm';
import {
  createAdminJobs,
  createAdminJobsFromSql,
  formatJobsToSqlInsert,
} from '../services/adminJobs';
import { consumeAdminJobPrefill } from '../lib/adminNewJobPrefill';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { supabase } from '../lib/supabaseClient';
import { parseRawJobTextWithGemini } from '../services/externalJobFetch';

const SQL_EXAMPLE_SINGLE = `INSERT INTO public.jobs (
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
  apply_mode,
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
  'internal',
  NULL,
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

const SQL_EXAMPLE_MULTIPLE = `INSERT INTO public.jobs (
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
  apply_mode,
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
) VALUES 
(
  'react-frontend-developer-shvintech-india-2026-05-04',
  'React Frontend Developer',
  'Shvintech India',
  'Visakhapatnam',
  'IT/Software',
  'Full-Time',
  'Work From Office',
  '0-1 Years',
  true,
  '₹20,000 - ₹30,000/month',
  'internal',
  NULL,
  'React Frontend Developer role for freshers and junior developers at Shvintech India.',
  'Build modern, performant web applications using React, Tailwind CSS, and JavaScript.',
  '{"Develop responsive user interfaces","Collaborate with backend developers","Maintain reusable UI components"}',
  '{"B.Tech / BCA / MCA / B.Sc Computers","Knowledge of HTML, CSS, JavaScript, React"}',
  'Never pay money to apply for any job.',
  '2026-05-04T10:30:00Z',
  NULL,
  'Admin Post',
  NULL,
  '{"React","JavaScript","HTML5","CSS3","Tailwind CSS"}',
  NULL,
  'published',
  false
),
(
  'python-backend-engineer-vizag-tech-2026-05-04',
  'Python Backend Engineer',
  'Vizag Tech Labs',
  'Visakhapatnam',
  'IT/Software',
  'Full-Time',
  'Hybrid',
  '1-3 Years',
  false,
  '₹35,000 - ₹50,000/month',
  'internal',
  NULL,
  'Backend engineering role building APIs and scalable microservices in Python.',
  'Design and implement REST APIs using Python, FastAPI/Django, and PostgreSQL.',
  '{"Develop high-throughput REST APIs","Manage database schemas and migrations","Write unit and integration tests"}',
  '{"Bachelor degree in Computer Science or related field","1+ years backend experience with Python"}',
  'Never pay money to apply for any job.',
  '2026-05-04T10:30:00Z',
  NULL,
  'Admin Post',
  NULL,
  '{"Python","FastAPI","PostgreSQL","Docker","Git"}',
  NULL,
  'published',
  false
);`;

export default function AdminNewJobPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAdminAuth();
  const sqlSectionRef = useRef(null);

  // Same-tab path (legacy): values arrive already deserialized via router state.
  const prefillFromState = useMemo(() => {
    const prefill = location.state?.prefill;
    if (!prefill || typeof prefill !== 'object') return null;
    return prefill;
  }, [location.state?.prefill]);

  // New-tab path: external fetch page stashes prefill in localStorage
  const [prefillFromStorage] = useState(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('prefillKey');
    return id ? consumeAdminJobPrefill(id) : null;
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('prefillKey')) return;
    params.delete('prefillKey');
    const cleanedSearch = params.toString();
    const cleanedPath = `${location.pathname}${cleanedSearch ? `?${cleanedSearch}` : ''}`;
    navigate(cleanedPath, { replace: true, state: location.state ?? {} });
  }, [location.pathname, location.search, location.state, navigate]);

  const prefillValues = prefillFromState || prefillFromStorage || null;

  useEffect(() => {
    if (!location.state?.prefill) {
      return;
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state?.prefill, navigate]);

  // SQL Mode state
  const [sqlMode, setSqlMode] = useState('single'); // 'single' | 'multiple'
  const [sqlQuery, setSqlQuery] = useState(SQL_EXAMPLE_SINGLE);
  const [sqlNotice, setSqlNotice] = useState('');
  const [sqlError, setSqlError] = useState('');
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  // AI Paragraph / Gemini extraction state
  const [rawJobText, setRawJobText] = useState('');
  const [isParsingText, setIsParsingText] = useState(false);
  const [aiParsedJobs, setAiParsedJobs] = useState([]);
  const [aiNotice, setAiNotice] = useState('');
  const [aiError, setAiError] = useState('');
  const [isPostingAiJobs, setIsPostingAiJobs] = useState(false);

  const handleToggleSqlMode = (nextMode) => {
    setSqlMode(nextMode);
    setSqlNotice('');
    setSqlError('');
    if (nextMode === 'multiple') {
      if (!sqlQuery.trim() || sqlQuery === SQL_EXAMPLE_SINGLE) {
        setSqlQuery(SQL_EXAMPLE_MULTIPLE);
      }
    } else {
      if (!sqlQuery.trim() || sqlQuery === SQL_EXAMPLE_MULTIPLE) {
        setSqlQuery(SQL_EXAMPLE_SINGLE);
      }
    }
  };

  const handleResetSqlTemplate = () => {
    setSqlNotice('');
    setSqlError('');
    setSqlQuery(sqlMode === 'multiple' ? SQL_EXAMPLE_MULTIPLE : SQL_EXAMPLE_SINGLE);
  };

  const handleExecuteSql = async () => {
    setSqlNotice('');
    setSqlError('');
    setIsExecutingSql(true);

    try {
      const createdJobs = await createAdminJobsFromSql(sqlQuery);
      const count = createdJobs.length;
      const titles = createdJobs.map((j) => j.title).filter(Boolean).slice(0, 3).join(', ');
      const moreText = count > 3 ? ` and ${count - 3} more` : '';
      setSqlNotice(
        `Successfully created ${count} job${count === 1 ? '' : 's'} from SQL (${titles}${moreText}). All set for in-platform applications.`
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSqlError(error instanceof Error ? error.message : 'Could not execute the SQL job import.');
    } finally {
      setIsExecutingSql(false);
    }
  };

  const handleParseJobTextWithGemini = async () => {
    if (!rawJobText.trim()) {
      setAiError('Please paste a job description or vacancy paragraph first.');
      return;
    }

    setAiError('');
    setAiNotice('');
    setIsParsingText(true);

    try {
      let token = session?.access_token;
      if (!token && supabase) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
      }

      if (!token) {
        throw new Error('Your session looks invalid. Please sign out and sign back in to admin.');
      }

      const extractedJobs = await parseRawJobTextWithGemini(token, rawJobText.trim());

      if (!extractedJobs || extractedJobs.length === 0) {
        throw new Error('Gemini could not identify any job openings from the text. Try adding more role details.');
      }

      // Enforce in-platform application constraint on all admin extracted jobs
      const formattedForAdmin = extractedJobs.map((job) => ({
        ...job,
        apply_mode: 'internal',
        apply_link: null,
        source_name: 'Admin Post',
        status: 'published',
      }));

      setAiParsedJobs(formattedForAdmin);
      setAiNotice(
        `Gemini extracted ${formattedForAdmin.length} job vacancy${formattedForAdmin.length === 1 ? '' : 'ies'}. All configured for in-platform applications!`
      );
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to parse text with Gemini.');
    } finally {
      setIsParsingText(false);
    }
  };

  const handleRemoveAiJob = (indexToRemove) => {
    setAiParsedJobs((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handlePostAiJobsToWebsite = async () => {
    if (!aiParsedJobs.length) return;
    setAiError('');
    setAiNotice('');
    setIsPostingAiJobs(true);

    try {
      const created = await createAdminJobs(aiParsedJobs, 'published');
      const titles = created.map((j) => j.title).filter(Boolean).slice(0, 3).join(', ');
      const extra = created.length > 3 ? ` and ${created.length - 3} more` : '';
      setAiNotice(`Successfully posted ${created.length} in-platform job(s) (${titles}${extra}) directly to Vizag Jobs!`);
      setAiParsedJobs([]);
      setRawJobText('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not post extracted jobs to website.');
    } finally {
      setIsPostingAiJobs(false);
    }
  };

  const handleConvertAiJobsToSql = () => {
    if (!aiParsedJobs.length) return;
    const generatedSql = formatJobsToSqlInsert(aiParsedJobs);
    setSqlMode(aiParsedJobs.length > 1 ? 'multiple' : 'single');
    setSqlQuery(generatedSql);
    setSqlNotice(`Generated SQL query with ${aiParsedJobs.length} job(s). Review or execute below!`);
    sqlSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <AdminShell
      title="Create a new job"
      description="Use a dedicated page for fresh postings so the form stays isolated from the existing jobs list."
    >
      <SEO title="New Job | Vizag Jobs Admin" description="Create a new Vizag Jobs listing." canonical="/admin/new" />
      <div className="mx-auto max-w-4xl space-y-8">
        {prefillValues ? (
          <p className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            Form prefilled from an external job fetch. Review fields, then save as draft or publish.
          </p>
        ) : null}

        {/* 1. Manual Form Creation */}
        <AdminJobForm
          mode="create"
          initialValues={prefillValues || undefined}
          draftStorageKey={prefillValues ? undefined : 'vizagjobs:admin-new-job-draft'}
          onSaved={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* 2. AI Raw Text / Paragraph Parser (Gemini) */}
        <section className="rounded-[2rem] border border-cyan-100 bg-gradient-to-b from-white via-cyan-50/20 to-white p-6 shadow-xl shadow-cyan-100/50">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z" />
                  </svg>
                  Gemini AI
                </span>
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
                  Single or Multiple Jobs
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  In-Platform Apply Only
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">AI Job Description Parser</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Paste one or multiple job descriptions, HR hiring drive messages, emails, or WhatsApp forwards. Gemini will extract
                all distinct roles, companies, skills, and qualifications, and format them as in-platform admin postings.
              </p>
            </div>
            <button
              type="button"
              onClick={handleParseJobTextWithGemini}
              disabled={isParsingText || !rawJobText.trim()}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-md shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isParsingText ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-slate-950" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Analyzing with Gemini...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Convert with Gemini
                </>
              )}
            </button>
          </div>

          {aiNotice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {aiNotice}
            </div>
          ) : null}

          {aiError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {aiError}
            </div>
          ) : null}

          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Paste One or Multiple Job Descriptions / Paragraph
            </span>
            <textarea
              value={rawJobText}
              onChange={(e) => setRawJobText(e.target.value)}
              placeholder={`Paste single or multiple job descriptions here...\n\nExample with multiple jobs:\n\nJob 1: React Frontend Developer at Tech Solutions Vizag\nExperience: 0-2 years (Freshers eligible from 2024/2025/2026 batches).\nLocation: Visakhapatnam (Dwaraka Nagar).\nSalary: 2.5 LPA - 4 LPA.\nKey Skills: React, Tailwind CSS, JavaScript.\n\nJob 2: Python Backend Developer at Tech Solutions Vizag\nExperience: 1-3 years.\nLocation: Visakhapatnam.\nSalary: 4 LPA - 6 LPA.\nKey Skills: Python, FastAPI, PostgreSQL.\n\nJob 3: HR Recruiter at Coastal Talent Solutions\nExperience: 6 months - 2 years. Location: Gajuwaka, Visakhapatnam.\nSalary: ₹20,000/month. Skills: Screening, Interviewing, Sourcing.`}
              className="mt-2 min-h-[12rem] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              spellCheck={false}
            />
          </label>

          {/* AI Extracted Jobs Preview */}
          {aiParsedJobs.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-200/60 pb-3">
                <span className="text-sm font-bold text-cyan-950">
                  Extracted {aiParsedJobs.length} Job{aiParsedJobs.length === 1 ? '' : 's'} (Ready for In-Platform Apply)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConvertAiJobsToSql}
                    className="rounded-xl border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900 transition hover:bg-cyan-100"
                  >
                    Convert {aiParsedJobs.length > 1 ? `All ${aiParsedJobs.length} Jobs` : ''} to SQL Query
                  </button>
                  <button
                    type="button"
                    onClick={handlePostAiJobsToWebsite}
                    disabled={isPostingAiJobs}
                    className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {isPostingAiJobs
                      ? 'Posting...'
                      : `Post All ${aiParsedJobs.length} Job${aiParsedJobs.length === 1 ? '' : 's'} to Website (In-Platform Apply)`}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {aiParsedJobs.map((job, idx) => (
                  <div key={job.slug || idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900">
                          #{idx + 1}. {job.title}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {job.company} • {job.location || 'Visakhapatnam'} • {job.category || 'IT/Software'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          In-Platform Apply
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAiJob(idx)}
                          className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          title="Remove this job from the list"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      {job.experience ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                          Exp: {job.experience}
                        </span>
                      ) : null}
                      {job.is_fresher ? (
                        <span className="rounded-md bg-cyan-100 px-2 py-0.5 text-cyan-800 font-medium">
                          Fresher Friendly
                        </span>
                      ) : null}
                      {job.salary ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">
                          Salary: {job.salary}
                        </span>
                      ) : null}
                      {job.work_mode ? (
                        <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-indigo-800">
                          {job.work_mode}
                        </span>
                      ) : null}
                    </div>

                    {job.skills && job.skills.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        <strong className="text-slate-700">Skills:</strong> {job.skills.join(', ')}
                      </p>
                    ) : null}

                    {job.short_description ? (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{job.short_description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* 3. Quick SQL Import with Single / Multiple Jobs Toggle */}
        <section
          ref={sqlSectionRef}
          className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Quick SQL Import</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {sqlMode === 'multiple' ? 'Paste Multi-Job INSERT Query' : 'Paste Single Job INSERT Query'}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {sqlMode === 'multiple'
                  ? 'Paste an `INSERT INTO public.jobs (...) VALUES (...), (...);` query to insert multiple jobs at once.'
                  : 'Paste an `INSERT INTO public.jobs (...) VALUES (...);` query to insert a single job.'}
              </p>
            </div>

            {/* Toggle button between Single Job and Multiple Jobs */}
            <div className="flex flex-col items-end gap-2">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => handleToggleSqlMode('single')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    sqlMode === 'single'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Single Job
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSqlMode('multiple')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    sqlMode === 'multiple'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Multiple Jobs
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetSqlTemplate}
                  className="text-xs font-semibold text-slate-500 underline transition hover:text-slate-800"
                >
                  Reset to Template
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSql}
                  disabled={isExecutingSql}
                  className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isExecutingSql ? 'Executing...' : 'Execute SQL'}
                </button>
              </div>
            </div>
          </div>

          {sqlNotice ? (
            <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {sqlNotice}
            </p>
          ) : null}

          {sqlError ? (
            <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {sqlError}
            </p>
          ) : null}

          <label className="mt-5 block">
            <span className="text-sm font-semibold text-slate-700">
              SQL Query ({sqlMode === 'multiple' ? 'Multiple Jobs' : 'Single Job'})
            </span>
            <textarea
              value={sqlQuery}
              onChange={(event) => setSqlQuery(event.target.value)}
              className="mt-2 min-h-[28rem] w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-xs text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              spellCheck={false}
            />
          </label>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Supported format:{' '}
            {sqlMode === 'multiple'
              ? 'Multi-row `INSERT INTO public.jobs (...) VALUES (...), (...);` statement. All admin jobs default to in-platform applications (`apply_mode: \'internal\'`, `apply_link: NULL`).'
              : 'Single `INSERT INTO public.jobs (...) VALUES (...);` statement. Arrays can use Postgres literals like `\'{"React","JavaScript"}\'` inside single quotes.'}
          </p>
        </section>

        {/* 4. Footer link to admin jobs */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Need to review or update older posts? Open the admin jobs page.
          <button
            type="button"
            onClick={() => navigate('/admin/admin-jobs')}
            className="ml-2 font-semibold text-cyan-700 transition hover:text-cyan-600"
          >
            Go to admin jobs
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
