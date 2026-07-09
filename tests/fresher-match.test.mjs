import assert from 'node:assert/strict';
import {
  experienceContainsZero,
  isPublicFresherListingJob,
} from '../src/lib/fresherMatch.js';

let failures = 0;
const run = (label, fn) => {
  try {
    fn();
    console.log(`  OK    ${label}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${label} — ${err.message}`);
  }
};

run('is_fresher flag matches', () => {
  assert.equal(isPublicFresherListingJob({ is_fresher: true, experience: '5 years' }), true);
  assert.equal(isPublicFresherListingJob({ isFresher: 'Yes', experience: 'Not specified' }), true);
});

run('experience 0 Years matches', () => {
  assert.equal(experienceContainsZero('0 Years'), true);
  assert.equal(isPublicFresherListingJob({ is_fresher: false, experience: '0 Years' }), true);
});

run('experience 0-2 years matches', () => {
  assert.equal(experienceContainsZero('0-2 years'), true);
});

run('10 years does not match zero rule', () => {
  assert.equal(experienceContainsZero('10 years'), false);
  assert.equal(isPublicFresherListingJob({ is_fresher: false, experience: '10 years' }), false);
});

run('senior job with no flag excluded', () => {
  assert.equal(
    isPublicFresherListingJob({ is_fresher: false, experience: '5-8 years' }),
    false,
  );
});

run('title fresher alone does not match without flag or exp 0', () => {
  assert.equal(
    isPublicFresherListingJob({
      title: 'Java Fresher Developer',
      experience: 'Not specified',
      is_fresher: false,
    }),
    false,
  );
});

console.log('\n----');
if (failures === 0) {
  console.log('fresher-match.test.mjs: OK');
  process.exit(0);
} else {
  process.exit(1);
}
