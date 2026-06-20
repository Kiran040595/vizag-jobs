import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import SEO from './SEO';
import { SITE_LEGAL_LAST_UPDATED } from '../lib/siteLegal';

/**
 * Shared layout for About, Contact, Privacy, Terms, Disclaimer.
 */
export default function LegalPageLayout({
  title,
  seoTitle,
  description,
  canonical,
  showLastUpdated = true,
  children,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/20 to-white">
      <SEO title={seoTitle || title} description={description} canonical={canonical} />
      <Navbar />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <Link to="/" className="font-medium text-cyan-700 hover:text-cyan-800">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700">{title}</span>
        </nav>

        <header className="mt-4 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">{title}</h1>
          {showLastUpdated ? (
            <p className="mt-2 text-sm text-slate-500">Last updated: {SITE_LEGAL_LAST_UPDATED}</p>
          ) : null}
        </header>

        <article className="legal-prose mt-8 space-y-5 text-base leading-7 text-slate-700">{children}</article>
      </main>

      <Footer />
    </div>
  );
}
