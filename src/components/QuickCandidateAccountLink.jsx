import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { quickInputClass } from "./QuickFormFields";
export default function QuickCandidateAccountLink({ application, onLinked }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function find() {
    setBusy(true);
    setMessage("");
    try {
      let query = supabase
        .from("student_profiles")
        .select("user_id,full_name,phone,contact_email")
        .eq("is_active", true);
      if (email.trim())
        query = query.ilike("contact_email", email.trim().replace(/[%_]/g, ""));
      else {
        const phone = application.form_answers.phone;
        query = query.in("phone", [
          phone,
          phone.slice(-10),
          phone.replace("+", ""),
        ]);
      }
      const { data, error } = await query.limit(20);
      if (error) throw error;
      setStudents(data);
      setSelected("");
      if (!data.length)
        setMessage(
          "No matching account found. Try the student’s account email.",
        );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function link() {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc(
        "admin_link_quick_application",
        {
          p_application_id: application.id,
          p_student_user_id: selected,
          p_identity_confirmed: confirmed,
        },
      );
      if (error) throw error;
      onLinked(selected, data);
      setOpen(false);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 border-t pt-3">
      <button
        type="button"
        className="min-h-12 text-left font-semibold text-blue-700"
        onClick={() => setOpen((v) => !v)}
      >
        Link to an existing student account
      </button>
      {open && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Verify ownership with the applicant before linking. A matching phone
            alone is insufficient.
          </p>
          <input
            aria-label="Student account email"
            className={quickInputClass}
            type="email"
            placeholder="Account email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            disabled={busy}
            className="min-h-12 rounded-xl border px-4"
            onClick={find}
          >
            Find account
          </button>
          {students.length > 0 && (
            <select
              aria-label="Choose registered student"
              className={quickInputClass}
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="">Choose account</option>
              {students.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name} · {s.contact_email}
                </option>
              ))}
            </select>
          )}
          {selected && (
            <>
              <label className="flex min-h-12 items-start gap-3">
                <input
                  className="mt-1 size-5 shrink-0"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I verified that this applicant owns the selected account.
                </span>
              </label>
              <button
                disabled={busy || !confirmed}
                className="min-h-12 rounded-xl bg-blue-700 px-4 text-white disabled:opacity-50"
                onClick={link}
              >
                Link application
              </button>
            </>
          )}
          {message && (
            <p role="status" className="text-sm text-red-700">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
