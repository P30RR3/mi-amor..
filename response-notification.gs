const NOTIFICATION_EMAIL = "hyncohynca@gmail.com";

function doPost(e) {
  const answer = e && e.parameter ? e.parameter.answer : "";
  if (answer !== "si" && answer !== "no") {
    return ContentService.createTextOutput("Respuesta inválida").setMimeType(ContentService.MimeType.TEXT);
  }

  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty("RESPONSE_SPREADSHEET_ID");
  let spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.create("Respuestas de María Ángel");
  if (!spreadsheetId) {
    spreadsheetId = spreadsheet.getId();
    properties.setProperty("RESPONSE_SPREADSHEET_ID", spreadsheetId);
  }

  let sheet = spreadsheet.getSheetByName("Respuestas");
  if (!sheet) sheet = spreadsheet.insertSheet("Respuestas");
  if (sheet.getLastRow() === 0) sheet.appendRow(["Fecha", "Respuesta"]);

  const response = answer === "si" ? "Sí" : "No";
  sheet.appendRow([new Date(), response]);
  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: `Respuesta a la pregunta: ${response}`,
    body: `María Ángel respondió: ${response}.\n\nFecha: ${new Date().toLocaleString("es")}\n\nLas respuestas también se guardan en la hoja "${spreadsheet.getName()}".`
  });

  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}
