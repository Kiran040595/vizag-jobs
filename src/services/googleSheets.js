const DEFAULT_JOBS_API_URL =
  'https://script.google.com/macros/s/AKfycbw_dL3Xy6YNkN0schsB_yLhjNAJdQWhhA0VNO8yiP5xsLpDzaZcexyS5kxA1lbtLCObkw/exec';

const JOBS_API_URL = import.meta.env.VITE_JOBS_API_URL || DEFAULT_JOBS_API_URL;

export const fetchJobsFromGoogleSheets = async () => {
  const response = await fetch(JOBS_API_URL);
  if (!response.ok) {
    throw new Error(`Jobs API request failed with ${response.status}`);
  }

  const jobsData = await response.json();
  if (!Array.isArray(jobsData)) {
    throw new Error('Jobs API returned an invalid response');
  }

  return jobsData
    .map((job, index) => {
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
    })
    .filter((job) => job.title && job.company);
};
