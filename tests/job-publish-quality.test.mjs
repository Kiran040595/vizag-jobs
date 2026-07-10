import assert from 'node:assert/strict';
import {
  getJobPublishBlockReason,
  isLowQualityJobTitle,
  isPublishableAutomationJob,
  isPublishableCompanyName,
  isPublishableJobLocation,
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

console.log('job-publish-quality.test.mjs: OK');
