/**
 * Run with: node tests/daily-blog-prompt.test.mjs
 */

import {
  DAILY_BLOG_ARTICLE_ANGLES,
  buildAdminBlogCustomizationSections,
  buildDailyBlogGeminiPrompt,
  buildDailyBlogSlug,
  parseDailyBlogGeminiJson,
  pickDailyBlogAngle,
} from '../src/lib/dailyBlogPrompt.js';

let pass = 0;
let fail = 0;

const ok = (cond, label) => {
  if (cond) {
    pass += 1;
    console.log(`  OK    ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}`);
  }
};

ok(DAILY_BLOG_ARTICLE_ANGLES.length === 7, 'seven rotating article angles');

const angle = pickDailyBlogAngle('2026-07-03T12:00:00+05:30');
ok(angle && angle.id, 'picks an angle for a date');

const slug = buildDailyBlogSlug('2026-07-03T12:00:00+05:30', angle.id);
ok(slug.startsWith('vizag-jobs-') && slug.endsWith('2026-07-03'), 'slug includes date');

const prompt = buildDailyBlogGeminiPrompt({
  jobs: [
    {
      title: 'Software Engineer',
      company: 'Acme Tech',
      category: 'it',
      slug: 'software-engineer-acme',
      path: '/jobs/it/software-engineer-acme',
    },
  ],
  webContext: 'Sample regional hiring news snippet.',
  dateInput: '2026-07-03T12:00:00+05:30',
  angle,
});

ok(prompt.includes('AdSense'), 'prompt mentions AdSense quality bar');
ok(prompt.includes('Maximum ~35%'), 'prompt limits raw job listing share');
ok(prompt.includes('Software Engineer'), 'prompt includes job data');
ok(prompt.includes('Sample regional hiring news'), 'prompt includes web context');
ok(prompt.includes('/jobs/it'), 'prompt includes internal links');
ok(prompt.includes('blank line between every paragraph'), 'prompt requires paragraph breaks');

const customSections = buildAdminBlogCustomizationSections({
  customInstructions: 'Cover pharma hiring and link to fresher jobs.',
  sourceContent: 'Original article about AP employment trends.',
  siteName: 'JobsInVizag.in',
  siteUrl: 'https://jobsinvizag.in',
});
ok(customSections.includes('Admin custom instructions'), 'custom instructions section is built');
ok(customSections.includes('Source material to rewrite'), 'source rewrite section is built');
ok(customSections.includes('pharma hiring'), 'custom instructions are included');

const customPrompt = buildDailyBlogGeminiPrompt({
  jobs: [],
  customInstructions: 'Write about campus placements in Vizag.',
  sourceContent: 'Sample external paragraph to rewrite.',
  dateInput: '2026-07-03T12:00:00+05:30',
  angle,
});
ok(customPrompt.includes('Write about campus placements in Vizag.'), 'custom prompt includes admin instructions');
ok(customPrompt.includes('Sample external paragraph to rewrite.'), 'custom prompt includes source material');
ok(customPrompt.includes('may override the default angle'), 'custom prompt notes angle override');

const parsed = parseDailyBlogGeminiJson(
  JSON.stringify({
    title: 'Vizag hiring pulse for Friday',
    slug: 'vizag-jobs-market-pulse-2026-07-03',
    excerpt: 'A concise market summary for Visakhapatnam job seekers today.',
    body: '# Heading\n\nAnalysis paragraph.',
    angle_id: 'market_pulse',
    editorial_notes: 'Focuses on sector mix rather than a raw list.',
  }),
);

ok(parsed.title.includes('Vizag'), 'parses gemini JSON title');
ok(parsed.body.includes('Heading'), 'parses gemini JSON body');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
