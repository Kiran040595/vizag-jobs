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
  p: ({ children }) => <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-[15px]">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700 sm:text-[15px]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-700 sm:text-[15px]">{children}</ol>
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
    <div className={`job-description-markdown ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
