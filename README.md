# Vizag Jobs

A job portal website for Visakhapatnam (Vizag) built with React, Vite, and Supabase.

## Features

- Browse job listings in Visakhapatnam
- Search jobs by title or company
- Responsive design

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Supabase Integration

The app fetches jobs directly from Supabase.

Quick start:

1. Create a `.env` file from `.env.example`.
2. Create your Supabase project.
3. Run [supabase/migrations/20260427_create_jobs_schema.sql](./supabase/migrations/20260427_create_jobs_schema.sql) in the Supabase SQL Editor.
4. Optionally run [supabase/seed.sql](./supabase/seed.sql) for sample rows.
5. Add your project URL and anon key to `.env`.

Detailed setup steps are in [docs/supabase-setup.md](./docs/supabase-setup.md).

## Build for Production

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```
