import { useState, useEffect, useRef } from 'react';
import { CATEGORY_OPTIONS } from '../lib/jobFilters';
import vsp2Image from '../assets/VSP2.jpg';
import vsp1Image from '../assets/VSP1.jpg';

export default function HeroSection({
  searchTerm,
  onSearch,
  onSubmit,
  category: categoryProp,
  onCategoryChange,
}) {
  const [localCategory, setLocalCategory] = useState('All Categories');
  const category = onCategoryChange ? categoryProp ?? 'All Categories' : localCategory;
  const [location, setLocation] = useState('Visakhapatnam');
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !imagesLoaded) {
            // Preload images when section comes into view
            const img1 = new Image();
            const img2 = new Image();

            let loadedCount = 0;
            const onImageLoad = () => {
              loadedCount++;
              if (loadedCount === 2) {
                setImagesLoaded(true);
              }
            };

            img1.onload = onImageLoad;
            img2.onload = onImageLoad;

            img1.src = vsp2Image;
            img2.src = vsp1Image;

            observer.disconnect(); // Stop observing once images start loading
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% of the section is visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [imagesLoaded]);

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

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden text-white"
      style={imagesLoaded ? {
        backgroundImage: `url(${vsp2Image}), url(${vsp1Image})`,
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat, no-repeat'
      } : {}}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/75 via-blue-950/65 to-blue-900/60" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.35),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.3),_transparent_35%)]" />
      <div className="relative mx-auto flex min-h-[18rem] w-full max-w-6xl flex-col items-center justify-center px-3 py-8 text-center sm:min-h-[24rem] sm:px-6 sm:py-14 lg:min-h-[28rem] lg:px-8 lg:py-20">
        <h1 className="max-w-3xl text-[1.65rem] font-extrabold leading-tight sm:text-4xl lg:text-5xl lg:leading-[1.15]">
          Find the Right Job in Visakhapatnam
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100 sm:mt-4 sm:text-base lg:text-lg">
          Your one-stop platform for IT, engineering, fresher and experienced jobs in Vizag
        </p>
        <form
          onSubmit={handleSubmit}
          className="mt-5 w-full max-w-5xl rounded-2xl border border-white/30 bg-white/95 p-2.5 shadow-2xl backdrop-blur sm:mt-8 sm:p-4 lg:mt-10 lg:p-5"
        >
          <div className="grid gap-2 md:grid-cols-[1.8fr_1.15fr_1.15fr_auto] md:gap-3 lg:gap-3.5">
            <input
              id="job-title"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Job title, keywords, or company"
              className="h-12 w-full rounded-xl border border-slate-200 px-3.5 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:px-4 md:text-sm lg:h-[3.25rem]"
            />

            <select
              value={category}
              onChange={(event) => {
                const next = event.target.value;
                if (onCategoryChange) onCategoryChange(next);
                else setLocalCategory(next);
              }}
              className="h-12 w-full rounded-xl border border-slate-200 px-3.5 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:px-4 md:text-sm lg:h-[3.25rem]"
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
              className="hidden h-12 w-full rounded-xl border border-slate-200 px-3.5 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:block md:px-4 md:text-sm lg:h-[3.25rem]"
              aria-label="Location"
            />

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-blue-600 px-5 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 md:w-auto md:px-6 md:text-sm lg:h-[3.25rem] lg:px-7"
            >
              Search Jobs
            </button>
          </div>
          <p className="mt-2 text-left text-xs font-medium text-slate-500 md:hidden">
            Searching jobs in Visakhapatnam
          </p>
        </form>
      </div>
    </section>
  );
}
