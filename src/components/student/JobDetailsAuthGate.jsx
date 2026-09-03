/**
 * Job detail pages are public so Instagram / shared links can show the opening.
 * Apply, save, and on-platform apply still require student sign-in via their own CTAs.
 */
export default function JobDetailsAuthGate({ children }) {
  return children;
}
