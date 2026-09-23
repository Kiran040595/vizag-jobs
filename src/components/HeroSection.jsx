import { useState, useEffect } from 'react';
import { CATEGORY_OPTIONS } from '../lib/jobFilters';
import vizagSkylineImage from '../assets/vizag-skyline.webp';

export default function HeroSection({
  searchTerm,
  onSearch,
  onSubmit,
  category: categoryProp,
  onCategoryChange,
  title = 'Find the Right Job in Visakhapatnam',
  subtitle = 'Your one-stop platform for IT, engineering, fresher and experienced jobs in Vizag',
}) {
  const [localCategory, setLocalCategory] = useState('All Categories');
  const category = onCategoryChange ? categoryProp ?? 'All Categories' : localCategory;
  const [location, setLocation] = useState('Visakhapatnam');
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = vizagSkylineImage;
    if (img.complete) {
      setImageLoaded(true);
    } else {
      img.onload = () => setImageLoaded(true);
    }
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onSubmit) {
      // HomePage owns the URL — flush the current input immediately so a
      // pending debounce doesn't drop the search after the user hits Enter.
      onSubmit(searchTerm);
    } else {
      onSearch(searchTerm);
    }
  };

  const handleSelectQuickCategory = (catLabel) => {
    if (onCategoryChange) {
      onCategoryChange(catLabel);
    } else {
      setLocalCategory(catLabel);
    }
  };

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      {/* Background Image layer with smooth fade-in */}
      <div
        className={`pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundImage: `url(${vizagSkylineImage})` }}
      />

      {/* Atmospheric overlays for readability and brand tone */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/80 via-blue-950/70 to-blue-900/65" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.35),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.3),_transparent_35%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center justify-center px-3 py-6 text-center sm:min-h-[26rem] sm:px-6 sm:py-16 lg:px-8">
        <h1 className="max-w-3xl text-2xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-blue-100/90 sm:mt-4 sm:text-base">
            {subtitle}
          </p>
        ) : null}
        <form
          onSubmit={handleSubmit}
          className="mt-4 w-full max-w-5xl rounded-2xl border border-white/30 bg-white/95 p-2 shadow-2xl backdrop-blur sm:mt-8 sm:p-4"
        >
          <div className="grid gap-2 md:grid-cols-[1.7fr_1.2fr_1.2fr_auto] md:gap-3">
            <input
              id="job-title"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Job title, keywords, or company"
              className="h-12 w-full rounded-xl border border-slate-200 px-3.5 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:h-12 md:px-4 md:text-sm"
            />

            <select
              value={category}
              onChange={(event) => {
                const next = event.target.value;
                if (onCategoryChange) onCategoryChange(next);
                else setLocalCategory(next);
              }}
              className="h-12 w-full rounded-xl border border-slate-200 px-3.5 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:h-12 md:px-4 md:text-sm"
              aria-label="Select category"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.label}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="hidden h-12 w-full rounded-xl border border-slate-200 px-3.5 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:block md:h-12 md:px-4 md:text-sm"
              aria-label="Location"
            />

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-blue-600 px-5 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 md:h-12 md:w-auto md:px-6 md:text-sm"
            >
              Search Jobs
            </button>
          </div>
          <p className="mt-2 text-left text-xs font-medium text-slate-500 md:hidden">
            Searching jobs in Visakhapatnam
          </p>
        </form>

        {/* Quick Filter Pills on Mobile */}
        <div className="mt-3 flex w-full max-w-5xl items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none sm:hidden">
          <span className="shrink-0 text-[11px] font-semibold text-blue-200">Quick:</span>
          {[
            { label: 'IT / Software', icon: '💻' },
            { label: 'Fresher', icon: '🎓' },
            { label: 'Banking / Finance', icon: '🏦' },
            { label: 'Civil', icon: '🏗️' },
            { label: 'Mechanical', icon: '⚙️' },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSelectQuickCategory(item.label)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium backdrop-blur transition active:scale-95 ${
                category === item.label
                  ? 'border-cyan-300 bg-cyan-500/30 text-white font-bold'
                  : 'border-white/20 bg-white/10 text-blue-100 hover:bg-white/20'
              }`}
            >
              <span>{item.icon} {item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
