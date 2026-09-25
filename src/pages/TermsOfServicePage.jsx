import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import { SITE_CONTACT_EMAIL, SITE_LEGAL_NAME } from '../lib/siteLegal';

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      seoTitle="Terms of Service | Jobs in Vizag"
      description="Terms of Service for using JobsInVizag.in — rules, responsibilities, and limitations."
      canonical="/terms-of-service"
    >
      <p>
        Welcome to {SITE_LEGAL_NAME}. By accessing or using our website, you agree to be bound by these Terms
        of Service. If you do not agree, please do not use the site.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. About JobsInVizag.in</h2>
        <p>
          {SITE_LEGAL_NAME} is a job listing platform focused on opportunities in and around Visakhapatnam. We
          aggregate job postings from publicly available sources and, in some cases, directly from employers,
          and publish original guides on our category pages and blog to help local job seekers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. We Are Not the Employer</h2>
        <p>
          {SITE_LEGAL_NAME} is not a recruitment agency or employer for the vast majority of listings on this
          site. We do not directly hire for the positions shown, and we are not responsible for hiring
          decisions, interview processes, working conditions, or compensation related to any listed job.
        </p>
        <p>Job data is sourced through:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Automated aggregation tools (including Apify and Firecrawl), and</li>
          <li>Manual research and, where applicable, direct employer submissions</li>
        </ul>
        <p>
          We make reasonable efforts to keep listings accurate and current, but we do not guarantee that any
          listing is accurate, complete, currently open, or legitimate. Always verify details directly with
          the employer before applying or sharing personal information.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">3. No Guarantee Against Scams</h2>
        <p>
          While we are building tools to help flag suspicious postings, you are responsible for using your own
          judgment when applying to any job. Legitimate employers do not typically ask candidates to pay money
          as part of the hiring process. If a listing asks for payment, sensitive financial information, or
          anything that feels off, do not proceed — and please report it to us via the{' '}
          <Link to="/contact" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Contact
          </Link>{' '}
          page.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. Employer Accounts</h2>
        <p>
          Job seekers can browse listings without an account. Applications are made on employer or third-party
          sites linked from each listing. If you register as an employer, you agree to:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate information</li>
          <li>Keep your login credentials secure</li>
          <li>Be responsible for activity under your account</li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate these Terms or are used for
          fraudulent or abusive activity.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use the site for unlawful purposes</li>
          <li>Scrape, copy, or republish our content or listings without permission</li>
          <li>Attempt to disrupt or interfere with site functionality</li>
          <li>Post false, misleading, or fraudulent job listings (if you are an employer/poster)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">6. Intellectual Property</h2>
        <p>
          All original content on {SITE_LEGAL_NAME} — including site design, tools, and written content — is
          owned by {SITE_LEGAL_NAME} unless otherwise noted. Job listing content remains the property of its
          original source/employer.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">7. Third-Party Links and Advertising</h2>
        <p>
          Our site may display advertisements through Google AdSense and contains links to third-party
          websites, including employer apply pages. We are not responsible for the content, accuracy, or
          practices of external sites or advertisers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">8. Limitation of Liability</h2>
        <p>
          {SITE_LEGAL_NAME} is provided on an &quot;as is&quot; basis. To the fullest extent permitted by
          law, we are not liable for any damages, losses, or issues arising from your use of the site,
          including but not limited to reliance on job listing information, interactions with employers, or use
          of any third-party tools linked from our platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">9. Changes to These Terms</h2>
        <p>
          We may revise these Terms from time to time. Continued use of the site after changes are posted
          constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">10. Governing Law</h2>
        <p>
          These Terms are governed by the laws of India, with jurisdiction resting in the courts of
          Visakhapatnam, Andhra Pradesh.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">11. Contact Us</h2>
        <p>
          Questions about these Terms? Reach us at{' '}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold text-cyan-700 hover:text-cyan-800">
            {SITE_CONTACT_EMAIL}
          </a>{' '}
          or via our{' '}
          <Link to="/contact" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Contact
          </Link>{' '}
          page.
        </p>
      </section>
    </LegalPageLayout>
  );
}
