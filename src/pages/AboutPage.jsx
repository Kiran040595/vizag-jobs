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
      description="Learn who runs JobsInVizag.in — an independent job board for Visakhapatnam, operated from Andhra Pradesh, India."
      canonical="/about"
      showLastUpdated={false}
    >
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Welcome to JobsInVizag.in</h2>
        <p>
          {SITE_LEGAL_NAME} is a regional job portal built for one purpose: making it easier for people in
          Visakhapatnam to find genuine, relevant job opportunities — without wading through national job
          boards that bury local listings under thousands of irrelevant results.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Why We Started</h2>
        <p>
          Vizag has a growing job market across IT, manufacturing, government, healthcare, and local
          businesses — but most large job platforms aren&apos;t built with this city in mind. Listings get
          lost, search filters don&apos;t reflect local context, and job seekers end up scrolling endlessly
          to find roles that are actually based here.
        </p>
        <p>
          {SITE_LEGAL_NAME} was created to fix that: a focused, easy-to-use platform where every listing is
          relevant to Vizag and the surrounding region.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">What We Do</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Curated local listings</strong> — We gather job openings from across the web and present
            them in one place, organized specifically for Vizag job seekers.
          </li>
          <li>
            <strong>Original local guides</strong> — We publish category pages and blog articles about the
            Vizag job market, written for local job seekers.
          </li>
          <li>
            <strong>Focused discovery</strong> — Filters and categories help you find IT, fresher, part-time,
            and other roles relevant to Visakhapatnam faster than on national job boards.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">How We Source Listings</h2>
        <p>
          We use a combination of automated tools and manual review to gather job postings from publicly
          available sources across the internet. We do not act as the employer for any listing on this site
          — see our <Link to="/disclaimer" className="font-semibold text-cyan-700 hover:text-cyan-800">Disclaimer</Link>{' '}
          page for full details on how this works.
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
          We are not a recruitment agency or employer for the listings shown here — we aggregate publicly
          available openings and present them in a format tailored to local job seekers.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Get in Touch</h2>
        <p>
          Have feedback, a job to post, or found an issue with a listing? Visit our{' '}
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
