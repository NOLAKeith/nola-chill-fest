const SETTINGS = {
  sheetName: 'Registrations',
  organizerEmail: 'patrickdcresson@gmail.com',
  sendOrganizerEmail: true,
  sendCoachConfirmation: true,
  tournamentName: 'NOLA Chill Fest',
  tournamentDates: 'October 3-4, 2026'
};

const HEADERS = [
  'Timestamp', 'Status', 'Team Name', 'Division', 'Head Coach',
  'Classification', 'Email', 'Phone', 'Team City', 'Organization',
  'Notes', 'Accuracy Confirmed', 'Submission ID'
];

function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SETTINGS.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(SETTINGS.sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#172554')
      .setFontColor('#ffffff');
    sheet.autoResizeColumns(1, HEADERS.length);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const p = (e && e.parameter) || {};

    // Silent success for bots that fill the hidden field.
    if (String(p.website || '').trim()) return output_({ ok: true });

    const required = ['team_name', 'division', 'coach_name', 'email', 'phone', 'team_city'];
    const missing = required.filter((key) => !String(p[key] || '').trim());
    if (missing.length) {
      return output_({ ok: false, message: 'Missing required registration information.' });
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SETTINGS.sheetName);
    if (!sheet) {
      setup();
      sheet = spreadsheet.getSheetByName(SETTINGS.sheetName);
    }

    const submissionId = Utilities.getUuid();
    const row = [
      new Date(),
      'Pending',
      clean_(p.team_name),
      clean_(p.division),
      clean_(p.coach_name),
      clean_(p.classification),
      clean_(p.email),
      clean_(p.phone),
      clean_(p.team_city),
      clean_(p.organization),
      clean_(p.notes),
      clean_(p.accuracy_confirmation),
      submissionId
    ];

    sheet.appendRow(row);

    if (SETTINGS.sendOrganizerEmail) sendOrganizerEmail_(p, submissionId);
    if (SETTINGS.sendCoachConfirmation) sendCoachEmail_(p);

    return output_({ ok: true, submissionId });
  } catch (error) {
    console.error(error);
    return output_({ ok: false, message: 'The registration could not be saved.' });
  } finally {
    lock.releaseLock();
  }
}

function sendOrganizerEmail_(p, submissionId) {
  const subject = `New Chill Fest registration: ${clean_(p.team_name)} (${clean_(p.division)})`;
  const body = [
    'A new team registration was submitted.',
    '',
    `Team: ${clean_(p.team_name)}`,
    `Division: ${clean_(p.division)}`,
    `Coach: ${clean_(p.coach_name)}`,
    `Classification: ${clean_(p.classification) || 'Not provided'}`,
    `Email: ${clean_(p.email)}`,
    `Phone: ${clean_(p.phone)}`,
    `City: ${clean_(p.team_city)}`,
    `Organization: ${clean_(p.organization) || 'Not provided'}`,
    `Notes: ${clean_(p.notes) || 'None'}`,
    '',
    `Submission ID: ${submissionId}`
  ].join('\n');

  MailApp.sendEmail(SETTINGS.organizerEmail, subject, body);
}

function sendCoachEmail_(p) {
  const coachEmail = clean_(p.email);
  if (!coachEmail) return;

  const subject = `${SETTINGS.tournamentName} registration received`;
  const body = [
    `Hi ${clean_(p.coach_name)},`,
    '',
    `We received the registration for ${clean_(p.team_name)} in the ${clean_(p.division)} division.`,
    `The tournament is scheduled for ${SETTINGS.tournamentDates}.`,
    '',
    'Tournament staff will review the registration and follow up with you. Registration is not final until confirmed.',
    '',
    'NOLA Chill Fest',
    'Patrick Cresson',
    '504-312-0863',
    'patrickdcresson@gmail.com'
  ].join('\n');

  MailApp.sendEmail(coachEmail, subject, body);
}

function clean_(value) {
  return String(value || '').trim().replace(/[<>]/g, '');
}

function output_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
