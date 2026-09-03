/**
 * 관리자 전용 회원 현황·뉴스레터 발송 Apps Script 웹 앱입니다.
 *
 * 배포 전 수동 설정:
 * 1. Apps Script에 OAuth2 라이브러리(ID: 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF)를 추가합니다.
 * 2. 프로젝트 설정 > 스크립트 속성에 FIREBASE_SERVICE_ACCOUNT_KEY를 서비스 계정 JSON 전체 문자열로 등록합니다.
 * 3. 웹 앱으로 배포한 /exec URL을 admin.html의 NEWSLETTER_API에 설정합니다.
 * 서비스 계정 키는 저장소나 클라이언트 코드에 절대 넣지 않습니다.
 */
const FIREBASE_PROJECT_ID = 'senior-compass-768f6';
const FIREBASE_ISSUER = 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID;
const ADMIN_EMAILS = ['tubasa22@gmail.com'];
const SERVICE_ACCOUNT_KEY = PropertiesService.getScriptProperties()
  .getProperty('FIREBASE_SERVICE_ACCOUNT_KEY');
const UNSUBSCRIBE_URL = 'https://tubasa22.github.io/senior-world/unsubscribe.html';
const MAX_RECIPIENTS = 90;

function doPost(e) {
  try {
    const request = JSON.parse((e.postData && e.postData.contents) || '{}');
    const token = verifyAdmin(request.idToken);
    if (!token) return json({ ok: false, error: '관리자 권한이 없습니다' });

    if (request.action === 'getMemberStats') return getMemberStats();
    if (request.action === 'sendNewsletter') return sendNewsletter(request);
    return json({ ok: false, error: '허용되지 않은 요청입니다' });
  } catch (_) {
    return json({ ok: false, error: '요청 처리에 실패했습니다' });
  }
}

function verifyAdmin(idToken) {
  if (!idToken) return null;
  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (response.getResponseCode() !== 200) return null;
  const token = JSON.parse(response.getContentText());
  if (token.aud !== FIREBASE_PROJECT_ID || token.iss !== FIREBASE_ISSUER) return null;
  if (!ADMIN_EMAILS.includes(String(token.email || '').toLowerCase())) return null;
  return token;
}

function getMemberStats() {
  const members = getNewsletterMembers();
  const recentMembers = members.all
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 20)
    .map(member => ({
      name: member.name || '이름 미입력',
      createdAt: member.createdAt || '',
      newsletterOptIn: member.newsletterOptIn
    }));
  // 이메일은 이 응답을 포함해 어떤 클라이언트 응답에도 넣지 않는다.
  return json({ ok: true, totalCount: members.all.length, newsletterCount: members.recipients.length, recentMembers: recentMembers });
}

function sendNewsletter(request) {
  const subject = String(request.subject || '').trim().slice(0, 200);
  const body = String(request.body || '').trim().slice(0, 10000);
  if (!subject || !body) return json({ ok: false, error: '제목과 본문을 입력해주세요' });

  const members = getNewsletterMembers();
  const recipients = members.recipients;
  if (recipients.length > MAX_RECIPIENTS) return json({ ok: false, error: '발송 대상이 너무 많습니다. 관리자에게 문의하세요' });
  if (GmailApp.getRemainingDailyQuota() < recipients.length) return json({ ok: false, error: '오늘의 이메일 발송 한도가 부족합니다. 내일 다시 시도해주세요' });

  const footer = '\n\n---\n이 메일은 시니어 나침반 뉴스레터 구독자에게 발송되었습니다.\n수신을 원치 않으시면 다음 링크에서 해지하실 수 있습니다:\n' + UNSUBSCRIBE_URL;
  let sent = 0;
  let failed = 0;
  recipients.forEach(email => {
    try {
      GmailApp.sendEmail(email, subject, body + footer);
      sent += 1;
    } catch (_) {
      failed += 1;
    }
  });
  return json({ ok: true, sent: sent, failed: failed });
}

function getNewsletterMembers() {
  const accessToken = getFirestoreAccessToken();
  const all = [];
  let pageToken = '';
  do {
    let url = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents/users?pageSize=100';
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    const response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + accessToken }, muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error('회원 정보를 불러오지 못했습니다');
    const data = JSON.parse(response.getContentText());
    (data.documents || []).forEach(document => {
      const fields = document.fields || {};
      all.push({ email: stringField(fields.email), name: stringField(fields.name), newsletterOptIn: fields.newsletterOptIn && fields.newsletterOptIn.booleanValue === true, createdAt: timestampField(fields.createdAt) });
    });
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  const seen = {};
  const recipients = all.filter(member => member.newsletterOptIn && member.email).map(member => member.email.trim().toLowerCase()).filter(email => {
    if (seen[email]) return false;
    seen[email] = true;
    return true;
  });
  return { all: all, recipients: recipients };
}

function getFirestoreAccessToken() {
  if (!SERVICE_ACCOUNT_KEY) throw new Error('서비스 계정 설정이 필요합니다');
  if (typeof OAuth2 === 'undefined') throw new Error('OAuth2 라이브러리 설정이 필요합니다');
  const key = JSON.parse(SERVICE_ACCOUNT_KEY);
  const service = OAuth2.createService('seniorCompassFirestore')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setPrivateKey(key.private_key)
    .setIssuer(key.client_email)
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope('https://www.googleapis.com/auth/datastore');
  if (!service.hasAccess()) throw new Error('Firestore 접근 권한을 확인해주세요');
  return service.getAccessToken();
}

function stringField(field) { return field && typeof field.stringValue === 'string' ? field.stringValue : ''; }
function timestampField(field) { return field && field.timestampValue ? field.timestampValue : ''; }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
