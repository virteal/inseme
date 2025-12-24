function doGet(e) {
  return getResponses();
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Réponses');
    const data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      new Date(),
      data.connaissanceQuasquara || "",  // string (Oui/Non)
      data.positionQuasquara || "",      // string (Maintien/Retrait/Sans)
      data.quiDecide || "",              // string (Justice/Élus/Référendum/Autre)
      Number(data.satisfactionDemocratie || "3"),  // number (1-5)
      Number(data.declinVille || "3"),   // number (1-5)
      data.favorableReferendum || "",    // string (Oui/Non/Selon)
      data.sujetsReferendum.join(', '),  // string array join
      data.horaireConseil || "",         // string (Oui/Non/Ne sais pas)
      data.quartier || "",               // string
      data.age || "",                    // string (catégories)
      data.dureeHabitation || "",        // string (catégories)
      data.email || "",                  // string
      data.accepteContact || false,      // boolean
      data.commentaire || ""             // string
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getResponses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Réponses');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const formattedData = rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: formattedData
  })).setMimeType(ContentService.MimeType.JSON);
}
