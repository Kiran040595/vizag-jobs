import { Link } from 'react-router-dom';

import { JOB_BROWSE_LINKS } from '../lib/jobCategoryPages';

const footerGroups = [
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
      { label: 'Contact', to: '/contact' },
      { label: 'Privacy Policy', to: '/privacy-policy' },
      { label: 'Terms of Service', to: '/terms-of-service' },
      { label: 'Disclaimer', to: '/disclaimer' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3 sm:px-6 lg:px-8">
        <div>
          <h3 className="text-xl font-black text-white">JobsInVizag.in</h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
            A focused local job board for Visakhapatnam — IT, civil, mechanical, engineering, fresher, and part-time roles.
          </p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-white">{group.title}</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition hover:text-white">
                    {link.label}
                  </Link>
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
        </p>
      </div>
    </footer>
  );
}
