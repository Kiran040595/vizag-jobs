/**
 * Admin external fetch channels — must match Edge Function `fetch_channel` values.
 */
export const EXTERNAL_FETCH_SOURCES = [
  {
    id: 'naukri',
    title: 'Naukri',
    description: 'Naukri job-listings in Visakhapatnam / Vizag (past 24h when dates parse).',
    providerHint: 'Firecrawl',
    secretHint: 'FIRECRAWL_API_KEY_NAUKRI, FIRECRAWL_API_KEYS',
    accent: 'border-amber-200 bg-amber-50 hover:border-amber-300',
  },
  {
    id: 'linkedin_jobs',
    title: 'LinkedIn Jobs',
    description: 'Formal LinkedIn Jobs listings for Vishakhapatnam (Apify jobs scraper).',
    providerHint: 'Apify',
    secretHint: 'APIFY_API_TOKEN_LINKEDIN_JOBS',
    accent: 'border-sky-200 bg-sky-50 hover:border-sky-300',
  },
  {
    id: 'linkedin_posts',
    title: 'LinkedIn Posts',
    description: 'Hiring posts from LinkedIn feed search (vizag, past 24h). Apify harvestapi + optional Gemini parse.',
    providerHint: 'Apify + Gemini',
    secretHint: 'APIFY_API_TOKEN (or APIFY_API_TOKEN_LINKEDIN_POSTS), GEMINI_API_KEY_LINKEDIN_POSTS',
    accent: 'border-indigo-200 bg-indigo-50 hover:border-indigo-300',
  },
  {
    id: 'vizag_it',
    title: 'Vizag IT companies',
    description: 'IT / software roles from LinkedIn and Naukri via targeted search queries.',
    providerHint: 'Firecrawl',
    secretHint: 'FIRECRAWL_API_KEY_VIZAG_IT, FIRECRAWL_API_KEYS',
    accent: 'border-violet-200 bg-violet-50 hover:border-violet-300',
  },
  {
    id: 'indeed',
    title: 'Indeed',
    description: 'Indeed job detail pages for Vizag / Visakhapatnam.',
    providerHint: 'Firecrawl',
    secretHint: 'FIRECRAWL_API_KEY_INDEED, FIRECRAWL_API_KEYS',
    accent: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300',
  },
];
