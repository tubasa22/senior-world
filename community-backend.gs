/**
 * 시니어 나침반 커뮤니티 공지사항 백엔드 — Google Sheets + Apps Script
 *
 * community_posts: 관리자가 직접 작성하는 공지사항 시트
 * community_likes: Firebase 로그인 회원의 좋아요 기록 시트
 */
const POSTS_SHEET = 'community_posts';
const LIKES_SHEET = 'community_likes';
const POST_COLS = ['id', 'title', 'body', 'postedAt', 'status', 'likeCount'];
const LIKE_COLS = ['postId', 'uid', 'likedAt'];
const FIREBASE_PROJECT_ID = 'senior-compass-768f6';
const FIREBASE_ISSUER = 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID;

/** 최초 한 번 실행: 기존 행을 지우지 않고 필요한 시트와 헤더만 만든다. */
function setup() {
  ensureSheet(POSTS_SHEET, POST_COLS);
  ensureSheet(LIKES_SHEET, LIKE_COLS);
}

function ensureSheet(name, columns) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
  }
  return sheet;
}

/** 공개 목록: status가 '노출'인 글만 최신순으로 반환한다. */
function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(POSTS_SHEET);
  const posts = [];
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, POST_COLS.length).getValues().forEach(function(row) {
      const post = {};
      POST_COLS.forEach(function(key, index) { post[key] = row[index]; });
      if (String(post.status).trim() === '노출') {
        posts.push({ id: post.id, title: post.title, body: post.body, postedAt: post.postedAt, likeCount: Number(post.likeCount) || 0 });
      }
    });
  }
  posts.sort(function(a, b) { return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(); });
  return json(posts);
}

/** 좋아요만 처리한다. 글쓰기·수정·삭제 공개 API는 제공하지 않는다. */
function doPost(e) {
  try {
    const request = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (request.action !== 'like') return json({ ok: false, error: '허용되지 않은 요청입니다' });

    const token = verifyIdToken(request.idToken);
    if (!token) return json({ ok: false, error: '로그인이 필요합니다' });

    const postId = String(request.postId || '').trim();
    if (!postId) return json({ ok: false, error: '게시글을 찾을 수 없습니다' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const posts = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(POSTS_SHEET);
      const likes = ensureSheet(LIKES_SHEET, LIKE_COLS);
      const postRow = findPostRow(posts, postId);
      if (!postRow) return json({ ok: false, error: '게시글을 찾을 수 없습니다' });

      let existingRow = 0;
      if (likes.getLastRow() > 1) {
        const values = likes.getRange(2, 1, likes.getLastRow() - 1, LIKE_COLS.length).getValues();
        values.some(function(row, index) {
          if (String(row[0]) === postId && String(row[1]) === String(token.uid)) { existingRow = index + 2; return true; }
          return false;
        });
      }

      const liked = !existingRow;
      if (liked) likes.appendRow([postId, token.uid, new Date()]);
      else likes.deleteRow(existingRow);

      const likeCount = countLikes(likes, postId);
      posts.getRange(postRow, 6).setValue(likeCount);
      return json({ ok: true, liked: liked, likeCount: likeCount });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json({ ok: false, error: '좋아요 처리에 실패했습니다' });
  }
}

function verifyIdToken(idToken) {
  if (!idToken) return null;
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return null;
  const token = JSON.parse(response.getContentText());
  const uid = token.user_id || token.sub;
  if (token.aud !== FIREBASE_PROJECT_ID || token.iss !== FIREBASE_ISSUER || !uid) return null;
  token.uid = uid;
  return token;
}

function findPostRow(posts, postId) {
  if (!posts || posts.getLastRow() <= 1) return 0;
  const ids = posts.getRange(2, 1, posts.getLastRow() - 1, 1).getValues();
  for (let index = 0; index < ids.length; index++) if (String(ids[index][0]) === postId) return index + 2;
  return 0;
}

function countLikes(likes, postId) {
  if (likes.getLastRow() <= 1) return 0;
  return likes.getRange(2, 1, likes.getLastRow() - 1, 1).getValues().filter(function(row) { return String(row[0]) === postId; }).length;
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
