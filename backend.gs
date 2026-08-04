/**
 * ============================================================
 *  Senior World 백엔드 — Google Sheets + Apps Script
 *  (실거주자 후기 + 방문자 문의를 함께 처리)
 * ============================================================
 *
 *  [ 처음 한 번만 설정 ]
 *  1. Google Sheets 새 문서를 만든다 (이름 예: "Senior World 데이터").
 *  2. 확장 프로그램 → Apps Script 를 연다.
 *  3. 기존 코드를 지우고 이 파일 전체를 붙여넣는다.
 *  4. 상단 함수 선택창에서 setup 을 골라 ▶ 실행 → 권한 승인.
 *     → reviews(후기) · inquiries(문의) 두 시트가 자동 생성된다.
 *  5. 우측 상단 배포 → 새 배포 → 유형: 웹 앱
 *       - 실행 계정: 나
 *       - 액세스 권한: "모든 사용자"   ← 반드시 이걸로
 *  6. 배포하면 나오는 웹 앱 URL(.../exec)을 복사한다.
 *  7. 같은 URL을 두 곳에 붙여넣는다:
 *       - index.html 의 REVIEW_API
 *       - contact.html 의 CONTACT_API
 *     (하나의 URL이 후기·문의를 모두 처리한다.)
 *
 *  [ 확인 방법 ]
 *  - 후기: reviews 시트에 status "검토중" 으로 쌓임 → "노출" 로 바꾸면 지도에 표시.
 *  - 문의: inquiries 시트에 status "신규" 로 쌓임 → 연락 후 "처리완료" 등으로 바꿔 관리.
 *  - 즉, 이 시트가 곧 관리자 화면이다. 별도 프로그램 필요 없음.
 *
 *  [ 코드 수정 후 반영 ]
 *  - 배포 → 배포 관리 → 편집(연필) → 버전 "새 버전" → 배포. (URL 유지)
 * ============================================================
 */

const REVIEW_SHEET  = 'reviews';
const REVIEW_COLS   = ['id', 'apartmentId', 'rating', 'text', 'nickname', 'postedAt', 'status'];

const INQUIRY_SHEET = 'inquiries';
const INQUIRY_COLS  = ['id', 'name', 'phone', 'email', 'message', 'createdAt', 'status'];

/** 시트 최초 생성 — 한 번만 실행 */
function setup() {
  ensureSheet(REVIEW_SHEET, REVIEW_COLS);
  ensureSheet(INQUIRY_SHEET, INQUIRY_COLS);
}

function ensureSheet(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.appendRow(cols);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, cols.length).setFontWeight('bold');
}

/** 지도가 승인된 후기를 읽어가는 통로 (GET) */
function doGet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REVIEW_SHEET);
  const out = [];
  if (sh && sh.getLastRow() > 1) {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, REVIEW_COLS.length).getValues();
    rows.forEach(function (r) {
      const o = {};
      REVIEW_COLS.forEach(function (c, i) { o[c] = r[i]; });
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

/** 등록 통로 (POST) — kind 로 후기/문의 구분 */
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);

    // 스팸 방지용 숨김 필드(honeypot)가 채워져 있으면 무시
    if (b.website) return json({ ok: true });

    if (b.kind === 'inquiry') return handleInquiry(b);
    return handleReview(b);   // 기본값: 후기 (기존과 호환)
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** 후기 저장 — 항상 "검토중" */
function handleReview(b) {
  const apartmentId = parseInt(b.apartmentId, 10);
  const rating = Math.max(1, Math.min(5, parseInt(b.rating, 10) || 0));
  const text = String(b.text || '').trim().slice(0, 1000);
  const nickname = (String(b.nickname || '').trim().slice(0, 40)) || '익명';

  if (!apartmentId || !rating || !text) {
    return json({ ok: false, error: '필수 항목이 비어 있습니다.' });
  }
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REVIEW_SHEET);
  const id = sh.getLastRow();
  sh.appendRow([id, apartmentId, rating, text, nickname, new Date(), '검토중']);
  return json({ ok: true });
}

/** 문의 저장 — 항상 "신규" */
function handleInquiry(b) {
  const name = String(b.name || '').trim().slice(0, 60);
  const phone = String(b.phone || '').trim().slice(0, 40);
  const email = String(b.email || '').trim().slice(0, 80);
  const message = String(b.message || '').trim().slice(0, 2000);

  if (!name || !message || (!phone && !email)) {
    return json({ ok: false, error: '이름, 연락처(전화 또는 이메일), 문의내용은 필수입니다.' });
  }
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INQUIRY_SHEET);
  const id = sh.getLastRow();
  sh.appendRow([id, name, phone, email, message, new Date(), '신규']);
  return json({ ok: true });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
