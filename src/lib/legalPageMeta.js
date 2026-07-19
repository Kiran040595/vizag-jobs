import {
  SITE_CONTACT_EMAIL,
  SITE_LEGAL_NAME,
  SITE_LOCATION_DISPLAY,
  SITE_PUBLISHER_NAME,
} from './siteLegal.js';

const DEFAULT_SITE_URL = 'https://jobsinvizag.in';

const buildAbsoluteUrl = (path, siteUrl) => {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * SEO + first-byte content for legal/trust pages (middleware SSR).
 * Keep summaries in sync with the React page copy.
 */
export const LEGAL_PAGE_META = {
  '/about': {
    title: 'About Us | Jobs in Vizag',
    description:
      'JobsInVizag.in is a Visakhapatnam job portal where employers post openings, students apply on-site, track application status, and browse featured local jobs.',
    heading: 'About Us',
    keywords: ['About Jobs in Vizag', 'Vizag Jobs portal', 'Visakhapatnam job board'],
    schemaType: 'AboutPage',
    paragraphs: [
      `${SITE_LEGAL_NAME} is a regional job portal for Visakhapatnam. Employers post openings based on their hiring needs, and students and job seekers apply directly on our website.`,
      'Applicants can track the status of jobs they have applied for in their account. We also feature employer-posted and curated local roles across IT, engineering, fresher, and other categories.',
      `${SITE_LEGAL_NAME} is operated independently by ${SITE_PUBLISHER_NAME} from ${SITE_LOCATION_DISPLAY}. Contact: ${SITE_CONTACT_EMAIL}.`,
    ],
  },
  '/contact': {
    title: 'Contact | Jobs in Vizag',
    description: `Contact ${SITE_LEGAL_NAME} in ${SITE_LOCATION_DISPLAY} for listing corrections, employer posting help, student account support, or general enquiries.`,
    heading: 'Contact Us',
    keywords: ['Contact Vizag Jobs', 'JobsInVizag contact'],
    schemaType: 'ContactPage',
    paragraphs: [
      `Contact ${SITE_LEGAL_NAME} for listing corrections, employer posting support, student application help, or general feedback.`,
      `Operator: ${SITE_PUBLISHER_NAME}. Location: ${SITE_LOCATION_DISPLAY}. Email: ${SITE_CONTACT_EMAIL}.`,
      'We aim to respond within 2–3 business days. For urgent listing takedown requests, include the job URL and reason in your subject line.',
    ],
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Jobs in Vizag',
    description:
      'Privacy Policy for JobsInVizag.in — how we collect and use data for employer posting, student applications, cookies, and advertising.',
    heading: 'Privacy Policy',
    keywords: ['Privacy Policy Vizag Jobs', 'JobsInVizag privacy'],
    schemaType: 'WebPage',
    paragraphs: [
      `${SITE_LEGAL_NAME} collects account and application information when employers post jobs and when students register or apply on our site.`,
      'We use this information to operate the portal, show application status, share candidate details with employers when students have agreed, improve the site, and (where enabled) display advertising.',
      `Questions: ${SITE_CONTACT_EMAIL}.`,
    ],
  },
  '/terms-of-service': {
    title: 'Terms of Service | Jobs in Vizag',
    description:
      'Terms of Service for JobsInVizag.in — employer posting, student applications, featured jobs, and platform responsibilities.',
    heading: 'Terms of Service',
    keywords: ['Terms of Service Vizag Jobs', 'JobsInVizag terms'],
    schemaType: 'WebPage',
    paragraphs: [
      `By using ${SITE_LEGAL_NAME} you agree to these Terms. The platform lets employers post jobs for Visakhapatnam roles and lets students apply on-site and track application status.`,
      'We are not the hiring employer for listed roles unless stated otherwise. Employers are responsible for the accuracy of their postings; applicants should verify details before sharing sensitive information.',
      `Contact: ${SITE_CONTACT_EMAIL}.`,
    ],
  },
  '/disclaimer': {
    title: 'Disclaimer | Jobs in Vizag',
    description:
      'Disclaimer for JobsInVizag.in — platform role for employer-posted and featured jobs, and your responsibilities when applying.',
    heading: 'Disclaimer',
    keywords: ['Disclaimer Vizag Jobs', 'JobsInVizag disclaimer'],
    schemaType: 'WebPage',
    paragraphs: [
      `${SITE_LEGAL_NAME} hosts employer-posted jobs and may also feature other local openings. We are not the hiring employer unless explicitly stated.`,
      'Students may apply on our site and view application status in their account. Always verify role details with the employer before interviews or sharing sensitive documents.',
      `Report suspicious listings via the Contact page or ${SITE_CONTACT_EMAIL}.`,
    ],
  },
};

export const getLegalPageMeta = (path) => LEGAL_PAGE_META[path] || null;

export const buildLegalPageSchema = (path, options = {}) => {
  const meta = getLegalPageMeta(path);
  if (!meta) return null;

  const siteUrl = String(options.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const canonicalUrl = buildAbsoluteUrl(path, siteUrl);

  return {
    '@context': 'https://schema.org',
    '@type': meta.schemaType || 'WebPage',
    name: meta.heading,
    headline: meta.heading,
    description: meta.description,
    url: canonicalUrl,
    inLanguage: 'en-IN',
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      name: 'Jobs in Vizag',
      alternateName: 'Vizag Jobs',
      url: `${siteUrl}/`,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Jobs in Vizag',
      alternateName: 'Vizag Jobs',
      url: `${siteUrl}/`,
    },
  };
};

export const buildLegalPageBodyHtml = (path) => {
  const meta = getLegalPageMeta(path);
  if (!meta) return '';

  const paragraphs = (meta.paragraphs || [])
    .map((text) => `<p>${escapeHtml(text)}</p>`)
    .join('');

  return [
    '<article class="legal-ssr" style="max-width:48rem;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;color:#334155;line-height:1.6">',
    `<h1 style="font-size:1.875rem;font-weight:800;color:#020617">${escapeHtml(meta.heading)}</h1>`,
    paragraphs,
    '</article>',
  ].join('');
};

export const buildLegalPageHeadInjection = (path, options = {}) => {
  const meta = getLegalPageMeta(path);
  if (!meta) return null;

  const siteUrl = String(options.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return {
    title: meta.title,
    description: meta.description,
    canonicalUrl: buildAbsoluteUrl(path, siteUrl),
    keywords: meta.keywords?.join(', ') || '',
    schema: buildLegalPageSchema(path, options),
    bodyHtml: buildLegalPageBodyHtml(path),
  };
};
