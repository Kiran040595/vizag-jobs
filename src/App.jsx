import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import JobDetailsPage from './pages/JobDetailsPage';
import JobsInVizagPage from './pages/JobsInVizagPage';
import ItJobsInVizagPage from './pages/ItJobsInVizagPage';
import FresherJobsInVizagPage from './pages/FresherJobsInVizagPage';
import PartTimeJobsVizagPage from './pages/PartTimeJobsVizagPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
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
