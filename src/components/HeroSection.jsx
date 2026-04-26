import { useState, useEffect, useRef } from 'react';
import vsp2Image from '../assets/VSP2.jpg';
import vsp1Image from '../assets/VSP1.jpg';

const popularTags = [
  'Software Engineer',
  'Frontend Developer',
  'BPO Jobs',
  'Walk-in Interviews',
  'Fresher Jobs'
];

export default function HeroSection({ searchTerm, onSearch }) {
  const [category, setCategory] = useState('All Categories');
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
    onSearch(searchTerm);
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
      <div className="relative mx-auto flex min-h-[22rem] w-full max-w-6xl flex-col items-center justify-center px-4 py-12 text-center sm:min-h-[26rem] sm:px-6 sm:py-16 lg:px-8">
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
          Find the Right Job in Visakhapatnam
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-blue-100 sm:mt-4 sm:text-base">
          Your one-stop platform for IT, Non-IT, Fresher and Experienced jobs
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-7 w-full max-w-5xl rounded-2xl border border-white/30 bg-white/90 p-3 shadow-2xl backdrop-blur md:mt-8 md:p-4"
        >
          <div className="grid gap-2.5 md:grid-cols-[1.7fr_1.2fr_1.2fr_auto] md:gap-3">
            <input
              id="job-title"
              type="text"
              value={searchTerm}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Job title, keywords, or company"
              className="h-11 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:h-12 md:px-4"
            />

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:h-12 md:px-4"
              aria-label="Select category"
            >
              <option>All Categories</option>
              <option>IT & Software</option>
              <option>Non-IT Jobs</option>
              <option>Fresher Jobs</option>
              <option>Walk-in Interviews</option>
            </select>

            <input
              id="location"
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:h-12 md:px-4"
            />

            <button
              type="submit"
              className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 md:h-12 md:px-6"
            >
              Search Jobs
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-left sm:gap-2">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Popular:
            </span>
            {popularTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSearch(tag)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:px-3 sm:py-1.5 sm:text-xs"
              >
                {tag}
              </button>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}
