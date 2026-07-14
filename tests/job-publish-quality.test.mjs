import assert from 'node:assert/strict';
import {
  getJobPublishBlockReason,
  isLowQualityJobTitle,
  isPublishableAutomationJob,
  isPublishableCompanyName,
  isPublishableJobLocation,
  recoverPublishableFieldsFromOriginal,
} from '../src/lib/jobPublishQuality.js';

const googleHubJob = {
  title: 'Google AI Hub & Data Center Jobs in Vizag, Visakhapatnam',
  company: 'Employer name shared during interview',
  location:
    'Visakhapatnam / Vizag, ArtificialIntelligence, DataCenters, Sustainability, CloudComputing, SoftwareEngineering, AndhraPradesh.',
};

assert.equal(isPublishableCompanyName('Infosys'), true);
assert.equal(isPublishableCompanyName('Employer name shared during interview'), false);
assert.equal(isPublishableCompanyName('Unknown'), false);

assert.equal(isLowQualityJobTitle(googleHubJob.title), true);
assert.equal(isLowQualityJobTitle('Java Developer'), false);
assert.equal(isLowQualityJobTitle('Software Engineer — TCS'), false);
// Old Gemini Task 1 pattern — dual-city / "Jobs in …" titles must stay blocked
assert.equal(isLowQualityJobTitle('Pipeline Engineer Jobs in Visakhapatnam (Vizag) | Oil & Gas'), true);
assert.equal(isLowQualityJobTitle('Sales Executive (Vizag)'), false);

assert.equal(isPublishableJobLocation('Visakhapatnam'), true);
assert.equal(isPublishableJobLocation(googleHubJob.location), false);

assert.equal(isPublishableAutomationJob(googleHubJob), false);
const reason = getJobPublishBlockReason(googleHubJob);
assert.ok(reason, 'aggregate job should be blocked');
assert.match(reason, /title|company|location/i);

const goodJob = {
  title: 'Graduate Engineer Trainee',
  company: 'Hindustan Shipyard Limited',
  location: 'Visakhapatnam',
};
assert.equal(isPublishableAutomationJob(goodJob), true);
assert.equal(getJobPublishBlockReason(goodJob), null);

const recovered = recoverPublishableFieldsFromOriginal(
  {
    title: 'Treasury Manager',
    company: 'Devi Sea Foods Limited',
    location: 'Visakhapatnam',
  },
  {
    title: 'Treasury Manager Jobs in Visakhapatnam (Vizag) | Finance',
    company: 'Employer name shared during interview',
    location:
      'Visakhapatnam / Vizag, ArtificialIntelligence, DataCenters, CloudComputing, AndhraPradesh.',
    description: 'SEO body…',
  },
);
assert.equal(recovered.title, 'Treasury Manager');
assert.equal(recovered.company, 'Devi Sea Foods Limited');
assert.equal(recovered.location, 'Visakhapatnam');
assert.equal(isPublishableAutomationJob(recovered), true);

console.log('job-publish-quality.test.mjs: OK');
