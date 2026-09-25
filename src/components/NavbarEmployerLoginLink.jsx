import { Link } from 'react-router-dom';
import { useEmployerAuth } from '../hooks/useEmployerAuth';

/**
 * Visible Employer login entry on the public site (home / navbar).
 * When already signed in as employer, links to the dashboard instead.
 */
export default function NavbarEmployerLoginLink({ className, onClick }) {
  const { isEmployer, isLoading, session } = useEmployerAuth();

  if (isLoading) {
    return null;
  }

  const signedInAsEmployer = Boolean(session && isEmployer);
  const to = signedInAsEmployer ? '/employer/jobs' : '/employer/login';
  const label = signedInAsEmployer ? 'Employer dashboard' : 'Employer login';

  return (
    <Link to={to} className={className} onClick={onClick}>
      {label}
    </Link>
  );
}
