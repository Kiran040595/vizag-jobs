import assert from 'node:assert/strict';
import { cleanJobRoleLabel, looksLikeSeoJobTitle } from '../src/lib/jobRoleLabel.js';
import { buildLiveRoleOptions } from '../src/lib/studentCareerPreferences.js';

assert.equal(
  cleanJobRoleLabel(
    'Java Back End Developer Jobs in Vizag at Shvintech India | Fresher | Apply Now',
  ),
  'Java Back End Developer',
);

assert.equal(
  cleanJobRoleLabel(
    'Associate - MSAT (C&Q) Jobs in Vizag at Pfizer | Experienced | Apply Now',
  ),
  'Associate - MSAT (C&Q)',
);

assert.equal(cleanJobRoleLabel('Sales Executive (Vizag)'), 'Sales Executive');
assert.equal(cleanJobRoleLabel('Field Sales Executive'), 'Field Sales Executive');
assert.equal(
  cleanJobRoleLabel('Ab Initio Developer Jobs in Vizag at Tata Consultancy Services | Experienced | Apply Now'),
  'Ab Initio Developer',
);

assert.equal(looksLikeSeoJobTitle('Java Developer Jobs in Vizag | Apply Now'), true);
assert.equal(looksLikeSeoJobTitle('Java Developer'), false);

const options = buildLiveRoleOptions(
  [
    {
      role: 'Java Back End Developer Jobs in Vizag at Shvintech India | Fresher | Apply Now',
      usageCount: 4,
    },
    {
      role: 'Java Back End Developer Jobs in Vizag at Another Co | Experienced | Apply Now',
      usageCount: 2,
    },
    { role: 'Sales Executive (Vizag)', usageCount: 5 },
  ],
  10,
);

assert.equal(options.length, 2);
assert.equal(options[0].label, 'Java Back End Developer');
assert.equal(options[0].value, 'java_back_end_developer');
assert.equal(options[1].label, 'Sales Executive');
assert.equal(cleanJobRoleLabel('Vizag Relationship Manager Jobs'), 'Relationship Manager');
assert.equal(
  cleanJobRoleLabel('Business Development Executive Jobs in Vizag'),
  'Business Development Executive',
);

console.log('job-role-label.test.mjs: OK');
