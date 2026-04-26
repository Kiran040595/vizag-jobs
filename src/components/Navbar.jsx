import { useState } from 'react';

const navLinks = ['Home', 'Jobs', 'Companies', 'Categories', 'Blogs', 'Contact'];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <a href="#" className="shrink-0 text-xl font-extrabold tracking-tight text-blue-700 sm:text-2xl">
          VizagJobs
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm font-medium text-slate-700 transition-colors duration-200 hover:text-blue-700"
            >
              {link}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Post a Job
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Login / Register
          </button>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? (
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      <div
        className={`overflow-hidden border-t border-slate-200 bg-white transition-all duration-300 md:hidden ${
          isOpen ? 'max-h-[440px]' : 'max-h-0'
        }`}
      >
        <nav className="mx-auto flex w-full max-w-7xl flex-col px-4 py-2.5 sm:px-6">
          {navLinks.map((link) => (
            <a
              key={link}
              href="#"
              className="rounded-md px-2.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-blue-700"
            >
              {link}
            </a>
          ))}

          <div className="mt-3 flex flex-col gap-2 pb-3">
            <button
              type="button"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Post a Job
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-600 hover:text-blue-700"
            >
              Login / Register
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
