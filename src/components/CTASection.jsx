import { Link } from 'react-router-dom';

import { useEmployerAuth } from '../hooks/useEmployerAuth';
import { SITE_CONTACT_EMAIL, SITE_TELEGRAM_CHANNEL_URL } from '../lib/siteLegal';

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
            Get the latest job updates on Telegram or by email.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {SITE_TELEGRAM_CHANNEL_URL ? (
              <a
                href={SITE_TELEGRAM_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
              >
                Join Telegram
              </a>
            ) : null}
            <a
              href={emailSubscribeHref}
              className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              Subscribe by Email
            </a>
            <Link
              to="/jobs"
              className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              Browse Latest Jobs
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
