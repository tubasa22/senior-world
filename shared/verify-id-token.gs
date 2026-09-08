/**
 * ============================================================
 *  idToken 검증 로직 — 단일 정본(Single Source of Truth)
 * ============================================================
 *
 *  이 파일은 배포되지 않는다. Google Apps Script는 별도로 배포된
 *  프로젝트 간에 파일을 import할 수 없어서, 로그인이 필요한 각
 *  백엔드(.gs)마다 아래 함수를 그대로 복사해 넣어야 한다.
 *
 *  대상 파일 (2026-09-08 기준):
 *    - cemetery-backend.gs
 *    - community-backend.gs
 *    - ihss-backend.gs
 *    - member-backend.gs
 *    - newsletter-backend.gs
 *    - facility-outreach-backend.gs (verifyIdToken을 verifyAdmin이 감싸는 구조)
 *
 *  [ 이 함수를 수정해야 할 때 ]
 *  1. 이 파일(shared/verify-id-token.gs)을 먼저 수정한다.
 *  2. 위 대상 파일 전부에 동일한 로직을 복사해 넣는다.
 *  3. `node scripts/check-id-token-sync.mjs`를 실행해 6개 파일이
 *     전부 이 정본과 일치하는지 확인한다. 하나라도 다르면 0이
 *     아닌 종료 코드와 함께 어느 파일이 다른지 출력한다.
 *  4. 각 Apps Script 프로젝트에 새 버전으로 재배포한다 (로직이
 *     바뀐 경우에만 — 주석만 바뀐 경우는 재배포 불필요).
 *
 *  변수명, 공백까지 정본과 동일하게 맞출 필요는 없다 — 비교
 *  스크립트는 공백을 모두 제거하고 비교하지만 변수명이 다르면
 *  불일치로 판정되므로, 복사할 때는 이 파일을 그대로 붙여넣는
 *  것이 가장 안전하다.
 * ============================================================
 */

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
