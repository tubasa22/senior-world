/**
 * 회원 본인의 검색 결과를 이메일로 보내는 Apps Script 웹 앱입니다.
 * 새 배포 후 생성된 /exec URL을 assets/auth.js의 MEMBER_API에 설정하세요.
 */
const FIREBASE_PROJECT_ID = 'senior-compass-768f6';
const FIREBASE_ISSUER = 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID;

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const idToken = String(body.idToken || '');
    const resultsHtml = String(body.resultsHtml || '');
    if (!idToken || !resultsHtml || resultsHtml.length > 200000) return json({ ok: false, error: '요청 형식이 올바르지 않습니다.' });

    const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (tokenResponse.getResponseCode() !== 200) return json({ ok: false, error: '인증 실패' });
    const token = JSON.parse(tokenResponse.getContentText());
    if (token.aud !== FIREBASE_PROJECT_ID || token.iss !== FIREBASE_ISSUER || !token.email) {
      return json({ ok: false, error: '인증 실패' });
    }

    // 수신자는 토큰에서 검증한 본인 이메일만 사용한다.
    GmailApp.sendEmail(token.email, '시니어 나침반 - 검색 결과', stripHtml(resultsHtml), { htmlBody: resultsHtml });
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: '이메일 발송에 실패했습니다.' });
  }
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
