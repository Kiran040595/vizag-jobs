export const LISTING_REPORT_TOPIC = 'listing-report';
export const PRIVACY_REQUEST_TOPIC = 'privacy-request';

const trim = (value) => String(value ?? '').trim();

/**
 * Contact-page URL for reporting a listing (scam, outdated, copyright).
 * @param {{ jobTitle?: string, jobId?: string, jobPath?: string }} [details]
 */
export const buildListingReportPath = (details = {}) => {
  const params = new URLSearchParams();
  params.set('topic', LISTING_REPORT_TOPIC);

  const jobTitle = trim(details.jobTitle);
  const jobId = trim(details.jobId);
  const jobPath = trim(details.jobPath);

  if (jobTitle) params.set('jobTitle', jobTitle.slice(0, 180));
  if (jobId) params.set('jobId', jobId.slice(0, 80));
  if (jobPath) params.set('jobPath', jobPath.slice(0, 240));

  return `/contact?${params.toString()}`;
};

/**
 * @param {URLSearchParams | { get?: (key: string) => string | null }} searchParams
 */
export const readContactRequest = (searchParams) => {
  const get = (key) => {
    if (!searchParams) return '';
    if (typeof searchParams.get === 'function') {
      return trim(searchParams.get(key));
    }
    return trim(searchParams[key]);
  };

  const topic = get('topic');
  return {
    topic,
    isListingReport: topic === LISTING_REPORT_TOPIC,
    isPrivacyRequest: topic === PRIVACY_REQUEST_TOPIC,
    jobTitle: get('jobTitle'),
    jobId: get('jobId'),
    jobPath: get('jobPath'),
  };
};

/**
 * @param {{ email: string, topic?: string, jobTitle?: string, jobPath?: string, jobId?: string }} options
 */
export const buildContactMailto = ({
  email,
  topic,
  jobTitle,
  jobPath,
  jobId,
}) => {
  const address = trim(email);
  if (!address) return '';

  let subject = 'JobsInVizag.in enquiry';
  if (topic === LISTING_REPORT_TOPIC) {
    subject = jobTitle
      ? `Listing report: ${jobTitle.slice(0, 80)}`
      : 'Listing report / takedown request';
  } else if (topic === PRIVACY_REQUEST_TOPIC) {
    subject = 'Privacy / data request (DPDP)';
  }

  const lines = [];
  if (topic === LISTING_REPORT_TOPIC) {
    lines.push('I would like this listing reviewed (scam, outdated, misleading, or copyright).');
    if (jobTitle) lines.push(`Job title: ${jobTitle}`);
    if (jobId) lines.push(`Job id: ${jobId}`);
    if (jobPath) lines.push(`Page: ${jobPath}`);
    lines.push('Reason:');
  } else if (topic === PRIVACY_REQUEST_TOPIC) {
    lines.push('I am requesting access, correction, deletion, or withdrawal of consent for my personal data.');
    lines.push('Please describe the account/email used on the site:');
  }

  const href = `mailto:${address}?subject=${encodeURIComponent(subject)}`;
  if (lines.length === 0) {
    return href;
  }
  return `${href}&body=${encodeURIComponent(lines.join('\n'))}`;
};
