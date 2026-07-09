import {
  isCivilRelatedJob,
  isEceRelatedJob,
  isElectricalRelatedJob,
  isEngineeringRelatedJob,
  isMechanicalRelatedJob,
} from './jobBranchMatch.js';
import { BROWSE_CATEGORY_LINKS } from './jobCategoryTaxonomy.js';

/** @typedef {'civil' | 'mechanical' | 'electrical' | 'ece' | 'engineering'} BranchCategoryId */

/**
 * @typedef {object} JobCategoryPageConfig
 * @property {BranchCategoryId} id
 * @property {string} path
 * @property {string} legacyPath
 * @property {string} label
 * @property {string} headline
 * @property {string} subheadline
 * @property {string} seoTitle
 * @property {string} seoDescription
 * @property {string} seoKeywords
 * @property {string} countLabel
 * @property {(job: object) => boolean} matchesJob
 * @property {string} introTitle
 * @property {string} introBody
 */

/** @type {JobCategoryPageConfig[]} */
export const JOB_CATEGORY_PAGES = [
  {
    id: 'civil',
    path: '/jobs/civil',
    legacyPath: '/civil-jobs-in-vizag',
    label: 'Civil Jobs',
    headline: 'Civil Jobs in Vizag',
    subheadline: 'Civil engineering and construction roles in Visakhapatnam',
    seoTitle: 'Civil Jobs in Vizag | Civil Engineer Jobs in Visakhapatnam 2026',
    seoDescription:
      'Find civil engineering jobs in Vizag — site engineer, structural, construction, and graduate civil roles in Visakhapatnam.',
    seoKeywords:
      'Civil Jobs Vizag, Civil Engineer Jobs Visakhapatnam, Construction Jobs Vizag, Site Engineer Vizag',
    countLabel: 'civil',
    matchesJob: isCivilRelatedJob,
    introTitle: 'Civil Engineering Jobs in Visakhapatnam',
    introBody:
      'Browse civil engineer openings in Vizag including site, structural, estimation, and construction roles. Filter by company, experience, and posting date.',
  },
  {
    id: 'mechanical',
    path: '/jobs/mechanical',
    legacyPath: '/mechanical-jobs-in-vizag',
    label: 'Mechanical Jobs',
    headline: 'Mechanical Jobs in Vizag',
    subheadline: 'Mechanical engineering and production roles in Visakhapatnam',
    seoTitle: 'Mechanical Jobs in Vizag | Mechanical Engineer Jobs in Visakhapatnam 2026',
    seoDescription:
      'Discover mechanical engineering jobs in Vizag — production, maintenance, HVAC, piping, and plant engineer roles.',
    seoKeywords:
      'Mechanical Jobs Vizag, Mechanical Engineer Visakhapatnam, Production Engineer Vizag, Plant Jobs Vizag',
    countLabel: 'mechanical',
    matchesJob: isMechanicalRelatedJob,
    introTitle: 'Mechanical Engineering Jobs in Visakhapatnam',
    introBody:
      'Find mechanical engineer vacancies in Vizag across manufacturing, shipyard, power, and industrial sectors.',
  },
  {
    id: 'electrical',
    path: '/jobs/electrical',
    legacyPath: '/electrical-jobs-in-vizag',
    label: 'Electrical / EEE Jobs',
    headline: 'Electrical & EEE Jobs in Vizag',
    subheadline: 'Electrical engineering and power sector roles in Visakhapatnam',
    seoTitle: 'Electrical Jobs in Vizag | EEE Engineer Jobs in Visakhapatnam 2026',
    seoDescription:
      'Search electrical and EEE engineering jobs in Vizag — power plant, maintenance, substation, and PLC roles.',
    seoKeywords:
      'Electrical Jobs Vizag, EEE Jobs Visakhapatnam, Power Plant Jobs Vizag, Electrical Engineer Vizag',
    countLabel: 'electrical',
    matchesJob: isElectricalRelatedJob,
    introTitle: 'Electrical & EEE Jobs in Visakhapatnam',
    introBody:
      'Explore electrical engineer openings in Vizag for graduates and experienced professionals in power and industrial sectors.',
  },
  {
    id: 'ece',
    path: '/jobs/ece',
    legacyPath: '/ece-jobs-in-vizag',
    label: 'ECE Jobs',
    headline: 'ECE Jobs in Vizag',
    subheadline: 'Electronics and communication engineering roles in Visakhapatnam',
    seoTitle: 'ECE Jobs in Vizag | Electronics Engineer Jobs in Visakhapatnam 2026',
    seoDescription:
      'Find ECE and electronics engineering jobs in Vizag — embedded, telecom, VLSI, and communication engineer roles.',
    seoKeywords:
      'ECE Jobs Vizag, Electronics Jobs Visakhapatnam, Embedded Engineer Vizag, Telecom Jobs Vizag',
    countLabel: 'ECE',
    matchesJob: isEceRelatedJob,
    introTitle: 'ECE & Electronics Jobs in Visakhapatnam',
    introBody:
      'Browse electronics and communication engineer vacancies in Vizag for freshers and experienced candidates.',
  },
  {
    id: 'engineering',
    path: '/jobs/engineering',
    legacyPath: '/engineering-jobs-in-vizag',
    label: 'All Engineering',
    headline: 'Engineering Jobs in Vizag',
    subheadline: 'Civil, mechanical, electrical, ECE, and core engineering roles',
    seoTitle: 'Engineering Jobs in Vizag | B.Tech & B.E Jobs in Visakhapatnam 2026',
    seoDescription:
      'All engineering jobs in Vizag — civil, mechanical, electrical, ECE, and core engineering openings for graduates.',
    seoKeywords:
      'Engineering Jobs Vizag, B.Tech Jobs Visakhapatnam, B.E Jobs Vizag, Core Engineering Jobs Vizag',
    countLabel: 'engineering',
    matchesJob: isEngineeringRelatedJob,
    introTitle: 'Engineering Jobs in Visakhapatnam',
    introBody:
      'One place to browse civil, mechanical, electrical, ECE, and other core engineering vacancies across Vizag.',
  },
];

/** @param {BranchCategoryId | string} id */
export const getJobCategoryPageConfig = (id) =>
  JOB_CATEGORY_PAGES.find((page) => page.id === id) ?? null;

/** Homepage / footer quick links. */
export const JOB_BROWSE_LINKS = BROWSE_CATEGORY_LINKS.map(({ label, to }) => ({ label, to }));
