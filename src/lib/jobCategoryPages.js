import {
  isCivilRelatedJob,
  isEceRelatedJob,
  isElectricalRelatedJob,
  isEngineeringRelatedJob,
  isMechanicalRelatedJob,
} from './jobBranchMatch.js';
import { BROWSE_CATEGORY_LINKS, jobMatchesCategoryFilter } from './jobCategoryTaxonomy.js';

/** @typedef {string} BranchCategoryId */

/**
 * @typedef {object} GuideSection
 * @property {string} title
 * @property {string} [body]
 * @property {string[]} [items]
 */

/**
 * @typedef {object} JobCategoryPageConfig
 * @property {BranchCategoryId} id
 * @property {string} path
 * @property {string} [legacyPath]
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
 * @property {GuideSection[]} [guideSections]
 */

const byTaxonomy = (filterId) => (job) => jobMatchesCategoryFilter(job, filterId);

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
      'Browse civil engineer openings in Vizag including site, structural, estimation, and construction roles. Employers post local requirements on JobsInVizag.in; candidates can apply on-site and track status.',
    guideSections: [
      {
        title: 'Common civil roles in Vizag',
        items: [
          'Site engineer and junior site engineer',
          'Structural / design engineer',
          'Quantity surveyor and estimation engineer',
          'Project engineer for residential and industrial builds',
        ],
      },
      {
        title: 'How to apply on this site',
        body: 'Open a listing, apply through JobsInVizag.in when the job supports on-site applications, then check your Applied Jobs page for status updates from the employer.',
      },
    ],
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
    guideSections: [
      {
        title: 'Popular mechanical openings',
        items: [
          'Production and manufacturing engineer',
          'Maintenance and reliability engineer',
          'HVAC / piping engineer',
          'Quality and plant operations roles',
        ],
      },
    ],
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
  {
    id: 'banking',
    path: '/jobs/banking',
    label: 'Banking & Finance',
    headline: 'Banking & Finance Jobs in Vizag',
    subheadline: 'Bank, NBFC, insurance, and accounts roles in Visakhapatnam',
    seoTitle: 'Banking Jobs in Vizag | Finance & Accounts Jobs in Visakhapatnam 2026',
    seoDescription:
      'Find banking and finance jobs in Vizag — relationship officers, sales, accounts, insurance, and NBFC openings. Apply on JobsInVizag.in and track status.',
    seoKeywords:
      'Banking Jobs Vizag, Finance Jobs Visakhapatnam, Accounts Jobs Vizag, NBFC Jobs Vizag',
    countLabel: 'banking & finance',
    matchesJob: byTaxonomy('banking'),
    introTitle: 'Banking and finance careers in Visakhapatnam',
    introBody:
      'Vizag’s banking and finance market includes private banks, NBFCs, insurance partners, and accounts teams at local companies. Employers post requirements on our portal; you can apply on-site and follow application status in your account.',
    guideSections: [
      {
        title: 'Roles you will often see',
        items: [
          'Relationship executive / gold loan / retail banking sales',
          'Accounts executive and accountant',
          'Insurance advisor and agency roles',
          'Collections, credit, and operations support',
        ],
      },
      {
        title: 'Tips for applicants',
        body: 'Keep your resume and ID proofs ready, confirm the work location (Vizag vs field sales), and never pay a fee to “secure” a bank or finance job.',
      },
    ],
  },
  {
    id: 'bpo',
    path: '/jobs/bpo',
    label: 'BPO & Support',
    headline: 'BPO & Customer Support Jobs in Vizag',
    subheadline: 'Voice, non-voice, chat support, and telecaller roles',
    seoTitle: 'BPO Jobs in Vizag | Customer Support Jobs in Visakhapatnam 2026',
    seoDescription:
      'Browse BPO and customer support jobs in Vizag — voice process, chat support, telecaller, and backend support roles. Apply on-site when available.',
    seoKeywords:
      'BPO Jobs Vizag, Customer Support Visakhapatnam, Call Center Jobs Vizag, Telecaller Jobs Vizag',
    countLabel: 'BPO & support',
    matchesJob: byTaxonomy('bpo'),
    introTitle: 'BPO and support jobs in Visakhapatnam',
    introBody:
      'Customer support and BPO hiring in Vizag covers voice and non-voice processes, chat support, and telecalling. Many employers hire freshers with good communication skills.',
    guideSections: [
      {
        title: 'What employers usually look for',
        items: [
          'Clear spoken English or Telugu (role-dependent)',
          'Shift flexibility for voice processes',
          'Basic computer skills for CRM tools',
          'Customer handling and patience',
        ],
      },
    ],
  },
  {
    id: 'sales',
    path: '/jobs/sales',
    label: 'Sales & Marketing',
    headline: 'Sales & Marketing Jobs in Vizag',
    subheadline: 'Field sales, business development, and marketing roles',
    seoTitle: 'Sales Jobs in Vizag | Marketing & BD Jobs in Visakhapatnam 2026',
    seoDescription:
      'Find sales and marketing jobs in Vizag — field sales, business development, digital marketing, and retail sales openings for freshers and experienced candidates.',
    seoKeywords:
      'Sales Jobs Vizag, Marketing Jobs Visakhapatnam, Business Development Vizag, Field Sales Vizag',
    countLabel: 'sales & marketing',
    matchesJob: byTaxonomy('sales'),
    introTitle: 'Sales and marketing jobs in Visakhapatnam',
    introBody:
      'From field sales and BD to retail and digital marketing, companies in Vizag regularly hire people who can grow local customers and brands. Apply through JobsInVizag.in for employer-posted roles and track your applications.',
    guideSections: [
      {
        title: 'Common sales tracks',
        items: [
          'Field sales / territory sales',
          'Business development executive',
          'Retail and showroom sales',
          'Digital marketing and lead generation',
        ],
      },
    ],
  },
  {
    id: 'hr',
    path: '/jobs/hr',
    label: 'HR & Admin',
    headline: 'HR & Admin Jobs in Vizag',
    subheadline: 'Recruitment, HR executive, and office admin roles',
    seoTitle: 'HR Jobs in Vizag | Admin & Recruitment Jobs in Visakhapatnam 2026',
    seoDescription:
      'Browse HR and admin jobs in Vizag — HR executive, recruiter, office assistant, and back-office roles in Visakhapatnam companies.',
    seoKeywords:
      'HR Jobs Vizag, Admin Jobs Visakhapatnam, Recruitment Jobs Vizag, Office Assistant Vizag',
    countLabel: 'HR & admin',
    matchesJob: byTaxonomy('hr'),
    introTitle: 'HR and administration careers in Vizag',
    introBody:
      'Local companies hire HR executives, recruiters, and admin staff to run hiring and office operations. Use this page to find current openings and apply where on-site applications are enabled.',
    guideSections: [
      {
        title: 'Typical responsibilities',
        items: [
          'Sourcing and screening candidates',
          'Employee onboarding and attendance coordination',
          'Office administration and vendor coordination',
          'Payroll / HRMS support (role-dependent)',
        ],
      },
    ],
  },
  {
    id: 'healthcare',
    path: '/jobs/healthcare',
    label: 'Healthcare',
    headline: 'Healthcare Jobs in Vizag',
    subheadline: 'Hospital, clinic, pharma, and medical support roles',
    seoTitle: 'Healthcare Jobs in Vizag | Hospital & Pharma Jobs in Visakhapatnam 2026',
    seoDescription:
      'Find healthcare jobs in Vizag — nurses, pharmacists, lab technicians, medical coding, and hospital admin openings in Visakhapatnam.',
    seoKeywords:
      'Healthcare Jobs Vizag, Hospital Jobs Visakhapatnam, Nurse Jobs Vizag, Pharma Jobs Vizag',
    countLabel: 'healthcare',
    matchesJob: byTaxonomy('healthcare'),
    introTitle: 'Healthcare jobs in Visakhapatnam',
    introBody:
      'Vizag’s hospitals, clinics, diagnostic labs, and pharma teams hire clinical and support staff year-round. Employers can post roles on our portal; candidates apply on-site and track status.',
    guideSections: [
      {
        title: 'Roles often listed',
        items: [
          'Staff nurse and nursing assistants',
          'Pharmacist and medical representative',
          'Lab technician and diagnostic support',
          'Hospital front office / medical admin',
        ],
      },
    ],
  },
  {
    id: 'education',
    path: '/jobs/education',
    label: 'Education',
    headline: 'Education Jobs in Vizag',
    subheadline: 'Teaching, tutoring, and academic support roles',
    seoTitle: 'Education Jobs in Vizag | Teaching & Tutor Jobs in Visakhapatnam 2026',
    seoDescription:
      'Browse education jobs in Vizag — teachers, tutors, faculty, and academic coordinators for schools, colleges, and coaching centres.',
    seoKeywords:
      'Teaching Jobs Vizag, Education Jobs Visakhapatnam, Tutor Jobs Vizag, Faculty Jobs Vizag',
    countLabel: 'education',
    matchesJob: byTaxonomy('education'),
    introTitle: 'Teaching and education jobs in Visakhapatnam',
    introBody:
      'Schools, colleges, and coaching institutes in Vizag hire teachers and academic staff across subjects. Check current openings below and apply through the portal when the employer accepts on-site applications.',
    guideSections: [
      {
        title: 'Helpful application tips',
        body: 'Mention your subjects, classes/grades handled, and any CTET/NET or college qualifications in your profile before you apply.',
      },
    ],
  },
  {
    id: 'hospitality',
    path: '/jobs/hospitality',
    label: 'Hospitality & Retail',
    headline: 'Hospitality & Retail Jobs in Vizag',
    subheadline: 'Hotel, restaurant, store, and front-office roles',
    seoTitle: 'Hospitality Jobs in Vizag | Hotel & Retail Jobs in Visakhapatnam 2026',
    seoDescription:
      'Find hospitality and retail jobs in Vizag — hotel staff, restaurant, store associates, and front-office openings in Visakhapatnam.',
    seoKeywords:
      'Hospitality Jobs Vizag, Hotel Jobs Visakhapatnam, Retail Jobs Vizag, Restaurant Jobs Vizag',
    countLabel: 'hospitality & retail',
    matchesJob: byTaxonomy('hospitality'),
    introTitle: 'Hospitality and retail hiring in Vizag',
    introBody:
      'Hotels, restaurants, and retail stores across Visakhapatnam hire for guest-facing and store operations roles. Browse featured and employer-posted openings on this page.',
    guideSections: [
      {
        title: 'Common openings',
        items: [
          'Front office / receptionist',
          'Restaurant / kitchen staff',
          'Store associate and cashier',
          'Housekeeping and guest services',
        ],
      },
    ],
  },
  {
    id: 'logistics',
    path: '/jobs/logistics',
    label: 'Logistics',
    headline: 'Logistics Jobs in Vizag',
    subheadline: 'Warehouse, delivery, fleet, and supply-chain roles',
    seoTitle: 'Logistics Jobs in Vizag | Warehouse & Delivery Jobs in Visakhapatnam 2026',
    seoDescription:
      'Browse logistics jobs in Vizag — warehouse, delivery, driver, fleet, and supply-chain openings in Visakhapatnam.',
    seoKeywords:
      'Logistics Jobs Vizag, Warehouse Jobs Visakhapatnam, Delivery Jobs Vizag, Supply Chain Vizag',
    countLabel: 'logistics',
    matchesJob: byTaxonomy('logistics'),
    introTitle: 'Logistics and supply-chain jobs in Visakhapatnam',
    introBody:
      'Port city demand, e-commerce, and local distribution keep warehouse and delivery hiring active in Vizag. Employers post requirements here; candidates can apply on-site and monitor application status.',
    guideSections: [
      {
        title: 'Roles you may find',
        items: [
          'Warehouse associate / inventory executive',
          'Delivery executive and last-mile roles',
          'Fleet / transport coordinator',
          'Supply-chain and dispatch support',
        ],
      },
    ],
  },
];

/** Category ids that have a dedicated `/jobs/:id` landing page (for redirects). */
export const JOB_CATEGORY_LANDING_IDS = new Set(JOB_CATEGORY_PAGES.map((page) => page.id));

/** @param {BranchCategoryId | string} id */
export const getJobCategoryPageConfig = (id) =>
  JOB_CATEGORY_PAGES.find((page) => page.id === id) ?? null;

/** Homepage / footer quick links. */
export const JOB_BROWSE_LINKS = BROWSE_CATEGORY_LINKS.map(({ label, to }) => ({ label, to }));
