import { Link } from 'react-router-dom';

const footerGroups = [
  {
    title: 'Explore',
    links: [
      { label: 'All Jobs', to: '/jobs' },
      { label: 'IT Jobs', to: '/jobs/it' },
      { label: 'Fresher Jobs', to: '/jobs/fresher' },
      { label: 'Part-Time Jobs', to: '/jobs/part-time' },
    ],
  },
  {
    title: 'For Admins',
    links: [
      { label: 'Admin Login', to: '/admin/login' },
      { label: 'Admin Dashboard', to: '/admin' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.2fr_0.8fr_0.8fr] sm:px-6 lg:px-8">
        <div>
          <h3 className="text-xl font-black text-white">VizagJobs</h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
            A focused local job board for Visakhapatnam, covering IT, fresher, part-time, and general private roles.
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
        © {new Date().getFullYear()} VizagJobs. All rights reserved.
      </div>
    </footer>
  );
}
