import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import {
  SITE_CONTACT_EMAIL,
  SITE_LEGAL_NAME,
  SITE_LOCATION_CITY,
  SITE_LOCATION_DISPLAY,
  SITE_PUBLISHER_NAME,
} from '../lib/siteLegal';

export default function AboutPage() {
  return (
    <LegalPageLayout
      title="About Us"
      seoTitle="About Us | Jobs in Vizag"
      description="JobsInVizag.in is a Visakhapatnam job portal where employers post openings, students apply on-site, track application status, and browse featured local jobs."
      canonical="/about"
      showLastUpdated={false}
    >
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Welcome to JobsInVizag.in</h2>
        <p>
          {SITE_LEGAL_NAME} is a regional job portal for Visakhapatnam. Employers post openings based on
          their hiring requirements, and students and job seekers apply directly on our website — then track
          the status of those applications in their account.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Why We Started</h2>
        <p>
          Vizag has a growing job market across IT, manufacturing, healthcare, and local businesses — but
          many platforms are not built around this city. Candidates struggle to find local roles, and
          employers need a simple place to post requirements and receive applications.
        </p>
        <p>
          {SITE_LEGAL_NAME} was created to fix that: a focused platform where companies can post jobs for
          Vizag, candidates can apply on-site, and both sides stay connected through clear application
          status.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">What We Do</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Employer job posting</strong> — Companies post openings on our portal according to their
            requirements for Visakhapatnam roles.
          </li>
          <li>
            <strong>On-site student applications</strong> — Job seekers register, apply directly on{' '}
            {SITE_LEGAL_NAME}, and view the status of applied jobs in their account.
          </li>
          <li>
            <strong>Featured local jobs</strong> — We feature employer-posted roles (and other relevant local
            openings) so candidates can discover opportunities across IT, engineering, fresher, and more.
          </li>
          <li>
            <strong>Original local guides</strong> — We publish category pages and blog articles about the
            Vizag job market for local job seekers.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">How Listings Appear on the Site</h2>
        <p>
          Most active hiring on {SITE_LEGAL_NAME} is driven by employers who post jobs on our portal. We also
          feature selected local openings to help job seekers browse more opportunities. We are not the
          hiring employer for those roles — see our{' '}
          <Link to="/disclaimer" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Disclaimer
          </Link>{' '}
          for details.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Who Runs This Site</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <dl className="space-y-3 text-sm sm:text-base">
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
            <div>
              <dt className="font-semibold text-slate-900">Email</dt>
              <dd className="mt-1">
                <a
                  href={`mailto:${SITE_CONTACT_EMAIL}`}
                  className="font-semibold text-cyan-700 hover:text-cyan-800"
                >
                  {SITE_CONTACT_EMAIL}
                </a>
              </dd>
            </div>
          </dl>
        </div>
        <p>
          {SITE_LEGAL_NAME} is operated independently by {SITE_PUBLISHER_NAME}, based in {SITE_LOCATION_CITY}.
          We provide the platform for posting, applying, and tracking applications; hiring decisions remain
          with the employer.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Get in Touch</h2>
        <p>
          Have feedback, want to post a job, or need help with an application? Visit our{' '}
          <Link to="/contact" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Contact
          </Link>{' '}
          page or email{' '}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold text-cyan-700 hover:text-cyan-800">
            {SITE_CONTACT_EMAIL}
          </a>{' '}
          — we read every message.
        </p>
      </section>
    </LegalPageLayout>
  );
}
