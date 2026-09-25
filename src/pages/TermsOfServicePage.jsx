import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import { SITE_CONTACT_EMAIL, SITE_LEGAL_NAME } from '../lib/siteLegal';

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      seoTitle="Terms of Service | Jobs in Vizag"
      description="Terms of Service for JobsInVizag.in — employer posting, student applications, featured jobs, and platform responsibilities."
      canonical="/terms-of-service"
    >
      <p>
        Welcome to {SITE_LEGAL_NAME}. By accessing or using our website, you agree to be bound by these Terms
        of Service. If you do not agree, please do not use the site.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. About JobsInVizag.in</h2>
        <p>
          {SITE_LEGAL_NAME} is a job portal focused on opportunities in and around Visakhapatnam. Employers
          post openings based on their requirements; students and job seekers can apply on our website and
          track application status in their account. We also feature selected local jobs and publish guides on
          our category pages and blog.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. We Are Not the Employer</h2>
        <p>
          {SITE_LEGAL_NAME} provides the platform for posting and applying. Unless explicitly stated otherwise,
          we are not the hiring employer for listed roles. We are not responsible for hiring decisions,
          interview processes, working conditions, or compensation related to any listed job.
        </p>
        <p>Listings on the site may include:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Jobs posted by employers on our portal, and</li>
          <li>Featured local openings we publish to help job seekers discover more roles</li>
        </ul>
        <p>
          Employers are responsible for the accuracy of their postings. We make reasonable efforts to keep the
          site useful, but we do not guarantee that any listing is accurate, complete, currently open, or
          legitimate. Always verify details with the employer before sharing sensitive personal information.
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
        <h2 className="text-xl font-bold text-slate-900">4. Accounts, Applications, and Employer Posts</h2>
        <p>
          Job seekers can browse many listings without an account. To apply on-site and track application
          status, students and candidates may need to register. For supported listings, applications are
          submitted through {SITE_LEGAL_NAME}; some listings may still link to an external apply page.
        </p>
        <p>If you register as an employer, you agree to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate company and job information</li>
          <li>Post only genuine openings you are authorized to advertise</li>
          <li>Keep your login credentials secure</li>
          <li>Handle candidate data from applications lawfully and respectfully</li>
          <li>Be responsible for activity under your account</li>
        </ul>
        <p>
          If you register as a student or job seeker, you agree to provide accurate profile information and
          use the application features only for genuine job interest.
        </p>
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
          owned by {SITE_LEGAL_NAME} unless otherwise noted. Job listing content remains the property of the
          posting employer or original rights holder.
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
