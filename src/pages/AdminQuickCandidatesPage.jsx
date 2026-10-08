import QuickCandidateAccountLink from "../components/QuickCandidateAccountLink";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminShell from "../components/admin/AdminShell";
import { supabase } from "../lib/supabaseClient";
import { answerText } from "../lib/quickApply";
import { quickInputClass } from "../components/QuickFormFields";
export default function AdminQuickCandidatesPage() {
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [role, setRole] = useState("");
  const [jobId, setJobId] = useState("");
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const all = [];
        for (let start = 0; ; start += 500) {
          const { data, error: e } = await supabase
            .from("job_applications")
            .select(
              "id,job_id,status,student_user_id,quick_candidate_id,form_answers,form_snapshot,application_source,applied_role,submitted_at,candidate:quick_candidates(full_name,phone,needs_review),job:jobs(title)",
            )
            .not("quick_candidate_id", "is", null)
            .order("submitted_at", { ascending: false })
            .range(start, start + 499);
          if (e) throw e;
          all.push(...data);
          if (data.length < 500) break;
        }
        const { data, error: e } = await supabase
          .from("jobs")
          .select("id,title,slug,status")
          .eq("is_quick_job", true)
          .order("created_at", { ascending: false });
        if (e) throw e;
        if (live) {
          setRows(all);
          setJobs(data);
        }
      } catch (e) {
        if (live) setError(e.message);
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, []);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tab === "all" ||
            (tab === "guest" && !r.student_user_id) ||
            (tab === "registered" && r.student_user_id) ||
            (tab === "review" && r.candidate?.needs_review)) &&
          (!role || r.applied_role === role) &&
          (!jobId || r.job_id === jobId) &&
          (!query ||
            JSON.stringify([
              r.form_answers,
              r.application_source,
              r.status,
              r.job?.title,
            ])
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [rows, tab, role, jobId, query],
  );
  const count = new Set(
    filtered.map((r) => r.student_user_id || r.quick_candidate_id),
  ).size;
  function exportCsv() {
    const cell = (v) =>
      `"${String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const csv = [
      [
        "Name",
        "Phone",
        "Role applied for",
        "Job",
        "Registration",
        "Source",
        "Status",
        "Answers",
      ],
      ...filtered.map((r) => [
        r.candidate?.full_name,
        r.candidate?.phone,
        r.applied_role,
        r.job?.title,
        r.student_user_id ? "Registered" : "Guest",
        r.application_source,
        r.status,
        answerText(r.form_snapshot, r.form_answers),
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "quick-candidates.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AdminShell
      title="Quick candidates"
      description="Track people by the jobs and roles they applied for."
    >
      <Link
        to="/admin/quick-jobs/new"
        className="inline-flex min-h-12 items-center rounded-xl bg-blue-700 px-5 text-white"
      >
        Create quick job
      </Link>
      <section className="mt-5 rounded-2xl bg-white p-4">
        <h2 className="text-xl font-bold">Quick jobs</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {jobs.map((j) => (
            <div className="rounded-xl border p-3" key={j.id}>
              <p className="font-bold">
                {j.title} · {j.status}
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                <Link
                  className="py-3 text-blue-700"
                  to={`/admin/quick-jobs/${j.id}/edit`}
                >
                  Edit / close / assign
                </Link>
                <Link className="py-3 text-blue-700" to={`/apply/${j.slug}`}>
                  Form link
                </Link>
                <Link
                  className="py-3 text-blue-700"
                  to={`/admin/jobs/${j.id}/applications`}
                >
                  Manage applications
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-5 rounded-2xl bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {["all", "guest", "registered", "review"].map((t) => (
            <button
              className={`min-h-12 rounded-xl border px-4 ${tab === t ? "bg-blue-700 text-white" : ""}`}
              key={t}
              onClick={() => setTab(t)}
            >
              {
                {
                  all: "All",
                  guest: "Not registered",
                  registered: "Registered",
                  review: "Needs review",
                }[t]
              }
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            aria-label="Search candidates and answers"
            className={quickInputClass}
            placeholder="Name, phone, location, education, source…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Role applied for"
            className={quickInputClass}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">All roles applied for</option>
            {[...new Set(rows.map((r) => r.applied_role))]
              .filter(Boolean)
              .map((r) => (
                <option key={r}>{r}</option>
              ))}
          </select>
          <select
            aria-label="Job filter"
            className={quickInputClass}
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
          >
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p>
            {count} candidate records · {filtered.length} applications
          </p>
          <button
            className="min-h-12 rounded-xl border px-4"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Guest groups use name and phone; shared phone numbers may need review.
          Registered accounts are counted once. Role counts show applications,
          not verified qualifications.
        </p>
      </section>
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="mt-5">
          Loading candidates…
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {filtered.map((r) => (
            <article
              key={r.id}
              className="min-w-0 rounded-2xl bg-white p-5 shadow-sm"
            >
              <h2 className="text-xl font-bold">
                {r.candidate?.full_name || r.form_answers.full_name}
              </h2>
              <a
                className="my-2 inline-flex min-h-12 items-center text-blue-700"
                href={`tel:${r.candidate?.phone}`}
              >
                {r.candidate?.phone}
              </a>
              <p>
                {r.student_user_id ? "Registered" : "Not registered"}
                {r.candidate?.needs_review ? " · Needs review" : ""} ·{" "}
                {r.status}
              </p>
              <p className="mt-2">
                Applied for: {r.applied_role} · {r.job?.title}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Source: {r.application_source} ·{" "}
                {new Date(r.submitted_at).toLocaleDateString()}
              </p>
              <details className="mt-3">
                <summary className="min-h-12 cursor-pointer py-3 font-semibold">
                  Application answers
                </summary>
                <p className="whitespace-pre-wrap break-words">
                  {answerText(r.form_snapshot, r.form_answers)}
                </p>
              </details>
              <Link
                className="mt-3 inline-flex min-h-12 items-center text-blue-700"
                to={`/admin/jobs/${r.job_id}/applications`}
              >
                Update status / interview →
              </Link>
              {!r.student_user_id && (
                <QuickCandidateAccountLink
                  application={r}
                  onLinked={(userId, candidateId) =>
                    setRows((current) =>
                      current.map((row) =>
                        row.id === r.id
                          ? {
                              ...row,
                              student_user_id: userId,
                              quick_candidate_id: candidateId,
                              candidate: {
                                ...row.candidate,
                                needs_review: false,
                              },
                            }
                          : row,
                      ),
                    )
                  }
                />
              )}
            </article>
          ))}
          {!filtered.length && <p>No applications match these filters.</p>}
        </div>
      )}
    </AdminShell>
  );
}
