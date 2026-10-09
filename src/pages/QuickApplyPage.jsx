import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import ApplicationCommunicationPrompt from "../components/ApplicationCommunicationPrompt";
import QuickFormFields from "../components/QuickFormFields";
import {
  getQuickJob,
  storeReceipt,
  claimQuickApplications,
} from "../services/quickJobs";
import { validateAnswers, requestTokenForJob } from "../lib/quickApply";
import { supabase } from "../lib/supabaseClient";
export default function QuickApplyPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const successRef = useRef(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [requestToken, setRequestToken] = useState(() => crypto.randomUUID());
  const [website, setWebsite] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    setJob(null);
    setError("");
    setDone(false);
    setAnswers({});
    setConsent(false);
    setRequestToken(requestTokenForJob(slug));
    getQuickJob(slug)
      .then((data) => {
        if (live) setJob(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [slug]);
  useEffect(() => {
    if (done) {
      successRef.current?.focus();
      successRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [done]);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const clean = validateAnswers(job.fields, answers);
      if (!consent) throw new Error("Please agree to share your application.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/quick-apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          jobId: job.id,
          formId: job.form_id,
          answers: clean,
          requestToken,
          consent,
          website,
          source: params.get("source") || params.get("utm_source") || "direct",
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not save. Try again.");
      if (result.claimable) storeReceipt(requestToken);
      try {
        sessionStorage.setItem(
          "vizagjobs.quick.registration",
          JSON.stringify(clean),
        );
      } catch {
        /* Storage may be unavailable. */
      }
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-32">
      <SEO title={job?.title || "Quick job application"} noindex />
      <div className="mx-auto max-w-xl">
        <Link
          to="/"
          className="inline-flex min-h-12 items-center font-bold text-blue-700"
        >
          Jobs in Vizag
        </Link>
        {loading ? (
          <p role="status">Loading job…</p>
        ) : !job ? (
          <p role="alert">{error || "This job is unavailable."}</p>
        ) : (
          <>
            <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
              <h1 className="break-words text-2xl font-bold">{job.title}</h1>
              <p className="mt-2 break-words text-slate-600">{job.company}</p>
              <p className="mt-3 break-words font-semibold">
                {job.location}
                {job.salary ? ` · ${job.salary}` : ""}
              </p>
              <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-700">
                {job.description}
              </p>
            </section>
            {done ? (
              <section className="rounded-2xl bg-white p-5" role="status">
                <h2 ref={successRef} tabIndex={-1} className="text-2xl font-bold outline-none">Application received</h2>
                <p className="mt-3">
                  Thank you! If you already applied with this number, your
                  existing application is kept.
                </p>
                <ApplicationCommunicationPrompt job={job} />
                <p className="mt-5">
                  Want to apply for more jobs? Register for free on Jobs in
                  Vizag.
                </p>
                <Link
                  className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-4 text-white"
                  to="/quick-register"
                >
                  Register free
                </Link>
                <Link
                  className="mt-3 flex min-h-12 items-center justify-center rounded-xl border px-4 py-3 text-center"
                  to="/student/login?next=%2Fquick-applications%2Fclaim"
                >
                  Already registered? Sign in and link my application
                </Link>
                <Link className="mt-4 inline-block py-3 text-blue-700" to="/">
                  Browse more jobs
                </Link>
              </section>
            ) : !job.is_open ? (
              <p className="rounded-xl bg-white p-5">
                Applications for this job are closed.
              </p>
            ) : (
              <form
                onSubmit={submit}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <h2 className="mb-5 text-xl font-bold">Apply in a minute</h2>
                <p className="mb-5 text-sm text-slate-600">
                  No account needed. Fields marked * are required.
                </p>
                <QuickFormFields
                  fields={job.fields}
                  answers={answers}
                  onChange={(id, value) =>
                    setAnswers((a) => ({ ...a, [id]: value }))
                  }
                  disabled={busy}
                />
                <div hidden aria-hidden="true">
                  <label>
                    Website
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </label>
                </div>
                <label className="mt-6 flex min-h-12 items-start gap-3">
                  <input
                    className="mt-1 size-5 shrink-0"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  <span>
                    I agree to share these details with Jobs in Vizag and the
                    employer for this application.{" "}
                    <Link to="/privacy-policy" className="underline">
                      Privacy policy
                    </Link>
                  </span>
                </label>
                {error && (
                  <p role="alert" className="mt-4 text-red-700">
                    {error}
                  </p>
                )}
                <button
                  disabled={busy}
                  className="mt-5 min-h-12 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Submit application"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
export function ClaimQuickApplicationsPage() {
  const [message, setMessage] = useState(
    "Link your applications from this device to your student account.",
  );
  const [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Your quick applications</h1>
      <p className="my-5" role="status">
        {message}
      </p>
      <button
        disabled={busy}
        className="min-h-12 rounded-xl bg-blue-700 px-5 text-white"
        onClick={async () => {
          setBusy(true);
          try {
            const count = await claimQuickApplications();
            setMessage(
              `${count} application(s) linked. Existing application history is preserved.`,
            );
          } catch (e) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Link my applications
      </button>
      <Link
        className="mt-5 block py-3 text-blue-700"
        to="/student/applied-jobs"
      >
        View my applications
      </Link>
    </main>
  );
}
