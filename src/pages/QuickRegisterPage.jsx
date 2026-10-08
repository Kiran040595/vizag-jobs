import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getAuthRedirectUrl } from "../lib/site";
import {
  EMPTY_STUDENT_CONSENTS,
  validateStudentConsents,
} from "../lib/studentConsent";
import { normalizePhone } from "../lib/quickApply";
import { useStudentAuth } from "../hooks/useStudentAuth";
import StudentRegistrationConsent from "../components/student/StudentRegistrationConsent";
import { quickInputClass } from "../components/QuickFormFields";
export default function QuickRegisterPage() {
  const navigate = useNavigate();
  const { session, isStudent } = useStudentAuth();
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("vizagjobs.quick.registration") || "{}",
      );
      return {
        full_name: saved.full_name || "",
        phone: saved.phone || "",
        email: saved.email || "",
        password: "",
      };
    } catch {
      return { full_name: "", phone: "", email: "", password: "" };
    }
  });
  const [consents, setConsents] = useState(EMPTY_STUDENT_CONSENTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  if (session && isStudent)
    return <Navigate to="/quick-applications/claim" replace />;
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (session)
        throw new Error(
          "Sign out of your staff account before registering as a student.",
        );
      validateStudentConsents(consents);
      const phone = normalizePhone(form.phone);
      if (!phone || form.full_name.trim().length < 2)
        throw new Error("Check your name and mobile number.");
      const { data, error: signupError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: getAuthRedirectUrl("/quick-applications/claim"),
          data: {
            user_type: "student",
            full_name: form.full_name.trim(),
            phone,
            auth_method: "email",
            registration_consents: true,
          },
        },
      });
      if (signupError) throw signupError;
      if (data.session) navigate("/quick-applications/claim");
      else setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-16">
      <div className="mx-auto max-w-xl">
        <Link
          to="/"
          className="inline-flex min-h-12 items-center font-bold text-blue-700"
        >
          Jobs in Vizag
        </Link>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold">Register free for more jobs</h1>
          {sent ? (
            <div role="status">
              <p className="mt-5">
                Check your email to confirm your account. Then sign in on this
                device to link your saved application.
              </p>
              <Link
                className="mt-5 inline-flex min-h-12 items-center text-blue-700"
                to="/student/login?next=%2Fquick-applications%2Fclaim"
              >
                Sign in
              </Link>
              <p className="mt-3 text-sm text-slate-600">
                Already have an account? Sign in with your existing password.
              </p>
            </div>
          ) : (
            <form className="mt-5 space-y-5" onSubmit={submit}>
              <p className="text-slate-600">
                Your job application is already saved. Create an account now and
                complete your detailed profile later.
              </p>
              {[
                ["full_name", "Full name", "text"],
                ["phone", "Mobile number", "tel"],
                ["email", "Email address", "email"],
                ["password", "Password", "password"],
              ].map(([key, label, type]) => (
                <label key={key} className="block font-semibold">
                  {label} *
                  <input
                    className={`${quickInputClass} mt-2`}
                    type={type}
                    required
                    minLength={key === "password" ? 8 : undefined}
                    maxLength={key === "full_name" ? 120 : key === "phone" ? 16 : 200}
                    inputMode={key === "phone" ? "tel" : key === "email" ? "email" : undefined}
                    placeholder={key === "phone" ? "10-digit mobile number" : key === "password" ? "At least 8 characters" : undefined}
                    autoComplete={
                      key === "password"
                        ? "new-password"
                        : key === "full_name"
                          ? "name"
                          : key === "phone"
                            ? "tel"
                            : "email"
                    }
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
              <p className="text-sm leading-6 text-slate-600">Use an email you can access. Your mobile number helps us match your application; no SMS code is needed.</p>
              <StudentRegistrationConsent
                values={consents}
                onChange={setConsents}
                idPrefix="quick-register"
              />
              {error && (
                <p role="alert" className="text-red-700">
                  {error}
                </p>
              )}
              <button
                className="min-h-12 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-60"
                disabled={busy}
              >
                {busy ? "Creating account…" : "Create free account"}
              </button>
              <Link
                className="inline-flex min-h-12 items-center text-blue-700"
                to="/student/login?next=%2Fquick-applications%2Fclaim"
              >
                Already registered? Sign in
              </Link>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
