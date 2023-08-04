const { google } = require('googleapis');

async function getAuthorizedContacts(spreadsheetId, sheetName) {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'client_secret.json', 
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const client = await auth.getClient();

    const sheets = google.sheets({ version: 'v4', auth: client });

    const response = await sheets.spreadsheets.get({
        spreadsheetId, 
        includeGridData: true,
    });

    const targetSheet = response.data.sheets.find(sheet => sheet.properties.title === sheetName);
    
    if (!targetSheet) {
        console.log(`Sheet ${sheetName} not found.`);
        return;
    }

    const rows = targetSheet.data[0].rowData;

    const headers = rows[0].values.map(cell => cell.userEnteredValue.stringValue);
    const phoneCommercialIndex = headers.findIndex(header => header === "TELEFONE - COMERCIAL");
    const phoneCellularIndex = headers.findIndex(header => header === "TELEFONE - CELULAR");
    const phoneResidentialIndex = headers.findIndex(header => header === "TELEFONE - RESIDENCIAL");

    return rows.slice(1).flatMap(row => {
        const name = row.values[0].userEnteredValue.stringValue;
        return [
            {name, phoneNumber: row.values[phoneCommercialIndex].userEnteredValue.stringValue},
            {name, phoneNumber: row.values[phoneCellularIndex].userEnteredValue.stringValue},
            {name, phoneNumber: row.values[phoneResidentialIndex].userEnteredValue.stringValue},
        ];
    });
}



module.exports = getAuthorizedContacts;
