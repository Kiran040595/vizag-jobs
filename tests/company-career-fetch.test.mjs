import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeUrlForCompare,
  normalizeCompanyTitleKey,
  resolveCompanyJobApplyLink,
  buildCompanyExistingJobIndex,
  shouldSkipCompanyCareerJob,
  fetchAndClassifyCompanyJobs,
  optimizeSingleCompanyJob,
  publishSingleCompanyJob,
  runSingleCompanyCareerPipeline,
} from '../src/lib/companyCareerFetchAutomation.js';
import { isDirectPosting } from '../src/lib/jobDirectPosting.js';

test('Company Career Fetch: URL & Title Key Normalization', async (t) => {
  await t.test('normalizes URLs by trimming and stripping trailing slashes', () => {
    assert.equal(
      normalizeUrlForCompare('https://www.fluentgrid.com/careers///'),
      'https://www.fluentgrid.com/careers'
    );
    assert.equal(normalizeUrlForCompare(''), '');
  });

  await t.test('builds normalized company::title keys', () => {
    assert.equal(
      normalizeCompanyTitleKey('Fluentgrid Limited', 'Senior Java Developer (Vizag)'),
      'fluentgrid limited::senior java developer vizag'
    );
    assert.equal(normalizeCompanyTitleKey('', 'Java Developer'), '');
  });

  await t.test('resolves apply_link with fallback to careersUrl', () => {
    assert.equal(
      resolveCompanyJobApplyLink({ apply_link: 'null' }, 'https://wns.com/careers'),
      'https://wns.com/careers'
    );
    assert.equal(
      resolveCompanyJobApplyLink(
        { apply_link: 'https://wns.com/careers/job-123' },
        'https://wns.com/careers'
      ),
      'https://wns.com/careers/job-123'
    );
  });
});

test('Company Career Fetch: Smart Deduplication for Shared Hub Careers URL', async (t) => {
  const careersUrl = 'https://www.fluentgrid.com/careers/';
  const existingIndex = buildCompanyExistingJobIndex([
    {
      slug: 'existing-role-fluentgrid',
      company: 'Fluentgrid',
      title: 'Existing Role',
      apply_link: 'https://www.fluentgrid.com/careers',
    },
    {
      slug: 'distinct-link-role-fluentgrid',
      company: 'Fluentgrid',
      title: 'Distinct Link Role',
      apply_link: 'https://www.fluentgrid.com/careers/job-999',
    },
  ]);

  await t.test('allows a new role even if its apply_link is the shared company careersUrl', () => {
    const res = shouldSkipCompanyCareerJob(
      {
        title: 'New Angular Developer',
        company: 'Fluentgrid',
        location: 'Visakhapatnam',
        apply_link: 'https://www.fluentgrid.com/careers',
      },
      careersUrl,
      existingIndex
    );
    assert.equal(res.skip, false);
  });

  await t.test('skips a role when the same company + title is already published', () => {
    const res = shouldSkipCompanyCareerJob(
      {
        title: 'Existing Role',
        company: 'Fluentgrid',
        location: 'Visakhapatnam',
        apply_link: 'https://www.fluentgrid.com/careers',
      },
      careersUrl,
      existingIndex
    );
    assert.equal(res.skip, true);
    assert.match(res.reason, /role already published/i);
  });

  await t.test('skips a role when a distinct per-job apply_link is already in database', () => {
    const res = shouldSkipCompanyCareerJob(
      {
        title: 'Renamed Role Same Link',
        company: 'Fluentgrid',
        location: 'Visakhapatnam',
        apply_link: 'https://www.fluentgrid.com/careers/job-999/',
      },
      careersUrl,
      existingIndex
    );
    assert.equal(res.skip, true);
    assert.match(res.reason, /apply link already in database/i);
  });
});

