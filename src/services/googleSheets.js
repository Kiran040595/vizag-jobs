const DEFAULT_JOBS_API_URL =
  'https://script.google.com/macros/s/AKfycbw_dL3Xy6YNkN0schsB_yLhjNAJdQWhhA0VNO8yiP5xsLpDzaZcexyS5kxA1lbtLCObkw/exec';

const JOBS_API_URL = import.meta.env.VITE_JOBS_API_URL || DEFAULT_JOBS_API_URL;

// Cache for processed jobs to avoid re-processing
let processedJobsCache = null;
let lastProcessedTimestamp = 0;

// Retry utility function
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const fetchJobsFromGoogleSheets = async (forceRefresh = false, limit = null) => {
  // Return cached processed data if available and not forcing refresh
  if (!forceRefresh && processedJobsCache && (Date.now() - lastProcessedTimestamp) < 60000) { // 1 minute cache
    const cachedJobs = limit ? processedJobsCache.slice(0, limit) : processedJobsCache;
    return cachedJobs;
  }

  const fetchWithRetry = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(JOBS_API_URL, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Jobs API request failed with ${response.status}`);
      }

      const jobsData = await response.json();
      if (!Array.isArray(jobsData)) {
        throw new Error('Jobs API returned an invalid response');
      }

      return jobsData;

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    }
  };

  // Use retry mechanism
  const jobsData = await retryWithBackoff(fetchWithRetry, 3, 1000);

  // Process jobs data
  const processedJobs = jobsData.map((job, index) => {
    const category = job.category || '';
    const jobType = job.jobType || '';
    const isFresherValue = String(job.isFresher || '').toLowerCase();
    const isFresher = isFresherValue === 'true' || isFresherValue === 'yes' ? 'Yes' : 'No';
    const fresherTag = isFresher === 'Yes' ? 'Fresher' : 'Experienced';
    const sourceTag = job.source || '';

    return {
      id: job.id || `sheet-job-${index + 1}`,
      title: job.title || '',
      company: job.company || '',
      location: job.location || 'Visakhapatnam',
      category,
      jobType,
      workMode: job.workMode || '',
      experience: job.experience || 'Not specified',
      isFresher,
      salary: job.salary || '',
      applyLink: job.applyLink || '',
      description: job.description || '',
      shortDescription: job.shortDescription || '',
      responsibilities: job.responsibilities || '',
      eligibility: job.eligibility || '',
      warning: job.warning || '',
      postedAt: job.postedAt || '',
      status: job.status || '',
      source: job.source || '',
      skills: job.skills || '',
      companyLogo: job.companyLogo || job.logo || '',
      tags: [category, jobType, fresherTag, sourceTag].filter(Boolean)
    };
  });

  // Cache processed data
  processedJobsCache = processedJobs;
  lastProcessedTimestamp = Date.now();

  // Return limited results if specified
  return limit ? processedJobs.slice(0, limit) : processedJobs;
};
