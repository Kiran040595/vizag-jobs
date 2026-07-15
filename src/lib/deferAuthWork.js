/**
 * Run work after Supabase releases its auth lock.
 * Calling other supabase.* APIs inside onAuthStateChange without deferring
 * can deadlock and leave the UI stuck on "Loading...".
 */
export const deferAuthWork = (fn) => {
  setTimeout(fn, 0);
};
