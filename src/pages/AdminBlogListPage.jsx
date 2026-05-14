import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { fetchAdminPosts, updateAdminPostStatus } from '../services/adminBlogs';

const STATUS_STYLES = {
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  archived: 'border-slate-200 bg-slate-100 text-slate-600',
};

const normalizeSearchText = (post) =>
  [post.title, post.slug, post.status, post.excerpt].filter(Boolean).join(' ').toLowerCase();

const sortPosts = (items) =>
  [...items].sort((left, right) => {
    const leftTime = left.published_at ? new Date(left.published_at).getTime() : new Date(left.created_at).getTime();
    const rightTime = right.published_at ? new Date(right.published_at).getTime() : new Date(right.created_at).getTime();
    return rightTime - leftTime;
  });

const upsertPost = (posts, next) => {
  const idx = posts.findIndex((p) => p.id === next.id);
  if (idx === -1) return sortPosts([next, ...posts]);
  const nextPosts = [...posts];
  nextPosts[idx] = next;
  return sortPosts(nextPosts);
};

const formatDateTime = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export default function AdminBlogListPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const data = await fetchAdminPosts();
        if (ignore) return;
        setPosts(sortPosts(data));
        setLoadError('');
      } catch (error) {
        if (ignore) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load posts.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const deferredSearch = useDeferredValue(searchTerm);

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return posts;
    return posts.filter((p) => normalizeSearchText(p).includes(term));
  }, [deferredSearch, posts]);

  const handleStatusChange = async (postId, status) => {
    setBusyId(postId);
    setLoadError('');
    setNotice('');
    try {
      const updated = await updateAdminPostStatus(postId, status);
      setPosts((current) => upsertPost(current, updated));
      setNotice(`Post moved to ${status}.`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not update status.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <AdminShell
      title="Blog posts"
      description="Create guides and updates for job seekers. Drafts stay private until you publish."
    >
      <SEO title="Blog posts | Vizag Jobs Admin" description="Manage Vizag Jobs blog posts." canonical="/admin/blog" />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Content</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">All posts</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, slug..."
              className="h-11 w-full max-w-sm rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <button
              type="button"
              onClick={() => navigate('/admin/blog/new')}
              className="h-11 rounded-2xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              New post
            </button>
          </div>
        </div>

        {loadError ? (
          <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
        ) : null}
        {notice ? (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
        ) : null}

        {isLoading ? (
          <div className="mt-8">
            <LoadingSpinner message="Loading posts..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <h3 className="text-lg font-bold text-slate-900">No posts match this search.</h3>
            <p className="mt-2 text-sm text-slate-600">Try another keyword or create a new post.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filtered.map((post) => {
              const isBusy = busyId === post.id;
              return (
                <article key={post.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-950">{post.title}</h3>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                            STATUS_STYLES[post.status] || STATUS_STYLES.draft
                          }`}
                        >
                          {post.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Slug: {post.slug}</p>
                      <p className="mt-1 text-xs text-slate-500">Published: {formatDateTime(post.published_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/blog/${post.id}/edit`)}
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleStatusChange(post.id, post.status === 'published' ? 'draft' : 'published')}
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {post.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || post.status === 'archived'}
                        onClick={() => handleStatusChange(post.id, 'archived')}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