test('Company Career Fetch: End-to-End Single-Company Pipeline Orchestration', async (t) => {
  await t.test('fetches Vizag roles, refines with Gemini SEO, skips duplicates, and publishes', async () => {
    const progressEvents = [];
    const seoCalls = [];
    const publishCalls = [];

    const mockServices = {
      fetchCompanyCareerJobs: async (_token, comp) => {
        assert.equal(comp.name, 'Miracle Software Systems');
        assert.equal(comp.careersUrl, 'https://www.miraclesoft.com/careers');
        return {
          ok: true,
          company: comp.name,
          careers_url: comp.careersUrl,
          scrape_source: 'firecrawl',
          scraped_chars: 14200,
          count: 3,
          jobs: [
            {
              title: 'Full Stack Engineer',
              company: 'Miracle Software Systems',
              location: 'Visakhapatnam',
              category: 'IT & Software',
              job_type: 'Full-time',
              apply_link: 'https://www.miraclesoft.com/careers',
              description: 'Build enterprise cloud apps in Visakhapatnam campus.',
            },
            {
              title: 'DevOps Specialist',
              company: 'Miracle Software Systems',
              location: 'Visakhapatnam',
              category: 'IT & Software',
              job_type: 'Full-time',
              apply_link: 'https://www.miraclesoft.com/careers',
              description: 'Manage Kubernetes clusters in Bhogapuram/Munjeru campus.',
            },
            {
              title: 'Already Published Role',
              company: 'Miracle Software Systems',
              location: 'Visakhapatnam',
              category: 'IT & Software',
              job_type: 'Full-time',
              apply_link: 'https://www.miraclesoft.com/careers',
              description: 'Already exists in DB.',
            },
          ],
        };
      },
      seoOptimizeExternalJob: async (_token, job) => {
        seoCalls.push(job.title);
        const slugBase = job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return {
          ok: true,
          gemini_model: 'gemini-2.5-flash',
          runtime_ms: 850,
          seo_profile: 'jobPosting_v1',
          job: {
            ...job,
            slug: `${slugBase}-miracle-vizag`,
            short_description: `SEO refined summary for ${job.title} in Visakhapatnam.`,
            description: `Detailed SEO refined job description for ${job.title} at Miracle Software Systems in Visakhapatnam.`,
            responsibilities: ['Develop scalable services', 'Collaborate with Vizag engineering team'],
            eligibility: ['B.Tech / M.C.A', 'Strong problem solving skills'],
            skills: ['JavaScript', 'Cloud', 'CI/CD'],
          },
        };
      },
      createAdminJob: async (job, status) => {
        publishCalls.push({ title: job.title, status, slug: job.slug });
        return {
          ...job,
          id: `job-${publishCalls.length}`,
          status,
        };
      },
    };

    const existingJobs = [
      {
        id: 'existing-1',
        slug: 'already-published-role-miracle',
        company: 'Miracle Software Systems',
        title: 'Already Published Role',
        apply_link: 'https://www.miraclesoft.com/careers',
      },
    ];

    const { report, publishedJobs } = await runSingleCompanyCareerPipeline({
      company: {
        name: 'Miracle Software Systems',
        careersUrl: 'https://www.miraclesoft.com/careers',
        category: 'IT & Software',
        location: 'Visakhapatnam',
      },
      accessToken: 'mock.jwt.token',
      existingJobs,
      seoGapMs: 0,
      onProgress: (ev) => progressEvents.push(ev.phase),
      services: mockServices,
    });

    assert.equal(report.stats.fetched, 3);
    assert.equal(report.stats.queued, 2);
    assert.equal(report.stats.seoOk, 2);
    assert.equal(report.stats.published, 2);
    assert.equal(report.stats.skipped, 1);
    assert.equal(publishedJobs.length, 2);
    assert.deepEqual(seoCalls, ['Full Stack Engineer', 'DevOps Specialist']);
    assert.equal(publishCalls.length, 2);
    assert.equal(publishCalls[0].status, 'published');

    // Verify published jobs qualify as Verified Direct Company postings
    for (const pub of publishedJobs) {
      assert.equal(pub.source_name, 'Direct Company Website');
      assert.equal(isDirectPosting(pub), true);
    }

    assert.ok(progressEvents.includes('fetching'));
    assert.ok(progressEvents.includes('seo'));
    assert.ok(progressEvents.includes('publishing'));
    assert.equal(progressEvents.at(-1), 'done');
  });

  await t.test('handles 0 Vizag roles found cleanly', async () => {
    const { report, publishedJobs } = await runSingleCompanyCareerPipeline({
      company: {
        name: 'Tech Mahindra',
        careersUrl: 'https://careers.techmahindra.com',
      },
      accessToken: 'mock.jwt.token',
      existingJobs: [],
      seoGapMs: 0,
      services: {
        fetchCompanyCareerJobs: async () => ({
          ok: true,
          scrape_source: 'firecrawl',
          scraped_chars: 5000,
          jobs: [],
        }),
      },
    });

    assert.equal(report.stats.fetched, 0);
    assert.equal(report.stats.published, 0);
    assert.equal(publishedJobs.length, 0);
  });
});

