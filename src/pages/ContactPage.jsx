import { Link, useSearchParams } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import { buildContactMailto, PRIVACY_REQUEST_TOPIC, readContactRequest } from '../lib/listingReport';
import {
  SITE_CONTACT_EMAIL,
  SITE_GRIEVANCE_OFFICER_NAME,
  SITE_LEGAL_NAME,
  SITE_LOCATION_DISPLAY,
  SITE_PUBLISHER_NAME,
} from '../lib/siteLegal';

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const request = readContactRequest(searchParams);
  const mailto = buildContactMailto({
    email: SITE_CONTACT_EMAIL,
    topic: request.topic,
    jobTitle: request.jobTitle,
    jobPath: request.jobPath,
    jobId: request.jobId,
  });

  return (
    <LegalPageLayout
      title="Contact Us"
      seoTitle="Contact | Jobs in Vizag"
      description={`Contact ${SITE_LEGAL_NAME} in ${SITE_LOCATION_DISPLAY} for listing corrections, privacy requests, employer posting help, or general enquiries.`}
      canonical="/contact"
      showLastUpdated={false}
    >
      <p>
        We welcome questions about employer job posting, student applications, listing corrections, privacy
        requests, or general feedback on {SITE_LEGAL_NAME}. If you found an incorrect listing, want a job
        removed, or need account help, please reach out.
      </p>

      {request.isListingReport ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Listing report</h2>
          <p className="mt-2 text-sm text-slate-700">
            Use the email button below so we can review this listing for scam, outdated, misleading, or
            copyright concerns.
          </p>
          {request.jobTitle ? (
            <p className="mt-3 text-sm text-slate-700">
              <span className="font-semibold">Job:</span> {request.jobTitle}
            </p>
          ) : null}
          {request.jobPath ? (
            <p className="mt-1 break-all text-sm text-slate-700">
              <span className="font-semibold">Page:</span> {request.jobPath}
            </p>
          ) : null}
        </section>
      ) : null}

      {request.isPrivacyRequest ? (
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Privacy / data request</h2>
          <p className="mt-2 text-sm text-slate-700">
            Tell us whether you want access, correction, deletion, or withdrawal of consent, and the email used
            on this site.
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Publisher details</h2>
        <dl className="mt-4 space-y-3 text-sm sm:text-base">
          <div>
            <dt className="font-semibold text-slate-900">Operator / Data Fiduciary</dt>
            <dd className="mt-1 text-slate-700">{SITE_PUBLISHER_NAME}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Grievance Officer</dt>
            <dd className="mt-1 text-slate-700">{SITE_GRIEVANCE_OFFICER_NAME}</dd>
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
          <a href={mailto} className="text-lg font-semibold text-cyan-700 hover:text-cyan-800">
            {SITE_CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-3 text-sm text-slate-600">
          We aim to respond within 2–3 business days. For urgent listing takedown or privacy requests, include
          the job URL or account email and the reason in your subject line.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">What to include</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Wrong, outdated, or scam job</strong> — Link to the job page on our site and, if possible,
            the original source URL. You can also use Report this listing on the job page.
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
            <Link
              to={`/contact?topic=${PRIVACY_REQUEST_TOPIC}`}
              className="font-semibold text-cyan-700 hover:text-cyan-800"
            >
              privacy request
            </Link>{' '}
            note and the{' '}
            <Link to="/privacy-policy" className="font-semibold text-cyan-700 hover:text-cyan-800">
              Privacy Policy
            </Link>
            .
          </li>
        </ul>
      </section>

      <p className="text-sm text-slate-600">
        {SITE_LEGAL_NAME} is an independent Visakhapatnam job portal operated by {SITE_PUBLISHER_NAME} from{' '}
        {SITE_LOCATION_DISPLAY}. We are not the hiring employer for listings on this site. See our{' '}
        <Link to="/disclaimer" className="font-semibold text-cyan-700 hover:text-cyan-800">
          Disclaimer
        </Link>{' '}
        for more information.
      </p>
    </LegalPageLayout>
  );
}
