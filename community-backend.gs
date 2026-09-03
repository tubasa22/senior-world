/** 관리자만 community_posts 시트에서 글을 작성하는 커뮤니티 백엔드 */
const POSTS_SHEET='community_posts',LIKES_SHEET='community_likes';
const POST_COLS=['id','postType','title','body','sourceName','sourceUrl','postedAt','status','likeCount'];
const LIKE_COLS=['postId','uid','likedAt'];
const FIREBASE_PROJECT_ID='senior-compass-768f6';
const FIREBASE_ISSUER='https://securetoken.google.com/'+FIREBASE_PROJECT_ID;

/** 최초 한 번 실행. 기존 공지 데이터는 삭제하지 않고 새 열을 추가한다. */
function setup(){ensurePostsSheet();ensureSheet(LIKES_SHEET,LIKE_COLS);}
function ensurePostsSheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(POSTS_SHEET);if(!sh){sh=ss.insertSheet(POSTS_SHEET);sh.appendRow(POST_COLS);sh.setFrozenRows(1);sh.getRange(1,1,1,POST_COLS.length).setFontWeight('bold');return sh;}const h=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0];if(h.join('|')===['id','title','body','postedAt','status','likeCount'].join('|')){sh.insertColumnsAfter(1,1);sh.insertColumnsAfter(4,2);sh.getRange(1,1,1,POST_COLS.length).setValues([POST_COLS]);if(sh.getLastRow()>1)sh.getRange(2,2,sh.getLastRow()-1,1).setValue('공지');}return sh;}
function ensureSheet(name,cols){const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0){sh.appendRow(cols);sh.setFrozenRows(1);sh.getRange(1,1,1,cols.length).setFontWeight('bold');}return sh;}

/** 노출 상태의 공지·뉴스만 최신순으로 반환한다. */
function doGet(){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(POSTS_SHEET),out=[];if(sh&&sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,POST_COLS.length).getValues().forEach(r=>{const p={};POST_COLS.forEach((k,i)=>p[k]=r[i]);if(String(p.status).trim()==='노출')out.push({id:p.id,postType:p.postType==='뉴스'?'뉴스':'공지',title:p.title,body:p.body,sourceName:p.sourceName,sourceUrl:p.sourceUrl,postedAt:p.postedAt,likeCount:Number(p.likeCount)||0});});out.sort((a,b)=>new Date(b.postedAt)-new Date(a.postedAt));return json(out);}

/** 좋아요만 처리한다. 공개 글쓰기·수정·삭제 API는 제공하지 않는다. */
function doPost(e){try{const req=JSON.parse((e.postData&&e.postData.contents)||'{}');if(req.action!=='like')return json({ok:false,error:'허용되지 않은 요청입니다'});const token=verifyIdToken(req.idToken);if(!token)return json({ok:false,error:'로그인이 필요합니다'});const postId=String(req.postId||'').trim();if(!postId)return json({ok:false,error:'게시글을 찾을 수 없습니다'});const lock=LockService.getScriptLock();lock.waitLock(10000);try{const posts=ensurePostsSheet(),likes=ensureSheet(LIKES_SHEET,LIKE_COLS),postRow=findPostRow(posts,postId);if(!postRow)return json({ok:false,error:'게시글을 찾을 수 없습니다'});let old=0;if(likes.getLastRow()>1)likes.getRange(2,1,likes.getLastRow()-1,LIKE_COLS.length).getValues().some((r,i)=>{if(String(r[0])===postId&&String(r[1])===String(token.uid)){old=i+2;return true;}return false;});const liked=!old;if(liked)likes.appendRow([postId,token.uid,new Date()]);else likes.deleteRow(old);const likeCount=countLikes(likes,postId);posts.getRange(postRow,9).setValue(likeCount);return json({ok:true,liked,likeCount});}finally{lock.releaseLock();}}catch(_){return json({ok:false,error:'좋아요 처리에 실패했습니다'});}}
function verifyIdToken(idToken){if(!idToken)return null;const r=UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(idToken),{muteHttpExceptions:true});if(r.getResponseCode()!==200)return null;const t=JSON.parse(r.getContentText()),uid=t.user_id||t.sub;if(t.aud!==FIREBASE_PROJECT_ID||t.iss!==FIREBASE_ISSUER||!uid)return null;t.uid=uid;return t;}
function findPostRow(sh,id){if(!sh||sh.getLastRow()<=1)return 0;const ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();for(let i=0;i<ids.length;i++)if(String(ids[i][0])===id)return i+2;return 0;}
function countLikes(sh,id){if(sh.getLastRow()<=1)return 0;return sh.getRange(2,1,sh.getLastRow()-1,1).getValues().filter(r=>String(r[0])===id).length;}
function json(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
