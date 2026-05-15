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
import AdminBlogListPage from './pages/AdminBlogListPage';
import AdminNewBlogPage from './pages/AdminNewBlogPage';
import AdminEditBlogPage from './pages/AdminEditBlogPage';
import BlogListPage from './pages/BlogListPage';
import BlogPostPage from './pages/BlogPostPage';
import AdminRoute from './components/admin/AdminRoute';
import EmployerLoginPage from './pages/EmployerLoginPage';
import EmployerRegisterPage from './pages/EmployerRegisterPage';
import EmployerProfilePage from './pages/EmployerProfilePage';
import EmployerJobsListPage from './pages/EmployerJobsListPage';
import EmployerNewJobPage from './pages/EmployerNewJobPage';
import EmployerEditJobPage from './pages/EmployerEditJobPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/employer/login" element={<EmployerLoginPage />} />
      <Route path="/employer/register" element={<EmployerRegisterPage />} />
      <Route path="/employer" element={<Navigate to="/employer/jobs" replace />} />
      <Route path="/employer/profile" element={<EmployerProfilePage />} />
      <Route path="/employer/jobs" element={<EmployerJobsListPage />} />
      <Route path="/employer/jobs/new" element={<EmployerNewJobPage />} />
      <Route path="/employer/jobs/:jobId/edit" element={<EmployerEditJobPage />} />
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
      <Route
        path="/admin/blog"
        element={(
          <AdminRoute>
            <AdminBlogListPage />
          </AdminRoute>
        )}
      />
      <Route
        path="/admin/blog/new"
        element={(
          <AdminRoute>
            <AdminNewBlogPage />
          </AdminRoute>
        )}
      />
      <Route
        path="/admin/blog/:postId/edit"
        element={(
          <AdminRoute>
            <AdminEditBlogPage />
          </AdminRoute>
        )}
      />
      <Route path="/blog" element={<BlogListPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
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
