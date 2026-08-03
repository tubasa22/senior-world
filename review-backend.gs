/**
 * ============================================================
 *  실거주자 후기 백엔드 — Google Sheets + Apps Script
 * ============================================================
 *
 *  [ 처음 한 번만 설정 ]
 *  1. Google Sheets 새 문서를 만든다 (이름 예: "하우징 후기").
 *  2. 확장 프로그램 → Apps Script 를 연다.
 *  3. 기존 코드를 지우고 이 파일 전체를 붙여넣는다.
 *  4. 상단 함수 선택창에서 setup 을 골라 ▶ 실행 → 권한 승인.
 *     → reviews 시트가 헤더와 함께 자동 생성된다.
 *  5. 우측 상단 배포 → 새 배포 → 유형: 웹 앱
 *       - 실행 계정: 나
 *       - 액세스 권한: "모든 사용자"   ← 반드시 이걸로
 *  6. 배포하면 나오는 웹 앱 URL(.../exec)을 복사한다.
 *  7. index.html 상단의  REVIEW_API  값에 그 URL을 붙여넣는다.
 *
 *  [ 후기 검토(승인) 방법 ]
 *  - 새 후기는 reviews 시트에 status "검토중" 으로 쌓인다.
 *  - 내용을 확인하고, 노출할 후기의 status 칸을  노출  로 바꾸면
 *    지도 카드에 즉시 반영된다.  숨기려면  숨김  으로 둔다.
 *  - 즉, 이 시트가 곧 관리자 화면이다. 별도 프로그램 필요 없음.
 *
 *  [ 코드 수정 후 반영 ]
 *  - 코드를 고치면 배포 → 배포 관리 → 편집(연필) → 버전 "새 버전" → 배포.
 *    (URL은 그대로 유지된다.)
 * ============================================================
 */

const SHEET_NAME = 'reviews';
const COLS = ['id', 'apartmentId', 'rating', 'text', 'nickname', 'postedAt', 'status'];

/** 시트 최초 생성 — 한 번만 실행 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.clear();
  sh.appendRow(COLS);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, COLS.length).setFontWeight('bold');
}

/** 지도가 승인된 후기를 읽어가는 통로 (GET) */
function doGet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const out = [];
  if (sh && sh.getLastRow() > 1) {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, COLS.length).getValues();
    rows.forEach(function (r) {
      const o = {};
      COLS.forEach(function (c, i) { o[c] = r[i]; });
      if (String(o.status).trim() === '노출') {
        out.push({
          apartmentId: o.apartmentId,
          rating: o.rating,
          text: o.text,
          nickname: o.nickname,
          postedAt: o.postedAt
        });
      }
    });
  }
  return json(out);
}

/** 방문자가 후기를 등록하는 통로 (POST) — 항상 "검토중" 으로 저장 */
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);

    // 스팸 방지용 숨김 필드(honeypot)가 채워져 있으면 무시
    if (b.website) return json({ ok: true });

    const apartmentId = parseInt(b.apartmentId, 10);
    const rating = Math.max(1, Math.min(5, parseInt(b.rating, 10) || 0));
    const text = String(b.text || '').trim().slice(0, 1000);
    const nickname = (String(b.nickname || '').trim().slice(0, 40)) || '익명';

    if (!apartmentId || !rating || !text) {
      return json({ ok: false, error: '필수 항목이 비어 있습니다.' });
    }

    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const id = sh.getLastRow();  // 헤더 포함 행 수 = 다음 id
    sh.appendRow([id, apartmentId, rating, text, nickname, new Date(), '검토중']);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
