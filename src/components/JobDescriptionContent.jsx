import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sanitizeJobDescriptionForDisplay } from '../lib/jobDescriptionDisplay';

const markdownComponents = {
  h1: ({ children }) => (
    <h2 className="mt-8 text-xl font-bold text-slate-900 first:mt-0 sm:text-2xl">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-7 border-b border-slate-100 pb-2 text-lg font-bold text-slate-900">{children}</h3>
  ),
  h3: ({ children }) => <h4 className="mt-5 text-base font-bold text-slate-900">{children}</h4>,
  p: ({ children }) => <p className="mt-3 text-base leading-7 text-slate-700">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-7 text-slate-700">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-7 text-slate-700">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  a: ({ href, children }) => {
    const path = typeof href === 'string' ? href : '';
    if (path.startsWith('/')) {
      return (
        <Link to={path} className="font-semibold text-blue-600 underline decoration-blue-200 underline-offset-2 hover:text-blue-700">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={path}
        className="font-semibold text-blue-600 underline decoration-blue-200 underline-offset-2 hover:text-blue-700"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  table: ({ children }) => <div className="my-4 max-w-full overflow-x-auto rounded-xl border border-slate-200"><table className="w-full border-collapse text-left text-sm [&_td]:border-b [&_td]:border-slate-200 [&_td]:p-3 [&_th]:bg-slate-100 [&_th]:p-3">{children}</table></div>,
  pre: ({ children }) => <pre className="my-4 max-w-full overflow-x-auto rounded-xl bg-slate-100 p-3 text-sm">{children}</pre>,
  hr: () => <hr className="my-6 border-slate-200" />,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 rounded-r-lg border-l-4 border-blue-200 bg-blue-50/60 py-2 pl-4 text-slate-700">
      {children}
    </blockquote>
  ),
};

export default function JobDescriptionContent({ markdown, className = '' }) {
  const content = sanitizeJobDescriptionForDisplay(markdown);
  if (!content) {
    return null;
  }

  return (
    <div className={`job-description-markdown min-w-0 [overflow-wrap:anywhere] [&_img]:max-w-full [&_img]:h-auto ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
