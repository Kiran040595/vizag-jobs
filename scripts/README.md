# Google Apps Script for Vizag Jobs API

This folder contains the Google Apps Script code that powers the Vizag Jobs API.

## 📋 Current Implementation

The current Apps Script code works well with your React application. It:

- ✅ Fetches all jobs from your Google Sheet
- ✅ Returns data in JSON format
- ✅ Has basic error handling
- ✅ Is already deployed and working

## 🚀 Deployment Instructions

1. **Open Google Apps Script:**
   - Go to [script.google.com](https://script.google.com)
   - Create a new project

2. **Copy the Code:**
   - Copy the code from `google-apps-script.js`
   - Paste it in your Apps Script project

3. **Deploy as Web App:**
   - Click "Deploy" → "New deployment"
   - Select type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone" (for public API)
   - Click "Deploy"

4. **Get the URL:**
   - Copy the deployment URL
   - Update `DEFAULT_JOBS_API_URL` in `src/services/googleSheets.js`

## 🔧 Potential Improvements (Optional)

Your current code works perfectly! But if you want to enhance it later:

### 1. **Add Pagination Support**
```javascript
function doGet(e) {
  const limit = parseInt(e.parameter.limit) || null;
  const offset = parseInt(e.parameter.offset) || 0;

  // Add pagination logic here
  const jobs = getJobsFromSheet();
  const paginatedJobs = limit ? jobs.slice(offset, offset + limit) : jobs;

  return ContentService
    .createTextOutput(JSON.stringify(paginatedJobs))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2. **Add Filtering**
```javascript
function doGet(e) {
  const category = e.parameter.category;
  const location = e.parameter.location;

  let jobs = getJobsFromSheet();

  if (category) {
    jobs = jobs.filter(job => job.category === category);
  }
  if (location) {
    jobs = jobs.filter(job => job.location === location);
  }

  return ContentService
    .createTextOutput(JSON.stringify(jobs))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. **Add Caching**
```javascript
// Cache for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
let cachedData = null;
let lastFetchTime = 0;

function getCachedJobs() {
  const now = new Date().getTime();
  if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedData;
  }

  cachedData = fetchJobsFromSheet();
  lastFetchTime = now;
  return cachedData;
}
```

## 📝 Current API Response Format

Your API returns jobs in this format:
```json
[
  {
    "id": "1",
    "title": "Java Full Stack Developer – Fresher",
    "company": "Shvintech India",
    "location": "Visakhapatnam",
    "category": "IT/Software",
    "jobType": "Full-Time",
    "workMode": "Work From Office",
    "experience": "0 Years",
    "isFresher": "TRUE",
    "salary": "Not Disclosed",
    "skills": "Core Java, Advanced Java...",
    "shortDescription": "Java Full Stack Developer role...",
    "responsibilities": "Develop backend applications...",
    "eligibility": "B.Tech (CSE/IT)...",
    "warning": "36-month service bond...",
    "applyLink": "https://www.naukri.com/...",
    "source": "Naukri",
    "postedAt": "",
    "status": "Active"
  }
]
```

## 🔗 Current API URL

```
https://script.google.com/macros/s/AKfycbw_dL3Xy6YNkN0schsB_yLhjNAJdQWhhA0VNO8yiP5xsLpDzaZcexyS5kxA1lbtLCObkw/exec
```

## ✅ Status

- ✅ **Working:** Current implementation is fully functional
- ✅ **Tested:** Successfully integrated with React app
- ✅ **Documented:** Code saved for future modifications
- 🔄 **Ready for Enhancement:** Can be improved as needed

Your Apps Script code is working perfectly as-is! 🎉