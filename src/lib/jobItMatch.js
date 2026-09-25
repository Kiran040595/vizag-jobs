/**
 * IT / software detection for processed jobs (processJobData in jobs.js).
 * Replaces job.tags.includes('IT'), which misses categories like "IT & Software".
 */

const IT_TECH_KEYWORDS = [
  'java',
  'python',
  'javascript',
  'typescript',
  'react',
  'angular',
  'vue',
  'node',
  'node.js',
  'sql',
  'aws',
  'azure',
  'gcp',
  'kubernetes',
  'docker',
  'spring',
  '.net',
  'dotnet',
  'c#',
  'c++',
  'golang',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'scala',
  'rust',
  'software',
  'developer',
  'programmer',
  'full stack',
  'fullstack',
  'frontend',
  'front-end',
  'backend',
  'back-end',
  'devops',
  'sde',
  'data engineer',
  'data scientist',
  'machine learning',
  ' ml ',
  'ai engineer',
  'cloud',
  'network engineer',
  'database admin',
  'dba',
  'qa engineer',
  'test automation',
  'selenium',
  'cyber security',
  'it support',
  'system admin',
  'linux admin',
  'information technology',
  'android',
  'ios',
  'flutter',
  'django',
  'flask',
  'next.js',
  'nestjs',
  'graphql',
  'mongodb',
  'postgres',
  'redis',
  'terraform',
  'jenkins',
  'git',
];

const NON_IT_CATEGORY = /non-?\s*it|non\s+it/i;

const categoryOrJobTypeSuggestsIt = (job) => {
  const raw = `${job.category || ''} ${job.jobType || ''}`;
  if (NON_IT_CATEGORY.test(raw)) return false;
  const c = raw.toLowerCase();
  return (
    c.includes('it &') ||
    c.includes('it&') ||
    c.includes('information technology') ||
    c.includes('software') ||
    c.includes('developer') ||
    c.includes('programming') ||
    c.includes('technical') ||
    /\bit\s/.test(c) ||
    c.endsWith(' it') ||
    /^it\b/i.test(c.trimStart())
  );
};

export const isItRelatedJob = (job) => {
  if (categoryOrJobTypeSuggestsIt(job)) return true;

  const hay = [
    job.title,
    job.category,
    job.jobType,
    job.skills,
    job.description,
    job.shortDescription,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return IT_TECH_KEYWORDS.some((kw) => hay.includes(kw));
};
