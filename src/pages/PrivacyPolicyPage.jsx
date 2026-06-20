import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import { SITE_CONTACT_EMAIL, SITE_LEGAL_NAME } from '../lib/siteLegal';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      seoTitle="Privacy Policy | Jobs in Vizag"
      description="Privacy Policy for JobsInVizag.in — how we collect, use, and protect your information, including cookies and advertising."
      canonical="/privacy-policy"
    >
      <p>
        {SITE_LEGAL_NAME} (&quot;we,&quot; &quot;our,&quot; &quot;us&quot;) respects your privacy. This Privacy
        Policy explains what information we collect, how we use it, and the choices you have. By using{' '}
        {SITE_LEGAL_NAME}, you agree to the practices described here.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. Information We Collect</h2>

        <h3 className="text-lg font-semibold text-slate-800">Information you provide directly</h3>
        <p>
          Most visitors browse job listings without creating an account. If you contact us or register as an
          employer to post jobs, we may collect:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Name, email address, and phone number</li>
          <li>Company and job posting details, if you register as an employer</li>
          <li>Any messages you send us by email or through our Contact page</li>
        </ul>
        <p>
          This data is stored securely using Supabase, our backend data platform.
        </p>

        <h3 className="text-lg font-semibold text-slate-800">Information collected automatically</h3>
        <p>When you visit our site, we may automatically collect:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>IP address and approximate location</li>
          <li>Browser type and device information</li>
          <li>Pages visited, time spent, and referring site</li>
          <li>Cookies and similar tracking technologies (see Section 4)</li>
        </ul>

        <h3 className="text-lg font-semibold text-slate-800">Job listing data</h3>
        <p>
          {SITE_LEGAL_NAME} aggregates publicly available job listings using automated tools (including Apify
          and Firecrawl) alongside manual review. This data relates to job postings, not to individual site
          visitors. See our{' '}
          <Link to="/disclaimer" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Disclaimer
          </Link>{' '}
          page for more on how listings are sourced.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. How We Use Your Information</h2>
        <p>We use collected information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Operate and improve the job portal (showing relevant local listings)</li>
          <li>Respond to inquiries submitted through our Contact page</li>
          <li>Manage employer accounts and job postings submitted by employers</li>
          <li>Analyze site usage to improve performance and content</li>
          <li>Display relevant advertising through Google AdSense (see Section 4)</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">3. Third-Party Services We Use</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-900">
                  Service
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-900">
                  Purpose
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Supabase</td>
                <td className="px-4 py-3 text-slate-700">Database and authentication for employer accounts</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Vercel</td>
                <td className="px-4 py-3 text-slate-700">Website hosting and delivery</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Vercel Analytics</td>
                <td className="px-4 py-3 text-slate-700">Anonymous traffic and page-view analytics</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Google AdSense</td>
                <td className="px-4 py-3 text-slate-700">Displays advertising on our site</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Apify / Firecrawl</td>
                <td className="px-4 py-3 text-slate-700">
                  Automated tools used by our team to source publicly available job listing data
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Each of these providers has its own privacy practices governing how they handle data. We encourage
          you to review Google&apos;s Privacy Policy at{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-cyan-700 hover:text-cyan-800"
          >
            https://policies.google.com/privacy
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. Cookies and Advertising (Google AdSense)</h2>
        <p>We use cookies to operate the site and to support advertising through Google AdSense.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Google, as a third-party vendor, uses cookies (including the DART cookie) to serve ads based on
            your visits to this site and other sites on the internet.
          </li>
          <li>
            You may opt out of personalized advertising by visiting{' '}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-700 hover:text-cyan-800"
            >
              Google Ads Settings
            </a>{' '}
            or{' '}
            <a
              href="https://www.aboutads.info/choices/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-700 hover:text-cyan-800"
            >
              aboutads.info
            </a>
            .
          </li>
          <li>
            Learn how Google uses data from partner sites at{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-700 hover:text-cyan-800"
            >
              Google&apos;s partner sites policy
            </a>
            .
          </li>
          <li>
            Third-party vendors, including Google, use cookies to serve ads based on a user&apos;s prior visits
            to our website or other websites.
          </li>
          <li>
            You can disable cookies through your browser settings, though some site features may not work
            correctly without them.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">5. Data Security</h2>
        <p>
          We take reasonable technical and organizational measures to protect your information, including
          secure storage via Supabase. However, no method of transmission or storage is 100% secure, and we
          cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">6. Your Rights</h2>
        <p>
          Depending on applicable law (including India&apos;s Digital Personal Data Protection Act, 2023), you
          may have the right to:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Access the personal data we hold about you</li>
          <li>Request correction or deletion of your data</li>
          <li>Withdraw consent for data processing where applicable</li>
        </ul>
        <p>
          To exercise these rights, contact us at{' '}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold text-cyan-700 hover:text-cyan-800">
            {SITE_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">7. Children&apos;s Privacy</h2>
        <p>
          {SITE_LEGAL_NAME} is not directed at individuals under 18. We do not knowingly collect personal
          information from minors.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with an
          updated &quot;Last updated&quot; date.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">9. Contact Us</h2>
        <p>
          Questions about this Privacy Policy? Reach us at{' '}
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
