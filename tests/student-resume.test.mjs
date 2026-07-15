import assert from 'node:assert/strict';
import {
  resolveResumeContentType,
  validateResumeFile,
} from '../src/lib/studentResumeFile.js';

assert.equal(resolveResumeContentType('resume.pdf', ''), 'application/pdf');
assert.equal(resolveResumeContentType('resume.pdf', 'application/octet-stream'), 'application/pdf');
assert.equal(resolveResumeContentType('resume.doc', 'application/octet-stream'), 'application/msword');
assert.equal(
  resolveResumeContentType('resume.docx', ''),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);
assert.equal(
  resolveResumeContentType('resume.docx', 'application/zip'),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);
assert.equal(resolveResumeContentType('resume.pdf', 'application/pdf'), 'application/pdf');

assert.equal(validateResumeFile(null), '');
assert.equal(validateResumeFile(undefined), '');

const validPdf = { name: 'resume.pdf', size: 1024 };
assert.equal(validateResumeFile(validPdf), '');

const invalidType = { name: 'resume.txt', size: 1024 };
assert.match(validateResumeFile(invalidType), /PDF or Word/i);

const tooLarge = { name: 'resume.pdf', size: 6 * 1024 * 1024 };
assert.match(validateResumeFile(tooLarge), /5 MB/i);

console.log('student-resume.test.mjs: OK');
