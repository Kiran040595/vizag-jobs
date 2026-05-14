import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import AdminBlogForm from '../components/admin/AdminBlogForm';
import { deserializeBlogForForm, fetchAdminPostById } from '../services/adminBlogs';

export default function AdminEditBlogPage() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const data = await fetchAdminPostById(postId);
        if (ignore) return;
        setPost(data);
        setLoadError('');
      } catch (error) {
        if (ignore) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load the post.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [postId]);

  return (
    <AdminShell title="Edit blog post" description="Update content, slug, or publication status.">
      <SEO title="Edit post | Vizag Jobs Admin" description="Edit a blog post." canonical={`/admin/blog/${postId}/edit`} />

      <div className="mx-auto max-w-4xl">
        {isLoading ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
            <LoadingSpinner message="Loading post..." />
          </section>
        ) : null}

        {!isLoading && loadError ? (
          <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">{loadError}</section>
        ) : null}

        {!isLoading && post ? (
          <AdminBlogForm
            key={post.id}
            mode="edit"
            postId={post.id}
            initialValues={deserializeBlogForForm(post)}
            draftStorageKey={`vizagjobs:admin-edit-blog-draft:${post.id}`}
            onCancel={() => navigate('/admin/blog')}
            onSaved={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}
