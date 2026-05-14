import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchPublishedPosts } from '../services/blogs';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

export default function BlogListPage() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const data = await fetchPublishedPosts({}, false);
        if (ignore) return;
        setPosts(data);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="Blog | Vizag Jobs"
        description="Career tips, job market updates, and guides for job seekers in Visakhapatnam."
        canonical="/blog"
        ogUrl="/blog"
      />
      <Navbar />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">Blog</h1>
        <p className="mt-2 text-slate-600">Articles for job seekers in Vizag and beyond.</p>

        {isLoading ? (
          <div className="mt-10">
            <LoadingSpinner message="Loading posts..." />
          </div>
        ) : null}

        {loadError ? (
          <p className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
        ) : null}

        {!isLoading && !loadError && posts.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
            No posts yet. Check back soon.
          </p>
        ) : null}

        <ul className="mt-8 space-y-4">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                to={`/blog/${post.slug}`}
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md"
              >
                <h2 className="text-lg font-bold text-slate-950">{post.title}</h2>
                {post.excerpt ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{post.excerpt}</p> : null}
                <p className="mt-3 text-xs font-medium text-slate-400">{formatDate(post.publishedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <Footer />
    </div>
  );
}
