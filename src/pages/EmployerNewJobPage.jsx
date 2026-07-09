import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import EmployerRoute from '../components/employer/EmployerRoute';
import EmployerShell from '../components/employer/EmployerShell';
import EmployerJobForm from '../components/employer/EmployerJobForm';

function EmployerNewJobContent() {
  const navigate = useNavigate();

  return (
    <EmployerShell title="Post a job" description="Submit a listing for admin approval.">
      <SEO title="Post a job | Vizag Jobs Employer" canonical="/employer/jobs/new" />
      <EmployerJobForm
        mode="create"
        onCancel={() => navigate('/employer/jobs')}
        onSaved={() => navigate('/employer/jobs')}
      />
    </EmployerShell>
  );
}

export default function EmployerNewJobPage() {
  return (
    <EmployerRoute>
      <EmployerNewJobContent />
    </EmployerRoute>
  );
}
