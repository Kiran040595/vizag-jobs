import { Link } from 'react-router-dom';
import { useEmployerAuth } from '../hooks/useEmployerAuth';

export default function NavbarPostJobLink({ className, onClick }) {
  const { isEmployer, isLoading, session } = useEmployerAuth();

  const to = session && isEmployer ? '/employer/jobs' : '/employer/login';

  return (
    <Link to={to} className={className} onClick={onClick}>
      {isLoading ? 'Post a job' : session && isEmployer ? 'Employer dashboard' : 'Post a job'}
    </Link>
  );
}
