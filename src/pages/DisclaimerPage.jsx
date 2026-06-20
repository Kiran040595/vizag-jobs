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
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        Please read this page carefully. It explains what {SITE_LEGAL_NAME} is — and is not — responsible
        for.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">We are not the employer</h2>
        <p>
          {SITE_LEGAL_NAME} is an <strong>independent job information service</strong>. We do not hire
          candidates, conduct interviews, collect application fees on behalf of employers, or make hiring
          decisions. Company names and logos on listings identify the stated employer or source, not us.
        </p>
        <p>
          If a listing looks suspicious (upfront payment, vague contact, too-good-to-be-true salary), verify
          directly with the employer before sharing personal documents or money.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">How listings are sourced</h2>
        <p>Jobs on this Site come from two main paths:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Automated collection</strong> — Our administrators use automated tools to gather
            publicly available postings from third-party job platforms and professional networks (including
            sources such as Naukri and LinkedIn). Collection is performed via licensed or permitted scraping
            services (for example Apify and Firecrawl) and is limited to material that is publicly accessible.
          </li>
          <li>
            <strong>Direct employer submissions</strong> — Registered employers may post jobs directly
            through our platform.
          </li>
        </ul>
        <p>
          In both cases, listings may be edited for clarity, SEO, or formatting before publication. We aim to
          link each listing to an original apply URL or source where possible.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Accuracy and timeliness</h2>
        <p>
          Job markets change quickly. A role may be filled, expired, or modified on the original source before
          we update or remove it here. We do <strong>not</strong> guarantee that any listing is current,
          complete, or still accepting applications.
        </p>
        <p>
          Always confirm details (salary, location, eligibility, deadlines) on the employer&apos;s official
          posting or with their HR team before applying.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">No endorsement</h2>
        <p>
          Inclusion of a company or job on {SITE_LEGAL_NAME} does not mean we endorse that employer, verify
          their legitimacy, or guarantee the quality of the workplace. Listings are displayed for
          informational purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Third-party content and trademarks</h2>
        <p>
          Job descriptions, company names, logos, and apply links may be the property of third parties. We
          display them to help job seekers discover opportunities. If you believe content on our Site
          infringes your rights, contact us with details and we will review promptly.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">External apply links</h2>
        <p>
          When you click &quot;Apply&quot; or similar links, you may leave our Site and interact with a
          third-party website. We are not responsible for those sites&apos; content, security, or privacy
          practices.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Removal requests</h2>
        <p>
          Employers, recruiters, or copyright holders who want a listing corrected or removed should email{' '}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold text-cyan-700 hover:text-cyan-800">
            {SITE_CONTACT_EMAIL}
          </a>{' '}
          with the URL on our Site and a brief explanation. See also our{' '}
          <Link to="/contact" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Contact
          </Link>{' '}
          page.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Limitation of liability</h2>
        <p>
          Use of this Site is at your own risk. To the fullest extent permitted by law, {SITE_LEGAL_NAME} is
          not liable for decisions you make based on listings, for interactions with employers, or for losses
          arising from outdated or inaccurate information. See our{' '}
          <Link to="/terms-of-service" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Terms of Service
          </Link>{' '}
          for additional limitations.
        </p>
      </section>
    </LegalPageLayout>
  );
}
