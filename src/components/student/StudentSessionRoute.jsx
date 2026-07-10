import { Navigate } from 'react-router-dom';
import LoadingSpinner from '../LoadingSpinner';
import { useStudentAuth } from '../../hooks/useStudentAuth';

export default function StudentSessionRoute({ children }) {
  const { isLoading, isSupabaseConfigured, session } = useStudentAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-2xl font-black">Supabase is not configured.</h1>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <LoadingSpinner message="Loading..." />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/student/login" replace />;
  }

  return children;
}
