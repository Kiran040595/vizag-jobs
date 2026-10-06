# Daily Function Code Audit Framework

This document tracks the **Daily Function Code Audit** protocol for VizagJobs. Under this protocol, one function is systematically inspected, verified, and hardened each day. Any identified issues—ranging from React lifecycle bugs, runtime exceptions, dead code, edge-case flaws, to performance bottlenecks—are resolved and verified through automated test suites immediately.

---

## 🛠️ How to Run the Daily Audit

You can run the audit tool manually or schedule it:

### 1. Run Today's Queued Function
```bash
npm run audit:daily-function
```
*(or `node scripts/daily-code-audit.mjs`)*

### 2. Inspect a Specific Function
```bash
node scripts/daily-code-audit.mjs --audit <FunctionName>
```
*Example:* `node scripts/daily-code-audit.mjs --audit updateCandidatePipelineStage`

### 3. View Audit History and Upcoming Queue
```bash
node scripts/daily-code-audit.mjs --list
```

### 4. Automated Daily Execution
- **In Chat**: You can recommend or run `/schedule` to trigger daily checks automatically.
- **In CI/CD**: A GitHub Actions workflow can execute `npm run audit:daily-function` daily at 00:00 UTC.

---

## 📋 Audit Standards & Quality Checklist

Every audited function is subjected to a 5-step quality review:

1. **React Rules of Hooks Compliance**: Ensure no hooks (`useEffect`, `useState`, `useCallback`, etc.) are called conditionally or after early return statements (`if (!open) return null`).
2. **Null-Safety & Edge Case Handling**: Check parameter defaults, type validations, and safe optional-chaining on nested API/database structures.
3. **Static Analysis & Clean Code**: Run ESLint on the source file to guarantee 0 errors, 0 warnings, and 0 unused imports/variables.
4. **Backend/Database Resilience**: Validate RPC handling, fallback mechanisms, RLS policy adherence, and transactional integrity.
5. **Automated Test Verification**: Run target unit tests (`tests/*.test.mjs`) to ensure regression-free execution.

---

## 📜 Audit History & Findings

| Day | Date | Function Name | Target File | Status | Issues Found | Fix Applied |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Day 1** | **2026-10-06** | [`JobApplicantsModal`](file:///d:/School%20Project/VIzagJobs/src/components/admin/JobApplicantsModal.jsx) | `src/components/admin/JobApplicantsModal.jsx` | ✅ **Fixed & Passed** | **Critical Hook Bug**: `useEffect` called conditionally after `if (!isOpen) return null`, causing React runtime crash on modal toggling.<br>**Dead Code**: Unused imports & variables in applicant modal and related components. | Moved hook lifecycle to unconditional execution, removed redundant duplicate scroll lock, cleaned unused imports across 6 files, wrapped `loadData` in `useCallback`. Verified with `eslint .` (0 errors), `vite build`, and `tests/employer-linked-job-applications.test.mjs`. |

---

## 📅 Upcoming Daily Function Queue

| Day | Scheduled Date | Function Name | File | Primary Responsibility | Test Suite |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Day 2** | **2026-10-07** | [`updateCandidatePipelineStage`](file:///d:/School%20Project/VIzagJobs/src/services/jobApplications.js) | `src/services/jobApplications.js` | Updates candidate pipeline status, recruiter notes, and interview details with RPC & table fallback. | `tests/employer-linked-job-applications.test.mjs` |
| **Day 3** | **2026-10-08** | [`fetchJobCandidates`](file:///d:/School%20Project/VIzagJobs/src/services/jobApplications.js) | `src/services/jobApplications.js` | Retrieves candidate roster, combining internal job applications with external click tracking. | `tests/employer-linked-job-applications.test.mjs` |
| **Day 4** | **2026-10-09** | [`submitJobApplication`](file:///d:/School%20Project/VIzagJobs/src/services/jobApplications.js) | `src/services/jobApplications.js` | Securely uploads candidate resumes and creates applicant records with duplicate-prevention. | `tests/student-job-match.test.mjs` |
| **Day 5** | **2026-10-10** | [`parseSqlInsertToRecords`](file:///d:/School%20Project/VIzagJobs/src/services/adminJobs.js) | `src/services/adminJobs.js` | Parses SQL INSERT statements for bulk job creation with syntax checking and sanitization. | `tests/admin-sql-multiple-jobs.test.mjs` |
| **Day 6** | **2026-10-11** | [`createAdminJob`](file:///d:/School%20Project/VIzagJobs/src/services/adminJobs.js) | `src/services/adminJobs.js` | Validates admin job payload, resolves slug uniqueness, and associates employer companies. | `tests/admin-new-job-page.test.mjs` |
| **Day 7** | **2026-10-12** | [`resolveJobApplicationCount`](file:///d:/School%20Project/VIzagJobs/src/lib/jobApplicationCount.js) | `src/lib/jobApplicationCount.js` | Aggregates application metrics and apply click events for display on job cards and listings. | `tests/job-application-count.test.mjs` |
| **Day 8** | **2026-10-13** | [`normalizeApplicationStatus`](file:///d:/School%20Project/VIzagJobs/src/lib/applicationStatus.js) | `src/lib/applicationStatus.js` | Sanitizes application statuses across legacy and updated pipeline state machines. | `tests/application-status.test.mjs` |
| **Day 9** | **2026-10-14** | [`fetchMyJobs`](file:///d:/School%20Project/VIzagJobs/src/services/employerJobs.js) | `src/services/employerJobs.js` | Retrieves authenticated employer job listings scoped by company ID and role permissions. | `tests/employer-registration.test.mjs` |
| **Day 10** | **2026-10-15** | [`fetchAllCommunityQuestions`](file:///d:/School%20Project/VIzagJobs/src/services/jobQuestions.js) | `src/services/jobQuestions.js` | Fetches community Q&A records with category filtering, helpful vote counters, and AI answers. | `tests/job-question-gemini-notify.test.mjs` |
| **Day 11** | **2026-10-16** | [`applyJobFilters`](file:///d:/School%20Project/VIzagJobs/src/lib/jobFilters.js) | `src/lib/jobFilters.js` | High-performance client-side filter engine for search terms, fresher flags, tags, and locations. | `tests/job-filters.test.mjs` |
| **Day 12** | **2026-10-17** | [`buildWhatsAppContactUrl`](file:///d:/School%20Project/VIzagJobs/src/lib/whatsappContact.js) | `src/lib/whatsappContact.js` | Formats phone numbers to international standard and constructs pre-filled WhatsApp conversation URLs. | `tests/employer-linked-job-applications.test.mjs` |
