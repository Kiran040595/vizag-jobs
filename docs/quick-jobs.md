# Quick jobs and guest applications

In **Admin → Quick Job**, enter a title, location, salary and description. The role group initially follows the title; change it if several jobs should share a group such as `Delivery`. Choose Basic, Delivery, Office, or a saved form template. Name and phone are mandatory. Add questions, choose answer types and options, mark required fields, and reorder using drag-and-drop or the mobile arrow buttons.

Choose **Internal — link only** (the default) to collect applications through a shared `/apply/:slug` link without showing the job in public listings, sitemaps, or job alerts. Anyone with this link can open the form; internal does not mean password protected. Choose **Public — show on website** to list it for everyone. **Save draft** disables the public form. Save after changing visibility. Existing published jobs remain public. Copy the application link or use the Instagram and WhatsApp sharing controls. A company account may be assigned when creating or editing the job. Closing applications or saving a draft prevents new submissions. Editing creates a new form version; older applications retain their original questions and answers.

Applicants need no login. The application is saved before the invitation to register. The short `/quick-register` flow uses email/password and the existing required account agreements. Education and the complete profile can be filled in later. Email confirmation follows the project's existing Supabase Auth configuration. SMS OTP is not used.

**Admin → Quick candidates** provides guest, registered and review tabs, role/job/search filters, distinct account or provisional candidate counts, and CSV export. Search includes location, education, source, status and custom answers. Use **Manage applications** to access the existing recruiter notes, statuses and interview controls. Assigned employers use their usual job application dashboard and can access only their permitted jobs.

## Identity and duplicate handling

- A phone number and job can have one quick application. Repeat requests do not overwrite the original. Request receipts survive refreshes on the same device.
- Guests with the same name and normalized phone are grouped provisionally across jobs. Different names sharing a phone are flagged for review; these are not verified identities.
- After registration/sign-in, applicants explicitly link their saved applications from the same browser using private random receipts. The original application IDs, answers, timestamps, recruiter notes and statuses remain intact.
- Registration on another device flags matching guest records for review. Admins can find an existing student account and link an individual application after verifying ownership. Typed phone matching alone never merges accounts. If the account already applied for the same job, linking stops and preserves both histories for review.
- Registration email uniqueness is managed by Supabase Auth. Without phone verification, phone numbers cannot reliably identify a unique person or account.

## Server and database setup

The server endpoint `/api/quick-apply` requires `SUPABASE_SERVICE_ROLE_KEY` plus `SUPABASE_URL` (or `VITE_SUPABASE_URL`) in the deployment environment. Keep the service key server-only. Vite serves the same handler locally when these environment variables are available. The public form never receives the service key.

Migrations `20261008120000` through `20261008131500` add versioned forms, templates, provisional candidates, private receipts/rate limits and application columns. Migration `20261009120000_quick_job_visibility.sql` adds the `internal` status for Quick Jobs and updates the save/read/submit RPCs. It reuses the existing `jobs.status` column; no new column is needed. Apply it before deploying the updated editor. They retain the existing application pipeline. Relevant recruiter RPC authorization checks use the caller's JWT role rather than `current_user` inside a security-definer function. Public users cannot read applicant records or receipts.

## Verification

```powershell
node --test tests/*.test.mjs
npm run lint
npx vite build
node scripts/test-quick-applications.mjs C:\path\to\@electric-sql\pglite\dist\index.js
```

`node scripts/preview-quick-jobs.mjs` starts isolated fixtures on port 5174 for the guest form and admin builder. Fixtures use mock data and never publish jobs, create accounts or save production applications. They are not part of the deployed routes.