test('Company Career Fetch: Modular Approval Steps (Pre-Optimize & Post-Optimize)', async (t) => {
  const company = {
    name: 'Pfizer',
    careersUrl: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers',
    category: 'Healthcare',
  };

  const existingJobs = [
    {
      id: 'existing-pfizer-1',
      title: 'Old Published Role',
      company: 'Pfizer',
      apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/1',
      slug: 'old-published-role-pfizer',
    },
  ];

  await t.test('fetchAndClassifyCompanyJobs flags duplicates and marks new roles for SEO', async () => {
    const mockServices = {
      fetchCompanyCareerJobs: async () => ({
        ok: true,
        scrape_source: 'workday_cxs',
        scraped_chars: 12000,
        jobs: [
          {
            title: 'Team Leader',
            company: 'Pfizer',
            location: 'Visakhapatnam',
            apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/Team-Leader_4960223',
            description: 'Lead manufacturing shift operations in Vizag.',
          },
          {
            title: 'Old Published Role',
            company: 'Pfizer',
            location: 'Visakhapatnam',
            apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/1',
            description: 'Already exists.',
          },
        ],
      }),
    };

    const res = await fetchAndClassifyCompanyJobs({
      company,
      accessToken: 'test-token',
      existingJobs,
      services: mockServices,
    });

    assert.equal(res.companyName, 'Pfizer');
    assert.equal(res.scrapeSource, 'workday_cxs');
    assert.equal(res.jobs.length, 2);

    const teamLeader = res.jobs.find((j) => j.title === 'Team Leader');
    assert.ok(teamLeader);
    assert.equal(teamLeader.isDuplicate, false);
    assert.equal(teamLeader.selectedForSeo, true);

    const oldRole = res.jobs.find((j) => j.title === 'Old Published Role');
    assert.ok(oldRole);
    assert.equal(oldRole.isDuplicate, true);
    assert.equal(oldRole.selectedForSeo, false);
    assert.match(oldRole.duplicateReason, /already published/i);
  });

  await t.test('optimizeSingleCompanyJob produces SEO refined fields', async () => {
    const rawJob = {
      title: 'Team Leader',
      company: 'Pfizer',
      location: 'Visakhapatnam',
      apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/Team-Leader_4960223',
      description: 'Raw description.',
    };

    const mockServices = {
      seoOptimizeExternalJob: async (_token, j) => ({
        ok: true,
        job: {
          ...j,
          slug: 'team-leader-pfizer-vizag',
          short_description: 'Join Pfizer in Visakhapatnam as Team Leader.',
          description: 'Refined SEO description for Team Leader at Pfizer Vizag.',
          responsibilities: ['Oversee batch manufacturing'],
          skills: ['cGMP', 'Quality Compliance'],
        },
      }),
    };

    const optimized = await optimizeSingleCompanyJob({
      job: rawJob,
      company,
      accessToken: 'test-token',
      services: mockServices,
    });

    assert.equal(optimized.title, 'Team Leader');
    assert.equal(optimized.slug, 'team-leader-pfizer-vizag');
    assert.equal(optimized.seo_optimized, true);
    assert.equal(optimized.source_name, 'Direct Company Website');
    assert.ok(optimized.responsibilities.includes('Oversee batch manufacturing'));
  });

  await t.test('publishSingleCompanyJob inserts to DB and updates existing index', async () => {
    const existingIndex = buildCompanyExistingJobIndex([]);
    const jobToPublish = {
      title: 'Team Leader',
      company: 'Pfizer',
      location: 'Visakhapatnam',
      slug: 'team-leader-pfizer-vizag',
      apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/Team-Leader_4960223',
    };

    let publishCalled = false;
    const mockServices = {
      createAdminJob: async (job, status) => {
        publishCalled = true;
        assert.equal(status, 'published');
        return { ...job, id: 'job-pfizer-1', status };
      },
    };

    const published = await publishSingleCompanyJob({
      job: jobToPublish,
      company,
      existingIndex,
      services: mockServices,
    });

    assert.equal(publishCalled, true);
    assert.equal(published.id, 'job-pfizer-1');
    assert.ok(existingIndex.slugs.has('team-leader-pfizer-vizag'));
    assert.ok(existingIndex.companyTitleKeys.has('pfizer::team leader'));
  });
});
