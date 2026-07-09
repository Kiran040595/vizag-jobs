// Google Apps Script Code for Vizag Jobs API
// Deploy this as a Web App in Google Apps Script
const SHEET_ID = "1vWvs3QvFZdrmysnk7it2WjHXaVrFUzcSgdLk7O00Agc";
const SHEET_NAME = "Jobs";

/**
 * Handle OPTIONS request (CORS preflight)
 */
function doOptions(e) {
  return HtmlService.createHtmlOutput()
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * GET: Fetch all jobs with optional filtering
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

    if (!sheet) {
      return sendJsonResponse({ error: "Sheet not found" }, 400);
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return sendJsonResponse([]);
    }

    const headers = data[0];
    const rows = data.slice(1);

    let jobs = rows
      .map((row) => {
        let obj = {};
        headers.forEach((key, i) => {
          obj[key] = row[i];
        });
        return obj;
      })
      .filter(job => job.title && String(job.title).trim() !== "");

    const params = e.parameter;

    if (params.category) {
      const categoryFilter = String(params.category).toLowerCase();
      jobs = jobs.filter(job => 
        String(job.category || "").toLowerCase().includes(categoryFilter)
      );
    }

    if (params.jobType) {
      const typeFilter = String(params.jobType).toLowerCase();
      jobs = jobs.filter(job => 
        String(job.jobType || "").toLowerCase().includes(typeFilter)
      );
    }

    if (params.isFresher) {
      const isFresherParam = String(params.isFresher).toLowerCase();
      const isFresherValue = isFresherParam === 'true' || isFresherParam === 'yes';
      jobs = jobs.filter(job => {
        const jobIsFresher = String(job.isFresher || "").toLowerCase() === 'true' ||
                             String(job.isFresher || "").toLowerCase() === 'yes';
        return jobIsFresher === isFresherValue;
      });
    }

    if (params.search) {
      const searchTerm = String(params.search).toLowerCase();
      jobs = jobs.filter(job => {
        const searchFields = [job.title, job.company, job.description, job.skills];
        return searchFields.some(field => 
          String(field || "").toLowerCase().includes(searchTerm)
        );
      });
    }

    if (params.limit) {
      const limit = parseInt(params.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        jobs = jobs.slice(0, limit);
      }
    }

    return sendJsonResponse(jobs);

  } catch (error) {
    console.error('Error in doGet:', error);
    return sendJsonResponse({ error: error.message }, 500);
  }
}

/**
 * POST: Handle POST requests
 */
function doPost(e) {
  return doGet(e);
}

/**
 * Helper function to send JSON with CORS headers
 */
function sendJsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return output;
}