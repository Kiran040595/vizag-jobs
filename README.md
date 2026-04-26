# Vizag Jobs

A job portal website for Visakhapatnam (Vizag) built with React and Vite.

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

## Google Sheets Integration

The app fetches jobs from your deployed Apps Script JSON endpoint:

- [Google Apps Script Jobs API](https://script.google.com/macros/s/AKfycbw_dL3Xy6YNkN0schsB_yLhjNAJdQWhhA0VNO8yiP5xsLpDzaZcexyS5kxA1lbtLCObkw/exec)

Setup:

1. Create a `.env` file from `.env.example`.
2. Set `VITE_JOBS_API_URL` if you want to override the default URL.
3. Ensure the Apps Script deployment is public and returns a JSON array of jobs.

Supported fields from each job object:

- `id`, `title`, `company`, `location`, `category`, `jobType`, `experience`
- `isFresher`, `salary`, `applyLink`, `description`, `postedAt`, `source`
- `companyLogo` (optional)

If the API is unavailable or returns an empty list, the app falls back to local sample jobs.

## Build for Production

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```
