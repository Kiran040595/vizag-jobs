import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import { SITE_CONTACT_EMAIL, SITE_LEGAL_NAME } from '../lib/siteLegal';

export default function DisclaimerPage() {
  return (
    <LegalPageLayout
      title="Disclaimer"
      seoTitle="Disclaimer | Jobs in Vizag"
      description="Disclaimer for JobsInVizag.in — platform role for employer-posted and featured jobs, and your responsibilities when applying."
      canonical="/disclaimer"
    >
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">We Are Not the Hiring Employer</h2>
        <p>
          {SITE_LEGAL_NAME} is a job portal where employers post openings and candidates can apply on-site.{' '}
          <strong>
            We are not the employer, recruiter, or hiring authority for the listings shown on this site
          </strong>
          , unless explicitly stated otherwise. We do not conduct interviews, make hiring decisions, or handle
          compensation for the roles posted here.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">How Job Listings Appear</h2>
        <p>Listings on {SITE_LEGAL_NAME} come from a combination of:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Employer posts on our portal</strong> — companies create accounts and publish openings
            based on their hiring requirements
          </li>
          <li>
            <strong>Featured local jobs</strong> — roles we feature on the site so job seekers can discover
            more Visakhapatnam opportunities
          </li>
          <li>
            <strong>Manual review</strong> — our team may review listings for relevance and remove suspicious
            or outdated posts when reported
          </li>
        </ul>
        <p>
          Students and job seekers may apply directly on {SITE_LEGAL_NAME} for supported listings and view
          application status in their account. Final hiring decisions remain with the employer.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">No Guarantee of Accuracy</h2>
        <p>
          We make reasonable efforts to keep listings current and accurate, but job postings can change or
          close without notice. We do not guarantee that any listing is:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Currently open</li>
          <li>Accurately described by the posting employer</li>
          <li>Free of errors</li>
          <li>Legitimate (see below)</li>
        </ul>
        <p>
          <strong>
            Always verify a listing directly with the employer before sharing sensitive personal details or
            attending an interview.
          </strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Protecting Yourself from Job Scams</h2>
        <p>
          Fraudulent job postings exist across the internet. Despite review, suspicious listings can
          occasionally appear. As a general rule:
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
