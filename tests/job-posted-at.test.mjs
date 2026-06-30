import assert from 'node:assert/strict';

import {
  applySystemPostedAtToPayload,
  shouldUseSystemPostedAtOnPublish,
} from '../src/lib/jobPostedAt.js';

const fixedNow = '2026-06-30T12:00:00.000Z';
const realDate = Date;
global.Date = class extends realDate {
  constructor(...args) {
    if (args.length === 0) {
      super(fixedNow);
      return;
    }
    super(...args);
  }

  static now() {
    return new realDate(fixedNow).getTime();
  }
};

try {
  assert.equal(shouldUseSystemPostedAtOnPublish('published', 'draft'), true);
  assert.equal(shouldUseSystemPostedAtOnPublish('published', 'published'), false);
  assert.equal(shouldUseSystemPostedAtOnPublish('draft', 'draft'), false);

  const payload = applySystemPostedAtToPayload({
    title: 'Test',
    posted_at: '2026-06-22T00:00:00.000Z',
    json_ld: { '@type': 'JobPosting', datePosted: '2026-06-22T00:00:00.000Z' },
    seo_meta: { json_ld: { datePosted: '2026-06-22T00:00:00.000Z' } },
  });

  assert.equal(payload.posted_at, fixedNow);
  assert.equal(payload.json_ld.datePosted, fixedNow);
  assert.equal(payload.seo_meta.json_ld.datePosted, fixedNow);

  console.log('job-posted-at.test.mjs: OK');
} finally {
  global.Date = realDate;
}
