import { useEffect, useState } from 'react';
import { upsertStudentProfile } from '../../services/studentJobs';
import { useStudentAuth } from '../../hooks/useStudentAuth';

const INPUT_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

export default function StudentProfileForm({ onSaved }) {
  const { profile, refreshStudentAccess, user } = useStudentAuth();
  const [form, setForm] = useState({
    full_name: '',
    college: '',
    degree: '',
    branch: '',
    graduation_year: '',
    contact_email: '',
    phone: '',
    skills: '',
    is_fresher: true,
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        college: profile.college || '',
        degree: profile.degree || '',
        branch: profile.branch || '',
        graduation_year: profile.graduation_year ? String(profile.graduation_year) : '',
        contact_email: profile.contact_email || user?.email || '',
        phone: profile.phone || '',
        skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
        is_fresher: profile.is_fresher !== false,
      });
    } else if (user?.email) {
      setForm((current) => ({
        ...current,
        contact_email: user.email,
      }));
    }
  }, [profile, user]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSaving(true);

    try {
      const saved = await upsertStudentProfile(form);
      if (user?.id) {
        await refreshStudentAccess(user.id);
      }
      setNotice('Student profile saved.');
      onSaved?.(saved);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <h2 className="text-2xl font-black text-slate-950">Student profile</h2>
      <p className="mt-2 text-sm text-slate-600">
        Keep your education and skills up to date so we can match you with fresher-friendly roles in Vizag.
      </p>

      {notice ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Full name</span>
          <input
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            required
            className={INPUT_CLASS}
            placeholder="Your full name"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">College / university</span>
          <input
            name="college"
            value={form.college}
            onChange={handleChange}
            className={INPUT_CLASS}
            placeholder="Andhra University, GITAM, etc."
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Degree</span>
          <input
            name="degree"
            value={form.degree}
            onChange={handleChange}
            className={INPUT_CLASS}
            placeholder="B.Tech, B.Com, MBA"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Branch</span>
          <input
            name="branch"
            value={form.branch}
            onChange={handleChange}
            className={INPUT_CLASS}
            placeholder="CSE, ECE, Mechanical"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Graduation year</span>
          <input
            name="graduation_year"
            value={form.graduation_year}
            onChange={handleChange}
            inputMode="numeric"
            className={INPUT_CLASS}
            placeholder="2026"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Phone</span>
          <input name="phone" value={form.phone} onChange={handleChange} className={INPUT_CLASS} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Contact email</span>
          <input
            type="email"
            name="contact_email"
            value={form.contact_email}
            onChange={handleChange}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            name="is_fresher"
            checked={form.is_fresher}
            onChange={handleChange}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          <span className="text-sm font-semibold text-slate-700">I am a fresher / looking for entry-level roles</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Skills</span>
          <textarea
            name="skills"
            value={form.skills}
            onChange={handleChange}
            rows={3}
            className={INPUT_CLASS}
            placeholder="Java, Python, Communication (comma-separated)"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </section>
  );
}
