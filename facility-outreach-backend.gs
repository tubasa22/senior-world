/**
 * 관리자 전용 시설 정보 업데이트 요청 발송 Apps Script 웹 앱입니다.
 *
 * 배포 전 수동 설정:
 * 1. 스크립트 속성 FACILITY_OUTREACH_SPREADSHEET_ID에 관리용 스프레드시트 ID를 등록합니다.
 * 2. 해당 스프레드시트에 `시설연락처` 시트를 만들고 첫 행에 name, email, source 헤더를 둡니다.
 * 3. source에는 OC 아파트, LA 아파트, 요양시설 중 하나만 입력합니다.
 * 4. 웹 앱으로 배포한 /exec URL을 admin.html의 FACILITY_OUTREACH_API에 설정합니다.
 */
const FIREBASE_API_KEY = 'AIzaSyDmMQTIqpwB3NfsomVwEThhkSFUYuHxQ4Y';
const ADMIN_EMAILS = ['tubasa22@gmail.com'];
const OUTREACH_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('FACILITY_OUTREACH_SPREADSHEET_ID');
const OUTREACH_SHEET_NAME = '시설연락처';
const MAX_RECIPIENTS = 90;
const SUBJECTS = {
  en: 'Property Information Update Request - Senior Compass',
  ko: '[시니어 나침반] 시설 정보 확인 요청'
};

function doPost(e) {
  try {
    const request = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (!verifyAdmin(request.idToken)) return json({ ok: false, error: '관리자 권한이 없습니다' });
    if (request.action === 'getRecipients') return getRecipients();
    if (request.action === 'sendOutreach') return sendOutreach(request);
    return json({ ok: false, error: '허용되지 않은 요청입니다' });
  } catch (error) {
    return json({ ok: false, error: error && error.message ? error.message : '요청 처리에 실패했습니다' });
  }
}

// ⚠️ verifyIdToken은 shared/verify-id-token.gs의 정본과 동일해야 한다.
// 수정 시 정본도 함께 수정하고 scripts/check-id-token-sync.mjs로 검증할 것.
function verifyIdToken(idToken) {
  if (!idToken) return { ok: false };
  try {
    const response = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ idToken: idToken }),
        muteHttpExceptions: true
      }
    );
    const result = JSON.parse(response.getContentText());
    if (!result.users || !result.users[0]) return { ok: false };
    const user = result.users[0];
    if (!user.email || !user.localId) return { ok: false };
    return { ok: true, uid: user.localId, email: user.email };
  } catch (_) {
    return { ok: false };
  }
}

// 이 백엔드는 관리자 전용이므로, 공용 verifyIdToken 결과에
// ADMIN_EMAILS 화이트리스트 검사를 추가로 적용한다.
function verifyAdmin(idToken) {
  const token = verifyIdToken(idToken);
  if (!token.ok) return null;
  if (!ADMIN_EMAILS.includes(String(token.email || '').toLowerCase())) return null;
  return token;
}

function getRecipients() {
  const sheet = outreachSheet();
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return json({ ok: true, recipients: [] });
  const headers = values[0].map(value => String(value).trim());
  const nameIndex = headers.indexOf('name');
  const emailIndex = headers.indexOf('email');
  const sourceIndex = headers.indexOf('source');
  if (nameIndex < 0 || emailIndex < 0 || sourceIndex < 0) throw new Error('시설연락처 시트의 name, email, source 헤더를 확인해주세요');
  const recipients = values.slice(1).map(row => ({
    name: String(row[nameIndex] || '').trim(),
    email: String(row[emailIndex] || '').trim().toLowerCase(),
    source: String(row[sourceIndex] || '').trim()
  })).filter(item => item.email && languageForSource(item.source));
  return json({ ok: true, recipients: recipients });
}

function sendOutreach(request) {
  const templates = request.templates || {};
  const bodies = {
    en: String(templates.en || '').trim().slice(0, 10000),
    ko: String(templates.ko || '').trim().slice(0, 10000)
  };
  if (!bodies.en || !bodies.ko) return json({ ok: false, error: '영어와 한국어 템플릿을 모두 입력해주세요' });
  const recipients = Array.isArray(request.recipients) ? request.recipients : [];
  if (!recipients.length) return json({ ok: false, error: '발송 대상이 없습니다' });
  if (recipients.length > MAX_RECIPIENTS) return json({ ok: false, error: '한 번에 발송할 수 있는 시설 수를 초과했습니다' });
  if (GmailApp.getRemainingDailyQuota() < recipients.length) return json({ ok: false, error: '오늘의 이메일 발송 한도가 부족합니다' });

  const sent = { en: 0, ko: 0 };
  let failed = 0;
  recipients.forEach(recipient => {
    const source = String(recipient && recipient.source || '').trim();
    const expectedLanguage = languageForSource(source);
    const requestedLanguage = String(recipient && recipient.language || '').trim();
    const email = String(recipient && recipient.email || '').trim().toLowerCase();
    if (!email || !expectedLanguage || requestedLanguage !== expectedLanguage) {
      failed += 1;
      return;
    }
    try {
      GmailApp.sendEmail(email, SUBJECTS[expectedLanguage], bodies[expectedLanguage]);
      sent[expectedLanguage] += 1;
    } catch (_) {
      failed += 1;
    }
  });
  return json({ ok: true, sent: sent, failed: failed });
}

function languageForSource(source) {
  if (source === 'OC 아파트' || source === 'LA 아파트') return 'en';
  if (source === '요양시설') return 'ko';
  return '';
}

function outreachSheet() {
  if (!OUTREACH_SPREADSHEET_ID) throw new Error('FACILITY_OUTREACH_SPREADSHEET_ID 설정이 필요합니다');
  const sheet = SpreadsheetApp.openById(OUTREACH_SPREADSHEET_ID).getSheetByName(OUTREACH_SHEET_NAME);
  if (!sheet) throw new Error('시설연락처 시트를 찾을 수 없습니다');
  return sheet;
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
