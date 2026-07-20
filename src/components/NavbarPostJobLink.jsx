import { Link } from 'react-router-dom';
import { useEmployerAuth } from '../hooks/useEmployerAuth';

export default function NavbarPostJobLink({ className, onClick }) {
  const { isEmployer, session } = useEmployerAuth();

  const signedInAsEmployer = Boolean(session && isEmployer);
  const to = signedInAsEmployer ? '/employer/jobs/new' : '/employer/register';

  return (
    <Link to={to} className={className} onClick={onClick}>
      Post a job
    </Link>
  );
}
