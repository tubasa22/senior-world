/**
 * 회원 본인의 검색 결과를 이메일로 보내는 Apps Script 웹 앱입니다.
 * 새 배포 후 생성된 /exec URL을 assets/auth.js의 MEMBER_API에 설정하세요.
 */
const FIREBASE_PROJECT_ID = 'senior-compass-768f6';
const FIREBASE_API_KEY = 'AIzaSyDmMQTIqpwB3NfsomVwEThhkSFUYuHxQ4Y';

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (body.action === 'sendWelcome') return sendWelcome_(body);

    const idToken = String(body.idToken || '');
    const resultsHtml = String(body.resultsHtml || '');
    if (!idToken || !resultsHtml || resultsHtml.length > 200000) return json({ ok: false, error: '요청 형식이 올바르지 않습니다.' });

    const token = verifyIdToken(idToken);
    if (!token.ok) return json({ ok: false, error: '인증 실패' });

    // 수신자는 토큰에서 검증한 본인 이메일만 사용한다.
    GmailApp.sendEmail(token.email, '시니어 나침반 - 검색 결과', stripHtml(resultsHtml), { htmlBody: resultsHtml });
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: '이메일 발송에 실패했습니다.' });
  }
}

// 회원가입 직후 보내는 HTML 환영 메일.
function sendWelcome_(body){
  const token = verifyIdToken(body.idToken);
  if (!token.ok) return json({ ok: false, error: '인증 실패' });
  const name = String(body.name || '').trim().slice(0,80);
  const greeting = name ? ('안녕하세요, ' + name + '님.') : '안녕하세요.';
  const text = greeting + '\n\n시니어 나침반 가입을 환영합니다!\n\n본 사이트는 오렌지카운티와 LA 카운티 시니어분들께 필요한 생활 정보를 공유하고 제공해드리는 사이트입니다.\n\n주거, 요양시설, IHSS 케어기버, 장례·매장권, 생활지원 등 다양한 정보를 편하게 찾아보세요.';
  try{
    GmailApp.sendEmail(token.email, '시니어 나침반 가입을 환영합니다', text, { htmlBody: memberWelcomeHtml_(text) });
  }catch(_){
    // 환영 메일 발송 실패는 가입 자체를 막지 않으므로 조용히 무시한다.
  }
  return json({ ok: true });
}

// 시설 아웃리치 메일과 동일한 브랜드 톤의 HTML 래퍼.
function memberWelcomeHtml_(plainText){
  const escaped = String(plainText || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r?\n/g,'<br>');
  const siteUrl = 'https://tubasa22.github.io/senior-world/';
  const logoMarkUrl = siteUrl + 'assets/img/logo.svg';
  return '<!doctype html><html><body style="margin:0;padding:0;background:#F5F5F0;font-family:\'Apple SD Gothic Neo\',\'Noto Sans KR\',\'Malgun Gothic\',\'Segoe UI\',Arial,sans-serif;">'+
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F0;padding:24px 0;"><tr><td align="center">'+
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;">'+
    '<tr><td style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:3px solid #E8873D;">'+
    '<img src="'+logoMarkUrl+'" alt="시니어 나침반" height="56" style="display:block;margin:0 auto 10px;">'+
    '<div style="font-size:19px;font-weight:700;color:#1B4A70;">시니어 나침반</div>'+
    '<div style="font-size:11px;letter-spacing:1.5px;color:#5C7080;margin-top:2px;">SENIOR COMPASS</div>'+
    '</td></tr>'+
    '<tr><td style="padding:32px;color:#22303A;font-size:15px;line-height:1.7;">'+escaped+'</td></tr>'+
    '<tr><td style="padding:0 32px 32px;text-align:center;">'+
    '<a href="'+siteUrl+'" style="display:inline-block;background:#E8873D;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;">사이트 바로가기 · Visit Our Site</a>'+
    '</td></tr>'+
    '<tr><td style="background:#FBE4CE;padding:16px 32px;text-align:center;color:#5C7080;font-size:12px;">'+
    '시니어 나침반 · Senior Compass<br>tubasa22.github.io/senior-world'+
    '</td></tr>'+
    '</table></td></tr></table></body></html>';
}

// ⚠️ 이 함수는 shared/verify-id-token.gs의 정본과 동일해야 한다.
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

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
