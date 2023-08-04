const {google} = require('googleapis');
const {GoogleAuth} = require('google-auth-library');
const dfd = require("danfojs-node");

/**
 * Fetch the contents of a spreadsheet by ID and worksheet name
 * @param {String} spreadsheetId - The ID of the spreadsheet
 * @param {String} sheetName - The name of the worksheet
 * @returns {Promise<DataFrame>} - The contents of the worksheet
 */
async function getWorksheetContents(spreadsheetId, sheetName) {
  const SERVICE_ACCOUNT_FILE = 'client_secret.json';
  const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

  const auth = new GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: SCOPES,
  });

  const sheets = google.sheets({version: 'v4', auth});

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName
    });

    const header = response.data.values[0];
    const data = response.data.values.slice(1);
    const df = new dfd.DataFrame(data, { columns: header });

    return df;  // DataFrame representing the worksheet
  } catch (error) {
    console.log('The Google API returned an error: ' + error);
    throw error;
  }
}

module.exports = getWorksheetContents;
