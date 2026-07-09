import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import { SITE_CONTACT_EMAIL, SITE_LEGAL_NAME } from '../lib/siteLegal';

export default function DisclaimerPage() {
  return (
    <LegalPageLayout
      title="Disclaimer"
      seoTitle="Disclaimer | Jobs in Vizag"
      description="Important disclaimer for JobsInVizag.in — we are not the employer; how job listings are sourced and your responsibilities as a job seeker."
      canonical="/disclaimer"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">We Are Not the Hiring Employer</h2>
        <p>
          {SITE_LEGAL_NAME} is a job listing and aggregation platform.{' '}
          <strong>
            We are not the employer, recruiter, or hiring authority for the listings shown on this site
          </strong>
          , unless explicitly stated otherwise. We do not conduct interviews, make hiring decisions, or handle
          compensation for the roles posted here.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">How Job Listings Are Sourced</h2>
        <p>Listings on {SITE_LEGAL_NAME} come from a combination of:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Automated aggregation</strong> — using tools such as Apify and Firecrawl to gather
            publicly available job postings from across the web
          </li>
          <li>
            <strong>Manual research and curation</strong> — our team reviews and organizes listings for
            relevance to the Vizag job market
          </li>
          <li>
            <strong>Direct submissions</strong> — in some cases, employers may submit openings directly to us
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">No Guarantee of Accuracy</h2>
        <p>
          We make reasonable efforts to keep listings current and accurate, but job postings can change or
          expire without notice on the original source. We do not guarantee that any listing is:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Currently open</li>
          <li>Accurately described</li>
          <li>Free of errors introduced during aggregation</li>
          <li>Legitimate (see below)</li>
        </ul>
        <p>
          <strong>
            Always verify a listing directly with the employer before applying, sharing personal details, or
            attending an interview.
          </strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Protecting Yourself from Job Scams</h2>
        <p>
          Unfortunately, fraudulent job postings exist across the internet, and aggregated listings can
          occasionally include them despite our review process. As a general rule:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Legitimate employers do not ask candidates to pay money to apply, interview, or &quot;secure&quot;
            a role
          </li>
          <li>
            Be cautious of postings with vague company details, unusually high pay for minimal qualifications,
            or requests for sensitive financial information upfront
          </li>
          <li>If something feels off, trust your judgment</li>
        </ul>
        <p>
          If you encounter a listing on {SITE_LEGAL_NAME} that you believe is fraudulent or misleading,
          please report it via our{' '}
          <Link to="/contact" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Contact
          </Link>{' '}
          page so we can review and remove it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">External Links</h2>
        <p>
          Our site may link to external job sources, company websites, or third-party tools. We are not
          responsible for the content, accuracy, or practices of those external sites.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Questions</h2>
        <p>
          For anything related to this Disclaimer, reach us at{' '}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold text-cyan-700 hover:text-cyan-800">
            {SITE_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
