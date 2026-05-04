import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import AdminShell from '../components/admin/AdminShell';
import AdminJobForm from '../components/admin/AdminJobForm';

export default function AdminNewJobPage() {
  const navigate = useNavigate();

  return (
    <AdminShell
      title="Create a new job"
      description="Use a dedicated page for fresh postings so the form stays isolated from the existing jobs list."
    >
      <SEO title="New Job | Vizag Jobs Admin" description="Create a new Vizag Jobs listing." canonical="/admin/new" />
      <div className="mx-auto max-w-4xl">
        <AdminJobForm
          mode="create"
          draftStorageKey="vizagjobs:admin-new-job-draft"
          onSaved={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Need to review or update older posts? Open the existing jobs page.
          <button
            type="button"
            onClick={() => navigate('/admin/jobs')}
            className="ml-2 font-semibold text-cyan-700 transition hover:text-cyan-600"
          >
            Go to existing jobs
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
