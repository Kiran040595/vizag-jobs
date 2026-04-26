// Google Apps Script Code for Vizag Jobs API
// Deploy this as a Web App in Google Apps Script
// URL: https://script.google.com/macros/s/AKfycbw_dL3Xy6YNkN0schsB_yLhjNAJdQWhhA0VNO8yiP5xsLpDzaZcexyS5kxA1lbtLCObkw/exec

const SHEET_ID = "1vWvs3QvFZdrmysnk7it2WjHXaVrFUzcSgdLk7O00Agc";
const SHEET_NAME = "Jobs";

// ✅ GET: Fetch all jobs
function doGet() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

    // Check if sheet exists
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: "Sheet not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = sheet.getDataRange().getValues();

    // Check if we have data
    if (data.length <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const headers = data[0];
    const rows = data.slice(1);

    const jobs = rows.map((row) => {
      let obj = {};
      headers.forEach((key, i) => {
        obj[key] = row[i];
      });
      return obj;
    });

    return ContentService
      .createTextOutput(JSON.stringify(jobs))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error in doGet:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Optional: Add CORS headers for web requests
function doPost(e) {
  return handleCors(e);
}

function handleCors(e) {
  // Handle preflight OPTIONS request
  if (e.parameter.method === 'OPTIONS') {
    return ContentService
      .createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  // Handle actual POST request
  return doGet();
}