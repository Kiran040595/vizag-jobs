import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import { SITE_CONTACT_EMAIL, SITE_LEGAL_NAME, SITE_PUBLISHER_NAME } from '../lib/siteLegal';

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      seoTitle="Terms of Service | Jobs in Vizag"
      description="Terms of Service for JobsInVizag.in — employer posting, student applications, featured public job ads, and platform rules."
      canonical="/terms-of-service"
    >
      <p>
        Welcome to {SITE_LEGAL_NAME}, operated by {SITE_PUBLISHER_NAME}. By accessing or using our website, you
        agree to these Terms of Service. If you do not agree, do not use the site. Creating an account requires
        a separate, explicit agreement to these Terms and the Privacy Policy.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. About JobsInVizag.in</h2>
        <p>
          {SITE_LEGAL_NAME} is a job portal focused on opportunities in and around Visakhapatnam. Employers
          can post openings. Students and job seekers can apply on our website and track application status.
          We also feature selected local jobs, including summaries of publicly advertised openings, and publish
          guides on category pages and the blog.
        </p>
        <p>
          We are an independent platform. We are not affiliated with Naukri, LinkedIn, Indeed, or other
          third-party job boards unless we say so on a specific page.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. We Are Not the Employer</h2>
        <p>
          {SITE_LEGAL_NAME} provides the platform for posting, discovering, and applying. Unless explicitly
          stated otherwise, we are not the hiring employer for listed roles. We are not responsible for hiring
          decisions, interviews, working conditions, or compensation.
        </p>
        <p>Listings on the site may include:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Jobs posted by employers on our portal, and</li>
          <li>
            Featured local openings we publish so job seekers can discover more Visakhapatnam roles, which may
            be summaries of publicly advertised jobs with a link to the original posting where available
          </li>
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
          You are responsible for using your own judgment when applying. Legitimate employers do not typically
          ask candidates to pay money as part of hiring. If a listing asks for payment, OTP/UPI details, or
          anything that feels off, do not proceed — and report it via the{' '}
          <Link to="/contact?topic=listing-report" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Contact
          </Link>{' '}
          page or the Report this listing link on the job page.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. Accounts, Applications, and Employer Posts</h2>
        <p>
          Job seekers can browse many listings without an account. To apply on-site and track status, candidates
          may need to register. Some listings still link to an external apply page.
        </p>
        <p>If you register as an employer, you agree to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate company and job information</li>
          <li>Post only genuine openings you are authorized to advertise</li>
          <li>Keep your login credentials secure</li>
          <li>
            Handle candidate data from applications lawfully (including India&apos;s DPDP Act): use it only for
            recruitment for the roles concerned, keep it secure, and delete it when no longer needed
          </li>
          <li>Be responsible for activity under your account</li>
        </ul>
        <p>
          If you register as a student or job seeker, you agree to provide accurate profile information and use
          application features only for genuine job interest.
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
          <li>Scrape, copy, or republish our original site content or tools without permission</li>
          <li>Attempt to disrupt or interfere with site functionality</li>
          <li>Post false, misleading, or fraudulent job listings</li>
          <li>Upload malware, or collect other users&apos; data without authorization</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">6. Intellectual Property and Listings</h2>
        <p>
          Original content on {SITE_LEGAL_NAME} — including site design, tools, and our written guides — is
          owned by {SITE_LEGAL_NAME} unless otherwise noted. Job listing content remains the property of the
          posting employer or original rights holder. We do not claim ownership of third-party job ads.
        </p>
        <p>
          If you believe content on this site infringes your copyright or trademark, email{' '}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold text-cyan-700 hover:text-cyan-800">
            {SITE_CONTACT_EMAIL}
          </a>{' '}
          with the URL, a description of the work, and your contact details. We will review and may remove or
          update the listing.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">7. Platform Role and Takedown</h2>
        <p>
          We host user-submitted posts, applications, questions, and feedback. We may also feature summaries of
          publicly advertised jobs. We do not pre-screen every item for legality. If you notify us of unlawful,
          fraudulent, or infringing material, we will review it and may remove it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">8. Third-Party Links and Advertising</h2>
        <p>
          Our site may display advertisements through Google AdSense (when you accept advertising cookies) and
          contains links to third-party websites, including employer apply pages. We are not responsible for
          the content, accuracy, or practices of external sites or advertisers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">9. Limitation of Liability</h2>
        <p>
          {SITE_LEGAL_NAME} is provided on an &quot;as is&quot; basis. To the fullest extent permitted by law,
          we are not liable for any damages, losses, or issues arising from your use of the site, including
          reliance on job listing information, interactions with employers, or use of any third-party tools
          linked from our platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">10. Changes to These Terms</h2>
        <p>
          We may revise these Terms from time to time. Continued use of the site after changes are posted
          constitutes acceptance of the updated Terms for browsing. Material changes to how we handle account
          data will be reflected in the Privacy Policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of India, with jurisdiction resting in the courts of
          Visakhapatnam, Andhra Pradesh.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">12. Contact Us</h2>
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
