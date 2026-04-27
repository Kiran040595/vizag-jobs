import { Route, Routes } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import HomePage from './pages/HomePage';
import JobDetailsPage from './pages/JobDetailsPage';
import JobsInVizagPage from './pages/JobsInVizagPage';
import ItJobsInVizagPage from './pages/ItJobsInVizagPage';
import FresherJobsInVizagPage from './pages/FresherJobsInVizagPage';
import PartTimeJobsVizagPage from './pages/PartTimeJobsVizagPage';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
        <Route path="/jobs-in-vizag" element={<JobsInVizagPage />} />
        <Route path="/it-jobs-in-vizag" element={<ItJobsInVizagPage />} />
        <Route path="/fresher-jobs-in-vizag" element={<FresherJobsInVizagPage />} />
        <Route path="/part-time-jobs-vizag" element={<PartTimeJobsVizagPage />} />
      </Routes>
      <Analytics />
    </>
  );
}

export default App;
