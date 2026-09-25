import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerGoogleButton from '../components/employer/EmployerGoogleButton';
import { REQUIRE_EMAIL_CONFIRMATION, SHOW_EMPLOYER_GOOGLE_AUTH } from '../lib/employerAuthFeatures';
import {
  EMPLOYER_INDUSTRY_OPTIONS,
  EMPLOYER_LOCATION_OPTIONS,
  isValidEmployerPhone,
  normalizeEmployerPhone,
} from '../lib/employerProfileOptions';
import { useEmployerAuth } from '../hooks/useEmployerAuth';

export default function EmployerRegisterPage() {
  const { isEmployer, isLoading, isSupabaseConfigured, session, signUp } = useEmployerAuth();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8">
          <LoadingSpinner message="Loading..." />
        </div>
      </div>
    );
  }

  if (session) {
    return <Navigate to={isEmployer ? '/employer/jobs' : '/employer/profile'} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!companyName.trim()) {
      setSubmitError('Please enter your company name.');
      return;
    }
    if (!contactName.trim()) {
      setSubmitError('Please enter the HR / contact person name.');
      return;
    }
    const cleanPhone = normalizeEmployerPhone(phone);
    if (!cleanPhone || !isValidEmployerPhone(cleanPhone)) {
      setSubmitError('Please enter a valid 10-digit mobile or WhatsApp number.');
      return;
    }
    if (!industry) {
      setSubmitError('Please select your business industry / sector.');
      return;
    }
    if (!location) {
      setSubmitError('Please select your office location in Vizag.');
      return;
    }

    setSubmitError('');
    setNotice('');
    setIsSubmitting(true);

    try {
      const result = await signUp({
        email: email.trim(),
        password,
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        phone: cleanPhone,
        industry,
        location,
      });
      if (result?.session) {
        return;
      }
      if (REQUIRE_EMAIL_CONFIRMATION) {
        setNotice('Account created! Check your email to confirm, then sign in.');
      } else {
        setNotice('Account created successfully! You can sign in now with your email and password.');
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(180deg,_#f0f9ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <SEO
        title="Employer Registration | Vizag Jobs Consultancy"
        description="Register your company on VizagJobs to post job openings, receive screened candidate profiles, and schedule interviews."
        canonical="/employer/register"
      />
      <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
        <div className="border-b border-slate-100 pb-5">
          <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
            For Employers & Hiring Teams
          </span>
          <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
            Register your company
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Partner with VizagJobs to post openings and connect with verified local talent.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Section 1: Company Profile */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Company Details
            </h2>

            <label className="block">
              <span className="text-xs font-semibold text-slate-700 sm:text-sm">
                Company Name <span className="text-rose-500">*</span>
              </span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="e.g. Acme Tech Solutions Pvt Ltd"
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-700 sm:text-sm">
                  Industry / Sector <span className="text-rose-500">*</span>
                </span>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                  className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                >
                  <option value="">Select industry…</option>
                  {EMPLOYER_INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700 sm:text-sm">
                  Office Location in Vizag <span className="text-rose-500">*</span>
                </span>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                >
                  <option value="">Select office area…</option>
                  {EMPLOYER_LOCATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Section 2: Contact Person */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Primary Contact & WhatsApp
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-700 sm:text-sm">
                  HR / Contact Person Name <span className="text-rose-500">*</span>
                </span>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                  placeholder="e.g. Ramesh Varma"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700 sm:text-sm">
                  Mobile / WhatsApp Number <span className="text-rose-500">*</span>
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="10-digit number e.g. 9876543210"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Used by VizagJobs consultancy recruiters for candidate submissions and interview coordination.
            </p>
          </div>

          {/* Google Sign-up (optional integration) */}
          {SHOW_EMPLOYER_GOOGLE_AUTH ? (
            <div className="border-t border-slate-100 pt-4">
              <EmployerGoogleButton
                companyName={companyName}
                requireCompanyName
                label="Sign up with Google"
              />
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide">
                  <span className="bg-white px-3 text-slate-400">Or use email & password</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Section 3: Credentials */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Login Credentials
            </h2>

            <label className="block">
              <span className="text-xs font-semibold text-slate-700 sm:text-sm">
                Official Email Address <span className="text-rose-500">*</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="hr@company.com"
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-700 sm:text-sm">
                Password <span className="text-rose-500">*</span>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>
          </div>

          {notice ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
              {!REQUIRE_EMAIL_CONFIRMATION ? (
                <>
                  {' '}
                  <Link to="/employer/login" className="font-semibold underline">
                    Sign in
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          {submitError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-cyan-500 text-sm font-bold text-slate-950 shadow-md transition hover:bg-cyan-400 disabled:opacity-70"
          >
            {isSubmitting ? 'Creating employer account…' : 'Register Employer Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/employer/login" className="font-semibold text-cyan-600 hover:text-cyan-700">
            Sign in
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-slate-400">
          Looking for a job instead?{' '}
          <Link to="/student/register" className="font-medium text-indigo-600 hover:text-indigo-700">
            Candidate registration →
          </Link>
        </p>
      </div>
    </div>
  );
}
