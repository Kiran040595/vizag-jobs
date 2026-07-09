const FeaturedBadge = () => (
  <span
    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-700 sm:text-[11px]"
    title="Featured job"
  >
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.39 6.91H22l-5.8 4.21 2.22 6.88L12 17.77l-6.42 4.23 2.22-6.88L2 8.91h7.61L12 2z" />
    </svg>
    Featured
  </span>
);

export default FeaturedBadge;
