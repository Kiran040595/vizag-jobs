import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublishedPosts } from '../services/blogs';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600">From the blog</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Latest articles</h2>
          <p className="mt-1 text-sm text-slate-600">Tips and updates for job seekers in Vizag.</p>
        </div>
        <Link to="/blog" className="text-sm font-semibold text-cyan-700 hover:text-cyan-600">
          View all posts
        </Link>
      </div>
      <ul className="mt-6 divide-y divide-slate-100">
        {posts.map((post) => (
          <li key={post.id} className="py-4 first:pt-0 last:pb-0">
            <Link to={`/blog/${post.slug}`} className="group block">
              <h3 className="font-bold text-slate-950 transition group-hover:text-cyan-700">{post.title}</h3>
              {post.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.excerpt}</p> : null}
              <p className="mt-2 text-xs text-slate-400">{formatDate(post.publishedAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
