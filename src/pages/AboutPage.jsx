import { Link } from 'react-router-dom';
import LegalPageLayout from '../components/LegalPageLayout';

export default function AboutPage() {
  return (
    <LegalPageLayout
      title="About Us"
      seoTitle="About Us | Jobs in Vizag"
      description="Learn who runs JobsInVizag.in and why we built a focused job board for Visakhapatnam."
      canonical="/about"
      showLastUpdated={false}
    >
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Welcome to JobsInVizag.in</h2>
        <p>
          JobsInVizag.in is a regional job portal built for one purpose: making it easier for people in
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
          JobsInVizag.in was created to fix that: a focused, easy-to-use platform where every listing is
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
        <h2 className="text-xl font-bold text-slate-900">Who&apos;s Behind This</h2>
        <p>
          JobsInVizag.in is run independently, with a focus on serving the Vizag job-seeker community
          directly. We&apos;re a small, hands-on team genuinely invested in making local job searching
          simpler.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Get in Touch</h2>
        <p>
          Have feedback, a job to post, or found an issue with a listing? Visit our{' '}
          <Link to="/contact" className="font-semibold text-cyan-700 hover:text-cyan-800">
            Contact
          </Link>{' '}
          page — we read every message.
        </p>
      </section>
    </LegalPageLayout>
  );
}
