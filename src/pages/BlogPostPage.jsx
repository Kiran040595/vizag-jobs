import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchPublishedPostBySlug } from '../services/blogs';
import { buildBlogPostingSchema } from '../lib/blogPostingSchema';
import { SITE_URL } from '../lib/site';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { dateStyle: 'long' });
};

const markdownComponents = {
  h1: ({ children }) => <h1 className="mt-8 text-3xl font-black text-slate-950 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-8 text-2xl font-bold text-slate-950">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 text-xl font-bold text-slate-900">{children}</h3>,
  p: ({ children }) => <p className="mt-4 text-base leading-relaxed text-slate-700">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} className="font-semibold text-cyan-700 underline decoration-cyan-300 underline-offset-2 hover:text-cyan-600" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-700">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-6 text-slate-700">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children, ...props }) =>
    className ? (
      <code className={`${className} text-slate-100`} {...props}>
        {children}
      </code>
    ) : (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-800" {...props}>
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-4 border-cyan-400 bg-cyan-50/50 py-2 pl-4 text-slate-700">{children}</blockquote>
  ),
  hr: () => <hr className="my-8 border-slate-200" />,
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border border-slate-200 text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-900">{children}</th>,
  td: ({ children }) => <td className="border border-slate-200 px-3 py-2 text-slate-700">{children}</td>,
};

export default function BlogPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!slug) {
        setIsLoading(false);
        setLoadError('Missing post slug.');
        return;
      }

      try {
        const data = await fetchPublishedPostBySlug(slug, false);
        if (ignore) return;
        if (!data) {
          setLoadError('This post could not be found or is not published.');
          setPost(null);
        } else {
          setPost(data);
          setLoadError('');
        }
      } catch (error) {
        if (ignore) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load this post.');
        setPost(null);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [slug]);

  const canonical = post ? `/blog/${post.slug}` : '/blog';
  const description = post?.excerpt || post?.title || 'Vizag Jobs blog';
  const blogPostingSchema = post ? buildBlogPostingSchema(post, { siteUrl: SITE_URL }) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title={post ? `${post.title} | Vizag Jobs Blog` : 'Blog post | Vizag Jobs'}
        description={description}
        canonical={canonical}
        ogUrl={canonical}
        structuredData={blogPostingSchema}
        noindex={!post && !isLoading}
      />
      <Navbar />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link to="/blog" className="text-sm font-semibold text-cyan-700 hover:text-cyan-600">
          Back to blog
        </Link>

        {isLoading ? (
          <div className="mt-10">
            <LoadingSpinner message="Loading post..." />
          </div>
        ) : null}

        {loadError ? (
          <p className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
        ) : null}

        {post ? (
          <article className="mt-8">
            <header>
              <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">{post.title}</h1>
              <p className="mt-2 text-sm text-slate-500">{formatDate(post.publishedAt)}</p>
              {post.excerpt ? <p className="mt-4 text-lg text-slate-600">{post.excerpt}</p> : null}
            </header>
            <div className="blog-post-body mt-8">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {post.body}
              </ReactMarkdown>
            </div>
          </article>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
