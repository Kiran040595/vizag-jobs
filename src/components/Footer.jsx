import { Link } from 'react-router-dom';
import { useMemo } from 'react';

import { useOptionalCookieConsent } from '../context/CookieConsentContext.jsx';
import { JOB_BROWSE_LINKS } from '../lib/jobCategoryPages';

export default function Footer() {
  const cookieConsent = useOptionalCookieConsent();

  const footerGroups = useMemo(
    () => [
      {
        title: 'Explore',
        links: [
          { label: 'All Jobs', to: '/jobs' },
          { label: 'Saved Jobs', to: '/saved-jobs' },
          { label: 'Blog', to: '/blog' },
          ...JOB_BROWSE_LINKS,
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'About', to: '/about' },
          { label: 'Feedback', to: '/feedback' },
          { label: 'Contact', to: '/contact' },
          { label: 'Privacy Policy', to: '/privacy-policy' },
          { label: 'Terms of Service', to: '/terms-of-service' },
          { label: 'Disclaimer', to: '/disclaimer' },
          ...(cookieConsent ? [{ label: 'Cookie settings', action: cookieConsent.openSettings }] : []),
        ],
      },
    ],
    [cookieConsent],
  );

  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3 sm:px-6 lg:px-8">
        <div>
          <h3 className="text-xl font-black text-white">JobsInVizag.in</h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
            A focused local job board for Visakhapatnam — IT, civil, mechanical, engineering, fresher, and part-time roles.
          </p>
          <a
            href="https://www.instagram.com/channel/Abb3Uh4CEdmuzv6D/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-current"
            >
              <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.15 0-3.52.01-4.76.07-.9.04-1.39.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.32-.28.81-.32 1.71-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.04.9.19 1.39.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.13.81.28 1.71.32 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c.9-.04 1.39-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.32.28-.81.32-1.71.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.04-.9-.19-1.39-.32-1.71a2.85 2.85 0 0 0-.69-1.06 2.85 2.85 0 0 0-1.06-.69c-.32-.13-.81-.28-1.71-.32-1.24-.06-1.61-.07-4.76-.07Zm0 2.76a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 1.62a3.68 3.68 0 1 0 0 7.36 3.68 3.68 0 0 0 0-7.36Zm5.5-2.9a1.24 1.24 0 1 1 0 2.48 1.24 1.24 0 0 1 0-2.48Z" />
            </svg>
            Join our Instagram
          </a>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-white">{group.title}</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {group.links.map((link) => (
                <li key={link.label}>
                  {'action' in link ? (
                    <button
                      type="button"
                      onClick={link.action}
                      className="transition hover:text-white"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link to={link.to} className="transition hover:text-white">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} JobsInVizag.in. All rights reserved.</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link to="/about" className="hover:text-slate-300">
            About
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/contact" className="hover:text-slate-300">
            Contact
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacy-policy" className="hover:text-slate-300">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms-of-service" className="hover:text-slate-300">
            Terms
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/disclaimer" className="hover:text-slate-300">
            Disclaimer
          </Link>
          {cookieConsent ? (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={cookieConsent.openSettings}
                className="hover:text-slate-300"
              >
                Cookie settings
              </button>
            </>
          ) : null}
        </p>
      </div>
    </footer>
  );
}
