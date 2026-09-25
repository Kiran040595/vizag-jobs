/**
 * Direct portal jobs (admin-written or employer-submitted) should alert seekers.
 * Scraped aggregator / company-career imports keep source_name and must not spam.
 */

const normalize = (value) => String(value ?? '').trim();

export const JOB_ALERT_KIND = 'new_job';

export const isDirectPortalJob = (job = {}) => {
  const createdBy = job.createdBy || job.created_by || null;
  if (createdBy) {
    return true;
  }

  const sourceName = normalize(job.source ?? job.source_name);
  const sourceUrl = normalize(job.sourceUrl || job.source_url);
  return !sourceName && !sourceUrl;
};

export const shouldNotifyJobPublish = (job = {}, previousStatus = null) => {
  const status = normalize(job.status).toLowerCase();
  if (status !== 'published') {
    return false;
  }

  const previous = normalize(previousStatus).toLowerCase();
  if (previous === 'published') {
    return false;
  }

  return isDirectPortalJob(job);
};

export const buildJobAlertLinkPath = (job = {}) => {
  const slug = normalize(job.slug) || normalize(job.id);
  return slug ? `/job/${slug}` : '/jobs';
};

export const buildJobAlertTitle = (job = {}) => {
  const title = normalize(job.title) || 'New job in Vizag';
  return `New job: ${title}`.slice(0, 100);
};

export const buildJobAlertPreview = (job = {}) => {
  const company = normalize(job.company);
  const location = normalize(job.location) || 'Visakhapatnam';
  return [company, location].filter(Boolean).join(' · ').slice(0, 180);
};

export const buildJobAlertNotification = (job = {}) => ({
  title: buildJobAlertTitle(job),
  body: buildJobAlertPreview(job),
  linkPath: buildJobAlertLinkPath(job),
  tag: `job-alert-${normalize(job.id) || normalize(job.slug) || 'new'}`,
});
