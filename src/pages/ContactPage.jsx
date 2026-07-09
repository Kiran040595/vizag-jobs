import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import {
  SITE_CONTACT_EMAIL,
  SITE_LEGAL_NAME,
  SITE_LOCATION_DISPLAY,
  SITE_PUBLISHER_NAME,
} from '../lib/siteLegal';

export default function ContactPage() {
  return (
    <LegalPageLayout
      title="Contact Us"
      seoTitle="Contact | Jobs in Vizag"
      description={`Contact ${SITE_LEGAL_NAME} in ${SITE_LOCATION_DISPLAY} for listing corrections, feedback, partnerships, or general enquiries.`}
      canonical="/contact"
      showLastUpdated={false}
    >
      <p>
        We welcome questions, corrections, and feedback about {SITE_LEGAL_NAME}. If you found an incorrect
        listing, want a job removed, or have a suggestion to improve the site, please reach out.
      </p>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Publisher details</h2>
        <dl className="mt-4 space-y-3 text-sm sm:text-base">
          <div>
            <dt className="font-semibold text-slate-900">Operator</dt>
            <dd className="mt-1 text-slate-700">{SITE_PUBLISHER_NAME}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Website</dt>
            <dd className="mt-1 text-slate-700">{SITE_LEGAL_NAME}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Location</dt>
            <dd className="mt-1 text-slate-700">{SITE_LOCATION_DISPLAY}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Email</h2>
        <p className="mt-2">
          <a
            href={`mailto:${SITE_CONTACT_EMAIL}`}
            className="text-lg font-semibold text-cyan-700 hover:text-cyan-800"
          >
            {SITE_CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-3 text-sm text-slate-600">
          We aim to respond within 2–3 business days. For urgent listing takedown requests, include the job
          URL and reason in your subject line.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">What to include</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Wrong or outdated job</strong> — Link to the job page on our site and, if possible, the
            original source URL.
          </li>
          <li>
            <strong>Copyright or trademark concern</strong> — Your contact details and the specific content
            you believe is affected.
          </li>
          <li>
            <strong>Employer posting</strong> — Company name, role title, and how you&apos;d like the listing
            published or updated.
          </li>
          <li>
            <strong>Privacy request</strong> — See our{' '}
            <Link to="/privacy-policy" className="font-semibold text-cyan-700 hover:text-cyan-800">
              Privacy Policy
            </Link>{' '}
            for data-related requests.
          </li>
        </ul>
      </section>

      <p className="text-sm text-slate-600">
        {SITE_LEGAL_NAME} is an independent job aggregator operated by {SITE_PUBLISHER_NAME} from{' '}
        {SITE_LOCATION_DISPLAY}. We are not the hiring employer for listings on this site. See our{' '}
        <Link to="/disclaimer" className="font-semibold text-cyan-700 hover:text-cyan-800">
          Disclaimer
        </Link>{' '}
        for more information.
      </p>
    </LegalPageLayout>
  );
}
