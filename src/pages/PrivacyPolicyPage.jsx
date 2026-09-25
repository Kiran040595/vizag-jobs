import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';
import {
  SITE_CONTACT_EMAIL,
  SITE_DATA_FIDUCIARY_NAME,
  SITE_GRIEVANCE_OFFICER_NAME,
  SITE_LEGAL_NAME,
  SITE_LOCATION_DISPLAY,
  SITE_PUBLISHER_NAME,
} from '../lib/siteLegal';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      seoTitle="Privacy Policy | Jobs in Vizag"
      description="Privacy Policy for JobsInVizag.in — accounts, applications, cookies, advertising, and your rights under India's DPDP Act."
      canonical="/privacy-policy"
    >
      <p>
        This Privacy Policy describes how {SITE_LEGAL_NAME} (&quot;we,&quot; &quot;our,&quot; &quot;us&quot;), operated by{' '}
        {SITE_PUBLISHER_NAME} from {SITE_LOCATION_DISPLAY}, collects and uses personal data. For registered
        accounts and applications, we process data based on your consent and to provide the service you
        requested. Browsing public pages does not, by itself, mean you have agreed to optional analytics or
        advertising.
      </p>
      <p>
        Under India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Act), {SITE_DATA_FIDUCIARY_NAME} is
        the Data Fiduciary for this website.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. Information We Collect</h2>

        <h3 className="text-lg font-semibold text-slate-800">Information you provide directly</h3>
        <p>
          Most visitors can browse job listings without creating an account. If you contact us, register, or
          apply, we may collect:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Name, email address, and phone number</li>
          <li>Company and job posting details, if you register as an employer</li>
          <li>
            Student or job-seeker profile details: college, degree, branch, graduation year, skills,
            certifications, fresher status, resume files you upload, and contact information
          </li>
          <li>Application answers and messages you submit for a role</li>
          <li>Any messages you send us by email or through our Contact or Feedback pages</li>
        </ul>
        <p>Account and application data is stored using Supabase, our backend data platform.</p>

        <h3 className="text-lg font-semibold text-slate-800">Information collected automatically</h3>
        <p>When you visit our site, hosting and security systems may automatically collect:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>IP address and approximate location derived from it</li>
          <li>Browser type and device information</li>
          <li>Pages visited, time spent, and referring site</li>
          <li>Essential local storage (for example saved jobs) and, if you consent, analytics or advertising cookies (see Section 4)</li>
        </ul>

        <h3 className="text-lg font-semibold text-slate-800">Job listing information</h3>
        <p>
          {SITE_LEGAL_NAME} hosts jobs posted by employers on our portal. We may also display summaries of
          publicly advertised local openings so job seekers can discover more Visakhapatnam roles. Those
          summaries may include role title, company name, location, and a description. Original listing content
          remains the property of the employer or original publisher. See our{' '}
          <Link to="/disclaimer" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Disclaimer
          </Link>{' '}
          and{' '}
          <Link to="/terms-of-service" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Terms of Service
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. How We Use Your Information</h2>
        <p>We use collected information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Operate and improve the job portal</li>
          <li>Respond to inquiries submitted through Contact or Feedback</li>
          <li>Manage employer accounts and job postings</li>
          <li>Process on-site job applications and show applicants their application status</li>
          <li>
            Share relevant candidate details with employers for roles students have applied to, or where the
            student agreed during registration to be considered for matching roles
          </li>
          <li>Review listings that are reported as outdated, misleading, or unlawful</li>
          <li>Analyze site usage if you accept analytics cookies</li>
          <li>Display advertising if you accept advertising cookies (see Section 4)</li>
        </ul>
        <p>
          We do not sell your personal information. Advertising, if enabled, is delivered by Google and similar
          partners under their own policies, only after you accept advertising cookies.
        </p>
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
                <td className="px-4 py-3 text-slate-700">
                  Database, file storage, and authentication for employer accounts, student accounts, and
                  applications. Processing may occur outside India.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Vercel</td>
                <td className="px-4 py-3 text-slate-700">Website hosting and delivery</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Vercel Analytics</td>
                <td className="px-4 py-3 text-slate-700">
                  Anonymous traffic and page-view analytics, loaded only if you accept analytics cookies
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Google AdSense</td>
                <td className="px-4 py-3 text-slate-700">
                  Displays advertising after you accept advertising cookies. Google may set its own cookies.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Google Gemini / related AI tools</td>
                <td className="px-4 py-3 text-slate-700">
                  Optional tools our team may use to summarize public job ads, draft SEO text, or power the
                  on-site help chat. Do not send passwords or sensitive identity documents through chat.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">Apify / Firecrawl</td>
                <td className="px-4 py-3 text-slate-700">
                  Optional research tools our team may use when featuring additional publicly advertised local
                  jobs
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          These processors have their own privacy practices. Review Google&apos;s Privacy Policy at{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-cyan-700 hover:text-cyan-800"
          >
            https://policies.google.com/privacy
          </a>
          . By creating an account you understand that necessary hosting and database providers (currently
          Vercel and Supabase) process data to run the service, which may include servers outside India.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. Cookies and Advertising</h2>
        <p>
          We use a cookie preference banner. Essential storage is needed for core features such as saved jobs.
          Analytics and advertising are off until you choose Accept all or enable those categories.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Google AdSense JavaScript and personalized ad units load only after you accept advertising cookies.
            You can change this later via Cookie settings in the footer.
          </li>
          <li>
            Google, as a third-party vendor, uses cookies (including advertising cookies) to serve ads based on
            your visits to this site and other sites.
          </li>
          <li>
            You may also opt out of personalized advertising at{' '}
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
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">5. Sharing with Employers</h2>
        <p>
          If you apply on-site, we share the application and relevant profile details with the employer for that
          role. If you also consented at registration to be considered for matching roles, we may share a
          limited profile (name, college, degree, branch, skills, certifications, graduation year, phone, and
          email) with employers and recruiters hiring in Visakhapatnam. You can withdraw that consent by
          contacting us; we will stop new sharing, but employers who already received your details remain
          responsible for how they handle that copy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">6. How Long We Keep Data</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account and profile data: until you ask us to delete or deactivate the account, unless we must keep a record of a dispute or legal claim.</li>
          <li>Applications: while the related job is active and for a reasonable period afterward so you and the employer can see status history.</li>
          <li>Contact and feedback messages: as needed to respond and keep a support record.</li>
          <li>Job listings: unpublished or stale listings are removed from public view on a regular schedule.</li>
          <li>Cookie preferences: stored in your browser until you clear site data or update Cookie settings.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">7. Data Security</h2>
        <p>
          We take reasonable technical and organizational measures to protect your information, including
          authenticated access controls and secure storage via Supabase. No method of transmission or storage
          is 100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">8. Your Rights (including DPDP)</h2>
        <p>Depending on applicable law, you may have the right to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your account and personal data</li>
          <li>Withdraw consent for optional processing (including employer matching and advertising cookies)</li>
          <li>Nominate someone to exercise these rights in the event of death or incapacity, as the DPDP Act allows</li>
        </ul>
        <p>
          Email{' '}
          <a href={`mailto:${SITE_CONTACT_EMAIL}?subject=${encodeURIComponent('Privacy / data request (DPDP)')}`} className="font-semibold text-cyan-700 hover:text-cyan-800">
            {SITE_CONTACT_EMAIL}
          </a>{' '}
          or use the{' '}
          <Link to="/contact?topic=privacy-request" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Contact
          </Link>{' '}
          page. We aim to respond within a reasonable period and, for urgent takedown or privacy requests,
          faster where practical.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">9. Grievance Officer</h2>
        <p>
          For complaints about personal data or this policy, contact our Grievance Officer:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Name: {SITE_GRIEVANCE_OFFICER_NAME}</li>
          <li>
            Email:{' '}
            <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold text-cyan-700 hover:text-cyan-800">
              {SITE_CONTACT_EMAIL}
            </a>
          </li>
          <li>Location: {SITE_LOCATION_DISPLAY}</li>
        </ul>
        <p>We aim to acknowledge grievances and revert with an update within a reasonable period.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">10. Children&apos;s Privacy</h2>
        <p>
          {SITE_LEGAL_NAME} is not directed at individuals under 18. We do not knowingly collect personal
          information from minors. Student registration requires confirmation that you are 18 or older.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with an
          updated &quot;Last updated&quot; date.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">12. Contact Us</h2>
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
