import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Verify LinkCompanyModal component exists and has required features
const modalPath = path.join(repoRoot, 'src/components/admin/LinkCompanyModal.jsx');
assert.ok(existsSync(modalPath), 'LinkCompanyModal.jsx must exist');

const modalSrc = readFileSync(modalPath, 'utf8');

// Header & Job summary
assert.match(modalSrc, /Link Job to Company/i, 'Modal must have title "Link Job to Company"');
assert.match(modalSrc, /Selected Job/i, 'Modal must display selected job summary');

// Zero Data Loss Guarantee
assert.match(modalSrc, /Zero Data Loss Guaranteed/i, 'Modal must display zero data loss guarantee');
assert.match(modalSrc, /application\(s\) preserved/i, 'Modal must indicate applications are preserved safely');

// Search & Company selection
assert.match(modalSrc, /Search companies by name/i, 'Modal must include real-time search input for employers');
assert.match(modalSrc, /selected_employer/i, 'Modal must include radio inputs to select company');

// Display Company Sync Checkbox
assert.match(modalSrc, /syncCompanyName/i, 'Modal must support syncCompanyName state');
assert.match(modalSrc, /Sync job display company name to/i, 'Modal must have checkbox to sync display company name');

// Actions: Link & Unlink
assert.match(modalSrc, /assignJobsToEmployer/i, 'Modal must call assignJobsToEmployer');
assert.match(modalSrc, /moveJobsToAdmin/i, 'Modal must support unlinking via moveJobsToAdmin');
assert.match(modalSrc, /Unlink \(Move to Admin\)/i, 'Modal must offer unlink button for already linked jobs');

// Escape stacking contexts & backdrop-blur via createPortal
assert.match(modalSrc, /createPortal\(modalNode,\s*document\.body\)/, 'Modal must be portaled into document.body to avoid parent CSS clipping');
assert.match(modalSrc, /document\.body\.style\.overflow\s*=\s*'hidden'/, 'Modal must lock body scroll when open');

// 2. Verify AdminJobsPage.jsx integration
const adminJobsPageSrc = readFileSync(path.join(repoRoot, 'src/pages/AdminJobsPage.jsx'), 'utf8');
assert.match(adminJobsPageSrc, /import LinkCompanyModal from '\.\.\/components\/admin\/LinkCompanyModal';/, 'AdminJobsPage must import LinkCompanyModal');
assert.match(adminJobsPageSrc, /const \[linkingJob, setLinkingJob\] = useState\(null\);/, 'AdminJobsPage must manage linkingJob state');
assert.match(adminJobsPageSrc, /🔗 Link Company/, 'AdminJobsPage must render Link Company button on job card');
assert.match(adminJobsPageSrc, /<LinkCompanyModal[\s\S]*?job={linkingJob}/, 'AdminJobsPage must render LinkCompanyModal when linkingJob is present');

// 2b. Verify AdminEditJobPage.jsx integration
const adminEditJobPageSrc = readFileSync(path.join(repoRoot, 'src/pages/AdminEditJobPage.jsx'), 'utf8');
assert.match(adminEditJobPageSrc, /import LinkCompanyModal from '\.\.\/components\/admin\/LinkCompanyModal';/, 'AdminEditJobPage must import LinkCompanyModal');
assert.match(adminEditJobPageSrc, /const \[isLinking, setIsLinking\] = useState\(false\);/, 'AdminEditJobPage must manage isLinking state');
assert.match(adminEditJobPageSrc, /<LinkCompanyModal[\s\S]*?isOpen={isLinking}/, 'AdminEditJobPage must render LinkCompanyModal when isLinking is true');

// 2c. Verify JobCard.jsx integration (Home page and general listings)
const jobCardSrc = readFileSync(path.join(repoRoot, 'src/components/JobCard.jsx'), 'utf8');
assert.match(jobCardSrc, /import LinkCompanyModal from '\.\/admin\/LinkCompanyModal';/, 'JobCard must import LinkCompanyModal');
assert.match(jobCardSrc, /const \{ isAdmin \} = useAdminAuth\(\);/, 'JobCard must check admin auth');
assert.match(jobCardSrc, /const \[isLinkCompanyOpen, setIsLinkCompanyOpen\] = useState\(false\);/, 'JobCard must manage isLinkCompanyOpen state');
assert.match(jobCardSrc, /🔗[\s\S]*?Link Company/, 'JobCard must render Link Company button for admins');
assert.match(jobCardSrc, /<LinkCompanyModal[\s\S]*?isOpen={isLinkCompanyOpen}/, 'JobCard must render LinkCompanyModal when isLinkCompanyOpen is true');

// 2d. Verify JobList.jsx passes job prop to JobCard
const jobListSrc = readFileSync(path.join(repoRoot, 'src/components/JobList.jsx'), 'utf8');
assert.match(jobListSrc, /<JobCard[\s\S]*?job={job}/, 'JobList must pass job object to JobCard');

// 2e. Verify AdminJobActionsBar.jsx integration
const adminActionsBarSrc = readFileSync(path.join(repoRoot, 'src/components/admin/AdminJobActionsBar.jsx'), 'utf8');
assert.match(adminActionsBarSrc, /import LinkCompanyModal from '\.\/LinkCompanyModal';/, 'AdminJobActionsBar must import LinkCompanyModal');
assert.match(adminActionsBarSrc, /const \[isLinkCompanyOpen, setIsLinkCompanyOpen\] = useState\(false\);/, 'AdminJobActionsBar must manage isLinkCompanyOpen state');
assert.match(adminActionsBarSrc, /🔗 Link Company/, 'AdminJobActionsBar must render Link Company button');
assert.match(adminActionsBarSrc, /<LinkCompanyModal[\s\S]*?isOpen={isLinkCompanyOpen}/, 'AdminJobActionsBar must render LinkCompanyModal');

// 3. Verify adminJobs service supports syncCompanyName
const adminJobsSrc = readFileSync(path.join(repoRoot, 'src/services/adminJobs.js'), 'utf8');
assert.match(adminJobsSrc, /export const assignJobsToEmployer = async \(\{\s*jobIds,\s*employerUserId,\s*syncCompanyName = true\s*\}\)/, 'assignJobsToEmployer must accept syncCompanyName parameter');
assert.match(adminJobsSrc, /if \(syncCompanyName && companyName\)/, 'assignJobsToEmployer must conditionally sync company name');

// 4. Verify employerJobs fetchMyJobs queries jobs by created_by
const employerJobsSrc = readFileSync(path.join(repoRoot, 'src/services/employerJobs.js'), 'utf8');
assert.match(employerJobsSrc, /\.eq\('created_by',\s*currentUserId\)/, 'Employer jobs must query by created_by so linked jobs appear immediately upon employer login');

console.log('admin-link-company.test.mjs: ALL ASSERTIONS PASSED!');
