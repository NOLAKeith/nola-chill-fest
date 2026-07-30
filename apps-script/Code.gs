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

/**
 * Read-only public feeds for approved teams and tournament games.
 * Registration continues to use the existing doPost() above.
 */
function doGet(e) {
  try {
    const parameters = (e && e.parameter) || {};
    const action = String(parameters.action || '').trim().toLowerCase();
    let payload;

    if (action === 'approved-teams') {
      payload = getApprovedTeamsPayload_();
    } else if (action === 'schedule') {
      payload = getSchedulePayload_();
    } else {
      payload = { ok: false, message: 'Unknown action.' };
    }

    return publicOutput_(payload, parameters.callback);
  } catch (error) {
    console.error(error);
    return publicOutput_(
      { ok: false, message: error && error.message ? error.message : 'Unable to load data.' },
      e && e.parameter ? e.parameter.callback : ''
    );
  }
}

function getApprovedTeamsPayload_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SETTINGS.sheetName);
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, teams: [] };

  const values = sheet.getDataRange().getDisplayValues();
  const map = headerMapPublic_(values[0]);
  const required = ['Status', 'Team Name', 'Division'];
  validatePublicHeaders_(map, required, SETTINGS.sheetName);

  const teams = values.slice(1)
    .filter(row => String(row[map['Status']] || '').trim().toLowerCase() === 'approved')
    .map(row => ({
      teamName: String(row[map['Team Name']] || '').trim(),
      division: String(row[map['Division']] || '').trim(),
      organization: map['Organization'] === undefined ? '' : String(row[map['Organization']] || '').trim(),
      teamCity: map['Team City'] === undefined ? '' : String(row[map['Team City']] || '').trim()
    }))
    .filter(team => team.teamName)
    .sort((a, b) => a.division.localeCompare(b.division, undefined, { numeric: true }) || a.teamName.localeCompare(b.teamName));

  return { ok: true, teams: teams };
}

function getSchedulePayload_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('Schedule');
  if (!sheet) throw new Error('Schedule sheet was not found.');
  if (sheet.getLastRow() < 2) return { ok: true, games: [] };

  const range = sheet.getDataRange();
  const raw = range.getValues();
  const display = range.getDisplayValues();
  const map = headerMapPublic_(display[0]);
  const required = [
    'Game ID', 'Date', 'Division', 'Round', 'Away Team', 'Away Score',
    'Home Team', 'Home Score', 'Field', 'Start Time', 'Status'
  ];
  validatePublicHeaders_(map, required, 'Schedule');

  const timeZone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  const games = [];

  for (let index = 1; index < raw.length; index += 1) {
    const rawRow = raw[index];
    const displayRow = display[index];
    const gameId = String(displayRow[map['Game ID']] || '').trim();
    const status = String(displayRow[map['Status']] || '').trim();

    if (!gameId || !['Published', 'Final'].includes(status)) continue;

    const dateValue = rawRow[map['Date']];
    const dateKey = dateValue instanceof Date
      ? Utilities.formatDate(dateValue, timeZone, 'yyyy-MM-dd')
      : String(displayRow[map['Date']] || '').trim();

    const awayScoreRaw = rawRow[map['Away Score']];
    const homeScoreRaw = rawRow[map['Home Score']];

    games.push({
      gameId: gameId,
      date: dateKey,
      dateLabel: String(displayRow[map['Date']] || '').trim(),
      division: String(displayRow[map['Division']] || '').trim(),
      round: String(displayRow[map['Round']] || '').trim(),
      away: String(displayRow[map['Away Team']] || '').trim(),
      awayScore: awayScoreRaw === '' ? null : Number(awayScoreRaw),
      home: String(displayRow[map['Home Team']] || '').trim(),
      homeScore: homeScoreRaw === '' ? null : Number(homeScoreRaw),
      field: String(displayRow[map['Field']] || '').trim(),
      time: String(displayRow[map['Start Time']] || '').trim(),
      status: status
    });
  }

  return { ok: true, games: games };
}

function publicOutput_(payload, callback) {
  const json = JSON.stringify(payload);
  const callbackName = String(callback || '').trim();

  if (callbackName && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callbackName)) {
    return ContentService
      .createTextOutput(callbackName + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function headerMapPublic_(headers) {
  return headers.reduce((map, header, index) => {
    map[String(header || '').trim()] = index;
    return map;
  }, {});
}

function validatePublicHeaders_(map, required, sheetName) {
  const missing = required.filter(header => map[header] === undefined);
  if (missing.length) {
    throw new Error(sheetName + ' is missing required columns: ' + missing.join(', '));
  }
}
