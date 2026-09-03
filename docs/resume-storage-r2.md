# Resume storage (dual backend)

New student resume uploads go to **Cloudflare R2**. Older resumes already in Supabase Storage keep working.

## Path convention

| `resume_path` value | Backend |
|---------------------|---------|
| `r2:{userId}/resume-{ts}.ext` | Cloudflare R2 |
| `{userId}/resume-{ts}.ext` (no prefix) | Supabase bucket `student-resumes` |

## Environment variables

Set on **Vercel** (Production + Preview):

| Variable | Purpose |
|----------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | Private bucket name (e.g. `resume`) |
| `R2_ENDPOINT` | Optional; defaults to `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as `VITE_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; needed for `/r/{token}` R2 lookups |

Also set the `R2_*` secrets on the Supabase Edge Function **`resume-share`** so share links still work when proxied to the function:

```bash
supabase secrets set \
  R2_ACCOUNT_ID=... \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET_NAME=...
```

Redeploy the function after changing secrets:

```bash
supabase functions deploy resume-share
```

## Flow

1. Student applies → `POST /api/resume/upload-url` (JWT) → presigned R2 PUT → file uploaded → `r2:…` path saved on profile + application
2. Admin views resume → `createResumeSignedUrl` → R2 paths use `POST /api/resume/signed-url`; Supabase paths use Storage signed URLs
3. Excel/company share → `/r/{token}` → Vercel serves R2 directly when configured, otherwise proxies to `resume-share`
