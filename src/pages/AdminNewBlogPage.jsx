import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import AdminShell from '../components/admin/AdminShell';
import AdminBlogForm from '../components/admin/AdminBlogForm';

export default function AdminNewBlogPage() {
  const navigate = useNavigate();

  return (
    <AdminShell
      title="New blog post"
      description="Write in Markdown. Save a draft or publish when you are ready."
    >
      <SEO title="New post | Vizag Jobs Admin" description="Create a new blog post." canonical="/admin/blog/new" />
      <div className="mx-auto max-w-4xl">
        <AdminBlogForm
          mode="create"
          draftStorageKey="vizagjobs:admin-new-blog-draft"
          onSaved={(saved) => navigate(`/admin/blog/${saved.id}/edit`)}
        />
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Manage all posts on the blog list page.
          <button
            type="button"
            onClick={() => navigate('/admin/blog')}
            className="ml-2 font-semibold text-cyan-700 transition hover:text-cyan-600"
          >
            Go to blog posts
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
