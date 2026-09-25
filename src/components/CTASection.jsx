import { Link } from 'react-router-dom';

import { useEmployerAuth } from '../hooks/useEmployerAuth';
import { SITE_CONTACT_EMAIL } from '../lib/siteLegal';

const emailSubscribeHref = `mailto:${SITE_CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Subscribe to Vizag job alerts',
)}&body=${encodeURIComponent(
  'Hi,\n\nPlease add me to job alert updates for Visakhapatnam.\n\nMy email:\nPreferred categories (IT, fresher, etc.):\n',
)}`;

export default function CTASection() {
  const { isEmployer, session } = useEmployerAuth();

  const employerHref = !session
    ? '/employer/register'
    : isEmployer
      ? '/employer/jobs/new'
      : '/employer/login';
  const employerLabel = !session
    ? 'Post a Job'
    : isEmployer
      ? 'Post a Job'
      : 'Employer sign in';

  return (
    <section>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Are you an Employer?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Post your job and reach skilled candidates in Visakhapatnam.
          </p>
          <Link
            to={employerHref}
            className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            {employerLabel}
          </Link>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Stay Updated with Vizag Jobs</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Get the latest job updates by email or browse new openings anytime.
          </p>
          <div className="mt-5 flex flex-nowrap items-center gap-3 overflow-x-auto">
            <a
              href={emailSubscribeHref}
              className="inline-flex whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              Subscribe by Email
            </a>
            <Link
              to="/jobs"
              className="inline-flex whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
            >
              Browse Latest Jobs
            </Link>
            <a
              href="https://www.instagram.com/channel/Abb3Uh4CEdmuzv6D/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-current"
              >
                <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.15 0-3.52.01-4.76.07-.9.04-1.39.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.32-.28.81-.32 1.71-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.04.9.19 1.39.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.13.81.28 1.71.32 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c.9-.04 1.39-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.32.28-.81.32-1.71.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.04-.9-.19-1.39-.32-1.71a2.85 2.85 0 0 0-.69-1.06 2.85 2.85 0 0 0-1.06-.69c-.32-.13-.81-.28-1.71-.32-1.24-.06-1.61-.07-4.76-.07Zm0 2.76a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 1.62a3.68 3.68 0 1 0 0 7.36 3.68 3.68 0 0 0 0-7.36Zm5.5-2.9a1.24 1.24 0 1 1 0 2.48 1.24 1.24 0 0 1 0-2.48Z" />
              </svg>
              Join our Instagram
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
