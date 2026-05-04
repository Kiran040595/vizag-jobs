import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import JobDetailsPage from './pages/JobDetailsPage';
import JobsInVizagPage from './pages/JobsInVizagPage';
import ItJobsInVizagPage from './pages/ItJobsInVizagPage';
import FresherJobsInVizagPage from './pages/FresherJobsInVizagPage';
import PartTimeJobsVizagPage from './pages/PartTimeJobsVizagPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminNewJobPage from './pages/AdminNewJobPage';
import AdminJobsPage from './pages/AdminJobsPage';
import AdminEditJobPage from './pages/AdminEditJobPage';
import AdminRoute from './components/admin/AdminRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={(
          <AdminRoute>
            <Navigate to="/admin/new" replace />
          </AdminRoute>
        )}
      />
      <Route
        path="/admin/new"
        element={(
          <AdminRoute>
            <AdminNewJobPage />
          </AdminRoute>
        )}
      />
      <Route
        path="/admin/jobs"
        element={(
          <AdminRoute>
            <AdminJobsPage />
          </AdminRoute>
        )}
      />
      <Route
        path="/admin/jobs/:jobId/edit"
        element={(
          <AdminRoute>
            <AdminEditJobPage />
          </AdminRoute>
        )}
      />
      <Route path="/jobs/:jobSegment/:jobSlug" element={<JobDetailsPage />} />
      <Route path="/job/:jobSlug" element={<JobDetailsPage />} />
      <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
      <Route path="/jobs" element={<JobsInVizagPage />} />
      <Route path="/jobs-in-vizag" element={<JobsInVizagPage />} />
      <Route path="/jobs/it" element={<ItJobsInVizagPage />} />
      <Route path="/it-jobs-in-vizag" element={<ItJobsInVizagPage />} />
      <Route path="/jobs/fresher" element={<FresherJobsInVizagPage />} />
      <Route path="/fresher-jobs-in-vizag" element={<FresherJobsInVizagPage />} />
      <Route path="/jobs/part-time" element={<PartTimeJobsVizagPage />} />
      <Route path="/part-time-jobs-vizag" element={<PartTimeJobsVizagPage />} />
    </Routes>
  );
}

export default App;
