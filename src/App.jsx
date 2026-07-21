import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import JobDetailsPage from './pages/JobDetailsPage';
import JobsInVizagPage from './pages/JobsInVizagPage';
import ItJobsInVizagPage from './pages/ItJobsInVizagPage';
import FresherJobsInVizagPage from './pages/FresherJobsInVizagPage';
import PartTimeJobsVizagPage from './pages/PartTimeJobsVizagPage';
import BranchJobsInVizagPage from './pages/BranchJobsInVizagPage';
import { JOB_CATEGORY_PAGES } from './lib/jobCategoryPages';
import { LEGACY_ROUTE_REDIRECTS } from './lib/legacyRedirects';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminNewJobPage from './pages/AdminNewJobPage';
import AdminJobsPage from './pages/AdminJobsPage';
import AdminExternalFetchPage from './pages/AdminExternalFetchPage';
import AdminEditJobPage from './pages/AdminEditJobPage';
import AdminJobApplicationsPage from './pages/AdminJobApplicationsPage';
import AdminBlogListPage from './pages/AdminBlogListPage';
import AdminNewBlogPage from './pages/AdminNewBlogPage';
import AdminEditBlogPage from './pages/AdminEditBlogPage';
import BlogListPage from './pages/BlogListPage';
import BlogPostPage from './pages/BlogPostPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import DisclaimerPage from './pages/DisclaimerPage';
import AdminRoute from './components/admin/AdminRoute';
import EmployerLoginPage from './pages/EmployerLoginPage';
import EmployerRegisterPage from './pages/EmployerRegisterPage';
import EmployerForgotPasswordPage from './pages/EmployerForgotPasswordPage';
import EmployerResetPasswordPage from './pages/EmployerResetPasswordPage';
import EmployerProfilePage from './pages/EmployerProfilePage';
import EmployerJobsListPage from './pages/EmployerJobsListPage';
import EmployerNewJobPage from './pages/EmployerNewJobPage';
import EmployerEditJobPage from './pages/EmployerEditJobPage';
import EmployerJobApplicationsPage from './pages/EmployerJobApplicationsPage';
import OAuthConsentPage from './pages/OAuthConsentPage';
import SavedJobsPage from './pages/SavedJobsPage';
import FeedbackPage from './pages/FeedbackPage';
import AdminFeedbackPage from './pages/AdminFeedbackPage';
import AdminEmployersPage from './pages/AdminEmployersPage';
import AdminStudentsPage from './pages/AdminStudentsPage';
import StudentLoginPage from './pages/StudentLoginPage';
import StudentRegisterPage from './pages/StudentRegisterPage';
import StudentForgotPasswordPage from './pages/StudentForgotPasswordPage';
import StudentResetPasswordPage from './pages/StudentResetPasswordPage';
import StudentProfilePage from './pages/StudentProfilePage';
import StudentApplyPage from './pages/StudentApplyPage';
import StudentApplicationsPage from './pages/StudentApplicationsPage';
import InstagramJobsPage from './pages/InstagramJobsPage';
import JobDetailsAuthGate from './components/student/JobDetailsAuthGate';
import FeedbackFloatingButton from './components/FeedbackFloatingButton';
import CookieConsentBanner from './components/CookieConsentBanner';

function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/ig" element={<InstagramJobsPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/oauth/consent" element={<OAuthConsentPage />} />
      <Route path="/employer/login" element={<EmployerLoginPage />} />
      <Route path="/employer/register" element={<EmployerRegisterPage />} />
      <Route path="/employer/forgot-password" element={<EmployerForgotPasswordPage />} />
      <Route path="/employer/reset-password" element={<EmployerResetPasswordPage />} />
      <Route path="/employer" element={<Navigate to="/employer/jobs" replace />} />
      <Route path="/employer/profile" element={<EmployerProfilePage />} />
      <Route path="/employer/jobs" element={<EmployerJobsListPage />} />
      <Route path="/employer/jobs/new" element={<EmployerNewJobPage />} />
      <Route path="/employer/jobs/:jobId/edit" element={<EmployerEditJobPage />} />
      <Route path="/employer/jobs/:jobId/applications" element={<EmployerJobApplicationsPage />} />
      <Route path="/student/login" element={<StudentLoginPage />} />
      <Route path="/student/register" element={<StudentRegisterPage />} />
      <Route path="/student/forgot-password" element={<StudentForgotPasswordPage />} />
      <Route path="/student/reset-password" element={<StudentResetPasswordPage />} />
      <Route path="/student" element={<Navigate to="/student/profile" replace />} />
      <Route path="/student/profile" element={<StudentProfilePage />} />
      <Route path="/student/applied-jobs" element={<StudentApplicationsPage />} />
      <Route path="/student/applications" element={<Navigate to="/student/applied-jobs" replace />} />
      <Route path="/student/apply/:jobId" element={<StudentApplyPage />} />
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
            <AdminJobsPage scope="employer" />
          </AdminRoute>
        )}
      />
      <Route
        path="/admin/admin-jobs"
        element={(
          <AdminRoute>
            <AdminJobsPage scope="admin" />
          </AdminRoute>
        )}
      />
      <Route
        path="/admin/fetch"
        element={(
          <AdminRoute>
            <AdminExternalFetchPage />
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
        path="/admin/jobs/:jobId/applications"
        element={(
          <AdminRoute>
            <AdminJobApplicationsPage />
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
      <Route
        path="/admin/feedback"
        element={(
          <AdminRoute>
            <AdminFeedbackPage />
          </AdminRoute>
        )}
      />
      <Route
        path="/admin/employers"
        element={(
          <AdminRoute>
            <AdminEmployersPage />
          </AdminRoute>
        )}
      />
      <Route
        path="/admin/students"
        element={(
          <AdminRoute>
            <AdminStudentsPage />
          </AdminRoute>
        )}
      />
      <Route path="/blog" element={<BlogListPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/feedback" element={<FeedbackPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/disclaimer" element={<DisclaimerPage />} />
      <Route path="/jobs" element={<JobsInVizagPage />} />
      <Route path="/saved-jobs" element={<SavedJobsPage />} />
      <Route path="/jobs/it" element={<ItJobsInVizagPage />} />
      <Route path="/jobs/fresher" element={<FresherJobsInVizagPage />} />
      <Route path="/jobs/part-time" element={<PartTimeJobsVizagPage />} />
      {JOB_CATEGORY_PAGES.map((page) => (
        <Route
          key={page.id}
          path={page.path}
          element={<BranchJobsInVizagPage categoryId={page.id} />}
        />
      ))}
      <Route
        path="/jobs/:jobSegment/:jobSlug"
        element={(
          <JobDetailsAuthGate>
            <JobDetailsPage />
          </JobDetailsAuthGate>
        )}
      />
      <Route
        path="/job/:jobSlug"
        element={(
          <JobDetailsAuthGate>
            <JobDetailsPage />
          </JobDetailsAuthGate>
        )}
      />
      <Route
        path="/jobs/:jobId"
        element={(
          <JobDetailsAuthGate>
            <JobDetailsPage />
          </JobDetailsAuthGate>
        )}
      />
      {Object.entries(LEGACY_ROUTE_REDIRECTS).map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
    </Routes>
    <CookieConsentBanner />
    <FeedbackFloatingButton />
    </>
  );
}

export default App;
