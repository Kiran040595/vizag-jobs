/** UI options — ids must match Edge Function linkedin-post-presets.ts */
export const LINKEDIN_POST_PRESET_OPTIONS = [
  {
    id: 'general',
    label: 'Vizag hiring (general)',
    description: 'harvestapi~linkedin-post-search: jobs in vizag + #VizagJobs, max 10, past 24h.',
  },
  {
    id: 'it',
    label: 'IT / software',
    description: 'Software, developer, and tech hiring posts for Vizag.',
  },
  {
    id: 'bank',
    label: 'Bank / finance',
    description: 'Banking and finance hiring posts for Vizag.',
  },
  {
    id: 'custom',
    label: 'Custom search URL',
    description: 'Paste a full LinkedIn content search URL (past 24h filter in URL).',
  },
];
