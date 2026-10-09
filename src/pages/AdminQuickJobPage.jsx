import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminShell from "../components/admin/AdminShell";
import QuickFormFields, {
  quickInputClass,
} from "../components/QuickFormFields";
import {
  FIELD_LIBRARY,
  FIELD_TYPES,
  FORM_TEMPLATES,
  validateFields,
} from "../lib/quickApply";
import { supabase } from "../lib/supabaseClient";
import { saveQuickJob } from "../services/quickJobs";
const blankJob = {
  title: "",
  role: "",
  location: "Visakhapatnam",
  salary: "",
  description: "",
  company: "",
  owner_id: "",
  status: "internal",
  is_open: true,
};
const button =
  "min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold";
export default function AdminQuickJobPage() {
  const { jobId } = useParams();
  const [savedId, setSavedId] = useState(null);
  const [job, setJob] = useState(blankJob);
  const [fields, setFields] = useState(FORM_TEMPLATES.Basic);
  const [employers, setEmployers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [preview, setPreview] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [savedStatus, setSavedStatus] = useState("");
  const [dragged, setDragged] = useState(null);
  const [templateName, setTemplateName] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase
        .from("employer_profiles")
        .select("user_id,company_name")
        .eq("is_active", true),
      supabase.from("quick_form_templates").select("*"),
    ]).then(([owners, forms]) => {
      if (!live) return;
      if (owners.error || forms.error)
        setError((owners.error || forms.error).message);
      setEmployers(owners.data || []);
      setTemplates(forms.data || []);
    });
    if (jobId)
      Promise.all([
        supabase.from("jobs").select("*").eq("id", jobId).single(),
        supabase
          .from("quick_job_forms")
          .select("*")
          .eq("job_id", jobId)
          .order("version", { ascending: false })
          .limit(1),
      ]).then(([j, f]) => {
        if (!live) return;
        if (j.error || f.error || !f.data?.[0]) {
          setError("Could not load quick job.");
          return;
        }
        setJob({
          ...j.data,
          owner_id: j.data.created_by || "",
          is_open: f.data[0].is_open,
        });
        setFields(f.data[0].fields);
      });
    return () => {
      live = false;
    };
  }, [jobId]);
  const updateField = (id, patch) =>
    setFields((current) =>
      current.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  const move = (from, to) =>
    setFields((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  const addField = (field) => {
    if (fields.length >= 20) {
      setError("Maximum 20 fields.");
      return;
    }
    setFields((current) => [
      ...current,
      { ...field, id: `${field.id}_${crypto.randomUUID().slice(0, 8)}` },
    ]);
  };
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const id = await saveQuickJob(job, fields, jobId || savedId || null);
      setSavedId(id);
      const { data, error: readError } = await supabase
        .from("jobs")
        .select("slug")
        .eq("id", id)
        .single();
      if (readError) throw readError;
      setLink(`${window.location.origin}/apply/${data.slug}`);
      setSavedStatus(job.status);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveTemplate() {
    try {
      validateFields(fields);
      if (!templateName.trim()) throw new Error("Give your template a name.");
      const { data, error } = await supabase
        .from("quick_form_templates")
        .insert({ name: templateName.trim(), fields })
        .select()
        .single();
      if (error) throw error;
      setTemplates((t) => [...t, data]);
      setTemplateName("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <AdminShell
      title={jobId ? "Edit quick job" : "Create a quick job"}
      description="Create a short job, choose its visibility, and share a simple application form."
    >
      <Link
        to="/admin/candidates"
        className="mb-5 inline-flex min-h-12 items-center text-blue-700"
      >
        View quick candidates and jobs →
      </Link>
      <form
        id="quick-job-editor"
        onSubmit={save}
        className="grid min-w-0 gap-6 lg:grid-cols-2"
      >
        <div className="min-w-0 space-y-6">
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold">1. Job details</h2>
            {[
              ["title", "Job title"],
              ["role", "Role / candidate group"],
              ["location", "Job location"],
              ["salary", "Salary (optional)"],
              ["company", "Company name (optional)"],
            ].map(([key, label]) => (
              <label key={key} className="block font-semibold">
                {label}
                <input
                  className={`${quickInputClass} mt-2`}
                  required={["title", "role", "location"].includes(key)}
                  maxLength={key === "role" ? 100 : 150}
                  value={job[key] || ""}
                  onChange={(e) =>
                    setJob((j) => ({
                      ...j,
                      [key]: e.target.value,
                      ...(key === "title" &&
                      (!j.role || j.role === j.title.slice(0, 100))
                        ? { role: e.target.value.slice(0, 100) }
                        : {}),
                    }))
                  }
                />
              </label>
            ))}
            <label className="block font-semibold">
              About the job
              <textarea
                required
                minLength={10}
                maxLength={10000}
                className={`${quickInputClass} mt-2 min-h-32`}
                value={job.description}
                onChange={(e) =>
                  setJob((j) => ({ ...j, description: e.target.value }))
                }
              />
            </label>
            <label className="block font-semibold">
              Assign to company account
              <select
                className={`${quickInputClass} mt-2`}
                value={job.owner_id}
                onChange={(e) =>
                  setJob((j) => ({ ...j, owner_id: e.target.value }))
                }
              >
                <option value="">Admin manages applications</option>
                {employers.map((e) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.company_name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-slate-600">
              An assigned company can manage these applications in its existing
              job dashboard.
            </p>
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold">2. Choose application fields</h2>
            <label className="mt-4 block">
              Start from a template
              <select
                className={`${quickInputClass} mt-2`}
                defaultValue=""
                onChange={(e) => {
                  const selected =
                    FORM_TEMPLATES[e.target.value] ||
                    templates.find((t) => t.id === e.target.value)?.fields;
                  if (selected) {
                    setFields(structuredClone(selected));
                    setPreview({});
                  }
                }}
              >
                <option value="">Choose template</option>
                {Object.keys(FORM_TEMPLATES).map((t) => (
                  <option key={t}>{t}</option>
                ))}
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-4 text-sm text-slate-600">
              Drag to reorder, or use ↑ and ↓ on mobile. Name and phone are
              always required.
            </p>
            <div className="mt-4 space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  draggable
                  onDragStart={() => setDragged(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragged !== null) move(dragged, index);
                    setDragged(null);
                  }}
                  className="min-w-0 rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto text-sm font-semibold">
                      Field {index + 1}
                    </span>
                    <button
                      type="button"
                      className={button}
                      aria-label={`Move ${field.label} up`}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={button}
                      aria-label={`Move ${field.label} down`}
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      ↓
                    </button>
                    {!["full_name", "phone"].includes(field.id) && (
                      <button
                        type="button"
                        className={button}
                        onClick={() =>
                          setFields((f) => f.filter((v) => v.id !== field.id))
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <label className="mt-3 block text-sm">
                    Label
                    <input
                      aria-label={`Field ${index + 1} label`}
                      className={`${quickInputClass} mt-1`}
                      maxLength={120}
                      required
                      value={field.label}
                      onChange={(e) =>
                        updateField(field.id, { label: e.target.value })
                      }
                    />
                  </label>
                  {!["full_name", "phone"].includes(field.id) && (
                    <>
                      <label className="mt-3 block text-sm">
                        Answer type
                        <select
                          className={`${quickInputClass} mt-1`}
                          value={field.type}
                          onChange={(e) =>
                            updateField(field.id, {
                              type: e.target.value,
                              options: field.options || ["Yes", "No"],
                            })
                          }
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {
                                {
                                  text: "Short text",
                                  textarea: "Long text",
                                  number: "Number",
                                  select: "Dropdown",
                                  radio: "Single choice",
                                  checkbox: "Multiple choice",
                                  email: "Email",
                                }[t]
                              }
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex min-h-12 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateField(field.id, {
                              required: e.target.checked,
                            })
                          }
                        />
                        Required
                      </label>
                    </>
                  )}
                  {["select", "radio", "checkbox"].includes(field.type) && (
                    <label className="mt-2 block text-sm">
                      Options (one per line)
                      <textarea
                        className={`${quickInputClass} mt-1`}
                        value={(field.options || []).join("\n")}
                        onChange={(e) =>
                          updateField(field.id, {
                            options: e.target.value.split("\n"),
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {FIELD_LIBRARY.map((f) => (
                <button
                  className={button}
                  key={f.id}
                  type="button"
                  onClick={() => {
                    if (fields.some((v) => v.id === f.id)) addField(f);
                    else setFields((current) => [...current, f]);
                  }}
                >
                  + {f.label}
                </button>
              ))}
              <button
                type="button"
                className={button}
                onClick={() =>
                  addField({
                    id: "question",
                    label: "Your question",
                    type: "text",
                    required: false,
                  })
                }
              >
                + Custom field
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Template name"
                className={quickInputClass}
                maxLength={80}
                placeholder="Save as reusable template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <button className={button} type="button" onClick={saveTemplate}>
                Save template
              </button>
            </div>
          </section>
        </div>
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-5 text-xl font-bold">Mobile form preview</h2>
            <QuickFormFields
              previewMode
              fields={fields}
              answers={preview}
              onChange={(id, value) =>
                setPreview((p) => ({ ...p, [id]: value }))
              }
            />
          </section>
          <section className="rounded-2xl bg-white p-5">
            <label className="flex min-h-12 items-center gap-3">
              <input
                type="checkbox"
                checked={job.is_open}
                onChange={(e) =>
                  setJob((j) => ({ ...j, is_open: e.target.checked }))
                }
              />
              Accept applications
            </label>
            <label className="block">
              Visibility
              <select
                className={`${quickInputClass} mt-2`}
                aria-describedby="quick-job-visibility-help"
                value={job.status}
                onChange={(e) =>
                  setJob((j) => ({ ...j, status: e.target.value }))
                }
              >
                <option value="internal">Internal — link only</option>
                <option value="published">Public — show on website</option>
                <option value="draft">Save draft</option>
              </select>
            </label>
            <p id="quick-job-visibility-help" className="mt-3 text-sm leading-6 text-slate-600">
              Public jobs appear in website listings. Internal jobs are hidden from listings,
              but anyone with the application link can apply. Drafts cannot accept applications.
              Save to apply a visibility change.
            </p>
            {error && (
              <p role="alert" className="my-4 break-words text-red-700">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="mt-5 min-h-12 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save quick job"}
            </button>
            {link && (
              <div role="status" className="mt-5 space-y-3 break-all">
                <p>
                  Saved.{" "}
                  {savedStatus === "draft"
                    ? "Draft saved. Choose Public or Internal before sharing."
                    : savedStatus === "internal"
                      ? "Internal job saved. Share this link directly; it is hidden from public listings."
                      : "Public job saved. It is visible on the website and your link is ready to share."}
                </p>
                {savedStatus !== "draft" && (
                  <>
                    <Link
                      className="block text-blue-700 underline"
                      to={new URL(link).pathname}
                    >
                      {link}
                    </Link>
                    <button
                      type="button"
                      className={button}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(link);
                        } catch {
                          setError("Select and copy the link above.");
                        }
                      }}
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      className={`${button} ml-2 mt-2`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${link}?source=instagram`,
                          );
                        } catch {
                          setError(
                            "Select and copy the link above, then add ?source=instagram.",
                          );
                        }
                      }}
                    >
                      Copy Instagram link
                    </button>
                    <a
                      className={`${button} ml-2 inline-flex items-center`}
                      target="_blank"
                      rel="noreferrer"
                      href={`https://wa.me/?text=${encodeURIComponent(`${job.title} – ${job.location}\n${link}?source=whatsapp`)}`}
                    >
                      WhatsApp
                    </a>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </form>
      <div className="h-16 sm:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:hidden">
        <button
          form="quick-job-editor"
          type="submit"
          disabled={busy}
          className="min-h-12 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save quick job"}
        </button>
      </div>
    </AdminShell>
  );
}
