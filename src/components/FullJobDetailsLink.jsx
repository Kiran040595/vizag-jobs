import { Link } from 'react-router-dom';

/**
 * "Full Job Details" CTA — always opens the job page.
 * Guests see the auth-required popup on the job route via JobDetailsAuthGate.
 */
export default function FullJobDetailsLink({
  jobPath,
  children = 'Full Job Details',
  className = 'block w-full rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
}) {
  return (
    <Link to={jobPath} className={className}>
      {children}
    </Link>
  );
}
