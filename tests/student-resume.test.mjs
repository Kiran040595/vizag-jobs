import assert from 'node:assert/strict';
import {
  resolveResumeContentType,
  validateResumeFile,
} from '../src/lib/studentResumeFile.js';
import {
  isR2ResumePath,
  resumeOwnerUserId,
  toR2ObjectKey,
  toR2ResumePath,
} from '../src/lib/resumeStoragePath.js';

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

const userId = '11111111-2222-3333-4444-555555555555';
const r2Path = toR2ResumePath(`${userId}/resume-123.pdf`);
assert.equal(r2Path, `r2:${userId}/resume-123.pdf`);
assert.equal(isR2ResumePath(r2Path), true);
assert.equal(isR2ResumePath(`${userId}/resume-123.pdf`), false);
assert.equal(toR2ObjectKey(r2Path), `${userId}/resume-123.pdf`);
assert.equal(toR2ObjectKey(`${userId}/resume-123.pdf`), `${userId}/resume-123.pdf`);
assert.equal(resumeOwnerUserId(r2Path), userId);
assert.equal(resumeOwnerUserId(`${userId}/resume-old.pdf`), userId);
assert.equal(toR2ResumePath(r2Path), r2Path);

console.log('student-resume.test.mjs: OK');
