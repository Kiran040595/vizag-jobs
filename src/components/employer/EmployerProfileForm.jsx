import { useEffect, useState } from 'react';
import { upsertEmployerProfile } from '../../services/employerJobs';
import { useEmployerAuth } from '../../hooks/useEmployerAuth';

const INPUT_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100';

export default function EmployerProfileForm({ onSaved }) {
  const { profile, refreshEmployerAccess, user } = useEmployerAuth();
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    phone: '',
    website: '',
    company_logo_url: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        company_name: profile.company_name || '',
        contact_name: profile.contact_name || '',
        contact_email: profile.contact_email || user?.email || '',
        phone: profile.phone || '',
        website: profile.website || '',
        company_logo_url: profile.company_logo_url || '',
      });
    } else if (user?.email) {
      setForm((current) => ({
        ...current,
        contact_email: user.email,
      }));
    }
  }, [profile, user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSaving(true);

    try {
      const saved = await upsertEmployerProfile(form);
      if (user?.id) {
        await refreshEmployerAccess(user.id);
      }
      setNotice('Company profile saved.');
      onSaved?.(saved);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <h2 className="text-2xl font-black text-slate-950">Company profile</h2>
      <p className="mt-2 text-sm text-slate-600">
        This information is shown on your job posts and used when you submit listings for admin review.
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
          <span className="text-sm font-semibold text-slate-700">Company name</span>
          <input
            name="company_name"
            value={form.company_name}
            onChange={handleChange}
            required
            className={INPUT_CLASS}
            placeholder="Your company Pvt Ltd"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Contact name</span>
          <input name="contact_name" value={form.contact_name} onChange={handleChange} className={INPUT_CLASS} />
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
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Phone</span>
          <input name="phone" value={form.phone} onChange={handleChange} className={INPUT_CLASS} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Website</span>
          <input name="website" value={form.website} onChange={handleChange} className={INPUT_CLASS} placeholder="https://..." />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Company logo URL</span>
          <input
            name="company_logo_url"
            value={form.company_logo_url}
            onChange={handleChange}
            className={INPUT_CLASS}
            placeholder="https://..."
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </section>
  );
}
