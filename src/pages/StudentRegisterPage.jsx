import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import StudentProfileFields, { EMPTY_STUDENT_PROFILE_FORM } from '../components/student/StudentProfileFields';
import StudentRegistrationConsent from '../components/student/StudentRegistrationConsent';
import StudentSkillMatchNotice from '../components/student/StudentSkillMatchNotice';
import { EMPTY_STUDENT_CONSENTS, validateStudentConsents } from '../lib/studentConsent';
import { useStudentAuth } from '../hooks/useStudentAuth';
import {
  buildInternalApplyPath,
  buildStudentAuthPath,
  consumePendingApplyJobId,
  consumePendingApplyUrl,
  openExternalApplyLink,
  readPendingApplyJobMeta,
  resolvePostAuthDestination,
  shouldAutoApplyAfterAuth,
} from '../lib/studentApplyRedirect';
import { markStudentAuthSuccess } from '../lib/studentAuthSuccess';
import { trackStudentFunnel } from '../lib/studentFunnelAnalytics';
import { validateStudentProfilePayload } from '../lib/studentProfileValidation';

const INPUT_CLASS =
  'mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

export default function StudentRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoading, isStudent, isSupabaseConfigured, profileComplete, session, signUp } =
    useStudentAuth();
  const [form, setForm] = useState(EMPTY_STUDENT_PROFILE_FORM);
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consents, setConsents] = useState(EMPTY_STUDENT_CONSENTS);

  const returnPath = resolvePostAuthDestination(searchParams, { profileComplete });
  const nextPath = searchParams.get('next') || '';
  const isJobDetailsReturn =
    Boolean(nextPath) &&
    !shouldAutoApplyAfterAuth(searchParams) &&
    (/^\/jobs\//.test(nextPath) || /^\/job\//.test(nextPath));
  const isApplyReturn = shouldAutoApplyAfterAuth(searchParams) && Boolean(nextPath);
  const loginPath = `/student/login${buildStudentAuthPath({
    pathname: searchParams.get('next') || undefined,
    apply: shouldAutoApplyAfterAuth(searchParams),
  })}`;
  const registerQuery = buildStudentAuthPath({
    pathname: searchParams.get('next') || undefined,
    apply: shouldAutoApplyAfterAuth(searchParams),
  });

  const completePostAuthNavigation = () => {
    markStudentAuthSuccess({
      apply: shouldAutoApplyAfterAuth(searchParams),
      type: 'register',
    });
    trackStudentFunnel('student_auth_success', {
      type: 'register',
      apply: shouldAutoApplyAfterAuth(searchParams),
    });

    const destination = resolvePostAuthDestination(searchParams, { profileComplete });
    const pendingJobId = consumePendingApplyJobId();
    if (pendingJobId && profileComplete) {
      navigate(buildInternalApplyPath(pendingJobId, searchParams.get('next') || ''), { replace: true });
      return;
    }
    const pendingApply = consumePendingApplyUrl();
    if (pendingApply && profileComplete) {
      const meta = readPendingApplyJobMeta();
      openExternalApplyLink(pendingApply, { jobTitle: meta?.title || '' });
    }
    navigate(destination, { replace: true });
  };

  useEffect(() => {
    if (!session || !isStudent || isLoading) {
      return;
    }
    completePostAuthNavigation();
  }, [isLoading, isStudent, navigate, profileComplete, searchParams, session]);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-2xl font-black">Supabase is not configured.</h1>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8">
          <LoadingSpinner message="Loading..." />
        </div>
      </div>
    );
  }

  if (session && isStudent) {
    return <Navigate to={returnPath} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleFresherChange = (value) => {
    setForm((current) => ({
      ...current,
      is_fresher: value === 'yes',
    }));
  };

  const toggleSkill = (skillValue) => {
    setForm((current) => {
      const selected = new Set(current.skills);
      if (selected.has(skillValue)) {
        selected.delete(skillValue);
      } else {
        selected.add(skillValue);
      }
      return { ...current, skills: [...selected] };
    });
  };

  const toggleTargetCategory = (categoryValue) => {
    setForm((current) => {
      const selected = new Set(current.target_job_categories);
      if (selected.has(categoryValue)) {
        selected.delete(categoryValue);
      } else {
        selected.add(categoryValue);
      }
      return { ...current, target_job_categories: [...selected] };
    });
  };

  const togglePreferredLocation = (locationValue) => {
    setForm((current) => {
      const selected = new Set(current.preferred_locations);
      if (selected.has(locationValue)) {
        selected.delete(locationValue);
      } else {
        selected.add(locationValue);
      }
      return { ...current, preferred_locations: [...selected] };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    try {
      validateStudentConsents(consents);
      const profilePayload = {
        ...form,
        contact_email: form.contact_email || undefined,
      };
      validateStudentProfilePayload(profilePayload);

      const postAuthPath = resolvePostAuthDestination(searchParams, { profileComplete: true });
      const result = await signUp({
        email: form.contact_email,
        phone: form.phone,
        password,
        profile: profilePayload,
        consents,
        returnPath: postAuthPath,
      });
      if (result?.session) {
        return;
      }
      throw new Error('Account created but sign-in did not complete. Try signing in.');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,_#eef2ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <SEO
        title="Student register | Vizag Jobs"
        description={
          isApplyReturn
            ? 'Create a free student account with your full profile to apply for the job you selected in Vizag.'
            : isJobDetailsReturn
              ? 'Create a free student account with your full profile to view full job details in Vizag.'
              : 'Create a complete student account to apply for fresher jobs in Vizag.'
        }
        canonical={`/student/register${registerQuery}`}
      />
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <h1 className="text-3xl font-black text-slate-950">Create student account</h1>
        <p className="mt-3 text-sm text-slate-600">
          {isApplyReturn
            ? 'Fill in your full profile below — after sign-in you will return to the job so you can apply.'
            : shouldAutoApplyAfterAuth(searchParams)
              ? 'Fill in your full profile below — you will be signed in automatically and returned to the job you selected.'
              : isJobDetailsReturn
                ? 'Fill in your full profile below — you will be signed in automatically and returned to the full job details.'
                : 'Complete your education, career preferences, and skills now so you can apply to jobs right away.'}
        </p>

        {isApplyReturn ? (
          <p className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            You started applying for a job. Create your complete account below and we will bring you
            back to it.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <StudentProfileFields
            form={form}
            onChange={handleChange}
            onFresherChange={handleFresherChange}
            onToggleSkill={toggleSkill}
            onToggleTargetCategory={toggleTargetCategory}
            onTogglePreferredLocation={togglePreferredLocation}
            includeContactEmail={false}
            idPrefix="student-register"
          />

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email *</span>
            <input
              type="email"
              name="contact_email"
              value={form.contact_email}
              onChange={handleChange}
              required
              autoComplete="email"
              placeholder="you@college.edu"
              className={INPUT_CLASS}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password *</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={INPUT_CLASS}
            />
          </label>

          <StudentSkillMatchNotice />

          <StudentRegistrationConsent values={consents} onChange={setConsents} />

          {submitError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-70"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already registered?{' '}
          <Link to={loginPath} className="font-semibold text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-slate-500">
          Hiring for a company?{' '}
          <Link to="/employer/register" className="font-semibold text-cyan-600 hover:text-cyan-700">
            Employer registration
          </Link>
        </p>
      </div>
    </div>
  );
}
