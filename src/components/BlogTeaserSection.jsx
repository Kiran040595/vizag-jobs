import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublishedPosts } from '../services/blogs';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

function BlogPostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex h-full min-h-[148px] flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/40 hover:shadow-sm"
    >
      <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-950 transition group-hover:text-cyan-800 sm:text-base">
        {post.title}
      </h3>
      {post.excerpt ? (
        <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{post.excerpt}</p>
      ) : (
        <span className="flex-1" />
      )}
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {formatDate(post.publishedAt)}
      </p>
    </Link>
  );
}

export default function BlogTeaserSection() {
  const [posts, setPosts] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const data = await fetchPublishedPosts({ limit: 3 }, false);
        if (ignore) return;
        setPosts(data);
      } catch {
        if (ignore) return;
        setFailed(true);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, []);

  if (failed || posts.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6"
      aria-label="Latest blog articles"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-600 sm:tracking-[0.25em]">
            From the blog
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950 sm:mt-2 sm:text-2xl">Career tips &amp; updates</h2>
        </div>
        <Link
          to="/blog"
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 hover:text-cyan-600 sm:text-sm"
        >
          View all
        </Link>
      </div>

      <p className="mt-1 text-xs text-slate-500 sm:hidden">Swipe for more articles</p>

      {/* Mobile: horizontal swipe cards */}
      <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto overscroll-x-contain px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-5 md:hidden [&::-webkit-scrollbar]:hidden">
        {posts.map((post) => (
          <article key={post.id} className="w-[min(82vw,300px)] shrink-0 snap-start">
            <BlogPostCard post={post} />
          </article>
        ))}
      </div>

      {/* Desktop: grid */}
      <div className="mt-5 hidden gap-4 md:grid md:grid-cols-3">
        {posts.map((post) => (
          <article key={post.id}>
            <BlogPostCard post={post} />
          </article>
        ))}
      </div>
    </section>
  );
}
