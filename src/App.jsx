import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import JobDetailsPage from './pages/JobDetailsPage';
import JobsInVizagPage from './pages/JobsInVizagPage';
import ItJobsInVizagPage from './pages/ItJobsInVizagPage';
import FresherJobsInVizagPage from './pages/FresherJobsInVizagPage';
import PartTimeJobsVizagPage from './pages/PartTimeJobsVizagPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
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
            <AdminDashboardPage />
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
