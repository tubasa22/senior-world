/** 관리자만 community_posts 시트에서 글을 작성하는 커뮤니티 백엔드 */
const POSTS_SHEET='community_posts',LIKES_SHEET='community_likes';
const POST_COLS=['id','postType','title','body','sourceName','sourceUrl','postedAt','status','likeCount','photoUrls','youtubeUrl'];
const LIKE_COLS=['postId','uid','likedAt'];
const FIREBASE_PROJECT_ID='senior-compass-768f6';
const FIREBASE_API_KEY='AIzaSyDmMQTIqpwB3NfsomVwEThhkSFUYuHxQ4Y';
const ADMIN_EMAILS=['tubasa22@gmail.com'];
// 여러 명이면 배열에 추가한다. 이 목록은 서버에서만 검사한다.
const COMMUNITY_MAX_PHOTOS=3;
const COMMUNITY_MAX_PHOTO_BYTES=4*1024*1024;
const COMMUNITY_ALLOWED_PHOTO_MIME_TYPES=['image/jpeg','image/png','image/webp','image/gif'];
// 사진을 저장할 공개 구글 드라이브 폴더 ID. Apps Script 편집기에서
// 파일 → 프로젝트 속성 → 스크립트 속성에 COMMUNITY_PHOTO_FOLDER_ID로 등록한다.
// 폴더 자체가 공개일 필요는 없다 — 업로드된 파일마다 개별적으로 공개 보기 권한을 부여한다.

/** 최초 한 번 실행. 기존 공지 데이터는 삭제하지 않고 새 열을 추가한다. */
function setup(){ensurePostsSheet();ensureSheet(LIKES_SHEET,LIKE_COLS);}
function ensurePostsSheet(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sh=ss.getSheetByName(POSTS_SHEET);
  if(!sh){
    sh=ss.insertSheet(POSTS_SHEET);
    sh.appendRow(POST_COLS);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,POST_COLS.length).setFontWeight('bold');
    return sh;
  }
  const oldCols=['id','title','body','postedAt','status','likeCount'];
  const midCols=['id','postType','title','body','sourceName','sourceUrl','postedAt','status','likeCount'];
  let h=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0];
  if(h.join('|')===oldCols.join('|')){
    sh.insertColumnsAfter(1,1);
    sh.insertColumnsAfter(4,2);
    sh.getRange(1,1,1,midCols.length).setValues([midCols]);
    if(sh.getLastRow()>1)sh.getRange(2,2,sh.getLastRow()-1,1).setValue('공지');
    h=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0];
  }
  // 사진/유튜브 필드가 없는 구버전 시트라면 끝에 두 열을 추가한다.
  if(h.indexOf('photoUrls')===-1){
    const insertAfter=sh.getLastColumn();
    sh.insertColumnsAfter(insertAfter,2);
    sh.getRange(1,insertAfter+1,1,2).setValues([['photoUrls','youtubeUrl']]);
  }
  return sh;
}
function ensureSheet(name,cols){const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0){sh.appendRow(cols);sh.setFrozenRows(1);sh.getRange(1,1,1,cols.length).setFontWeight('bold');}return sh;}

/** 노출 상태의 공지·뉴스만 최신순으로 반환한다. */
function doGet(){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(POSTS_SHEET),out=[];if(sh&&sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,POST_COLS.length).getValues().forEach(r=>{const p={};POST_COLS.forEach((k,i)=>p[k]=r[i]);if(String(p.status).trim()==='노출')out.push({id:p.id,postType:p.postType==='뉴스'?'뉴스':'공지',title:p.title,body:p.body,sourceName:p.sourceName,sourceUrl:p.sourceUrl,postedAt:p.postedAt,likeCount:Number(p.likeCount)||0,photoUrls:String(p.photoUrls||'').split(',').map(url=>url.trim()).filter(Boolean),youtubeUrl:String(p.youtubeUrl||'')});});out.sort((a,b)=>new Date(b.postedAt)-new Date(a.postedAt));return json(out);}

/** 좋아요만 처리한다. 공개 글쓰기·수정·삭제 API는 제공하지 않는다. */
function doPost(e){try{const req=JSON.parse((e.postData&&e.postData.contents)||'{}');if(req.action==='like')return toggleLike(req);if(req.action==='createPost')return createPost(req);return json({ok:false,error:'허용되지 않은 요청입니다'});}catch(_){return json({ok:false,error:'요청 처리에 실패했습니다'});}}
function toggleLike(req){const token=verifyIdToken(req.idToken);if(!token.ok)return json({ok:false,error:'로그인이 필요합니다'});const postId=String(req.postId||'').trim();if(!postId)return json({ok:false,error:'게시글을 찾을 수 없습니다'});const lock=LockService.getScriptLock();lock.waitLock(10000);try{const posts=ensurePostsSheet(),likes=ensureSheet(LIKES_SHEET,LIKE_COLS),postRow=findPostRow(posts,postId);if(!postRow)return json({ok:false,error:'게시글을 찾을 수 없습니다'});let old=0;if(likes.getLastRow()>1)likes.getRange(2,1,likes.getLastRow()-1,LIKE_COLS.length).getValues().some((r,i)=>{if(String(r[0])===postId&&String(r[1])===String(token.uid)){old=i+2;return true;}return false;});const liked=!old;if(liked)likes.appendRow([postId,token.uid,new Date()]);else likes.deleteRow(old);const likeCount=countLikes(likes,postId);posts.getRange(postRow,9).setValue(likeCount);return json({ok:true,liked,likeCount});}finally{lock.releaseLock();}}
function createPost(req){
  const token=verifyIdToken(req.idToken);
  if(!token.ok)return json({ok:false,error:'로그인이 필요합니다'});
  if(!ADMIN_EMAILS.includes(String(token.email||'').toLowerCase()))return json({ok:false,error:'관리자 권한이 없습니다'});
  const postType=req.postType==='뉴스'?'뉴스':req.postType==='공지'?'공지':'';
  const title=String(req.title||'').trim().slice(0,200),
        body=String(req.body||'').trim().slice(0,5000),
        sourceName=String(req.sourceName||'').trim().slice(0,100),
        sourceUrl=String(req.sourceUrl||'').trim().slice(0,1000);
  if(!postType||!title||!body)return json({ok:false,error:'유형, 제목, 본문을 입력해주세요'});
  if(postType==='뉴스'&&!sourceUrl)return json({ok:false,error:'뉴스 게시글은 출처 링크가 필요합니다'});
  if(req.youtubeUrl&&!communityYoutubeUrl_(req.youtubeUrl))return json({ok:false,error:'유효한 유튜브 링크가 아닙니다'});
  const youtubeUrl=communityYoutubeUrl_(req.youtubeUrl);
  const photos=communityPhotos_(req.photos);
  if(!photos.ok)return json({ok:false,error:photos.error});
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try{
    const posts=ensurePostsSheet(),id=posts.getLastRow();
    posts.appendRow([id,postType,title,body,sourceName,sourceUrl,new Date(),'노출',0,photos.urls.join(','),youtubeUrl]);
    return json({ok:true,id:id});
  }finally{
    lock.releaseLock();
  }
}

// 유튜브 링크만 허용한다(watch?v= 또는 youtu.be 단축 링크). 형식이 아니면 빈 문자열을 반환한다.
function communityYoutubeUrl_(value){
  const url=String(value||'').trim().slice(0,300);
  if(!url)return '';
  return /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/.test(url)?url:'';
}

// req.photos는 [{name, mimeType, data(base64)}, ...] 형태를 기대한다.
function communityPhotos_(list){
  const items=Array.isArray(list)?list.slice(0,COMMUNITY_MAX_PHOTOS):[];
  if(!items.length)return {ok:true,urls:[]};
  const folder=communityPhotoFolder_();
  if(!folder.ok)return {ok:false,error:folder.error};
  const urls=[];
  for(let i=0;i<items.length;i++){
    const item=items[i]||{};
    const base64=String(item.data||'').replace(/\s/g,'').replace(/^data:[^,]+,/,'');
    const mimeType=String(item.mimeType||'').toLowerCase();
    if(!base64||!COMMUNITY_ALLOWED_PHOTO_MIME_TYPES.includes(mimeType)){
      return {ok:false,error:'JPG, PNG, WEBP, GIF 사진만 업로드할 수 있습니다.'};
    }
    let bytes;
    try{
      bytes=Utilities.base64Decode(base64);
    }catch(_){
      return {ok:false,error:'사진 파일을 읽을 수 없습니다.'};
    }
    if(!bytes.length||bytes.length>COMMUNITY_MAX_PHOTO_BYTES){
      return {ok:false,error:'사진은 1장당 4MB 이하만 업로드할 수 있습니다.'};
    }
    const safeName=String(item.name||'photo').replace(/[^A-Za-z0-9._-]/g,'_')||'photo';
    const blob=Utilities.newBlob(bytes,mimeType,'community-'+Date.now()+'-'+i+'-'+safeName);
    const file=folder.folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    urls.push('https://drive.google.com/uc?export=view&id='+file.getId());
  }
  return {ok:true,urls:urls};
}

function communityPhotoFolder_(){
  const folderId=PropertiesService.getScriptProperties().getProperty('COMMUNITY_PHOTO_FOLDER_ID');
  if(!folderId)return {ok:false,error:'관리자 사진 폴더 설정이 필요합니다.'};
  try{
    return {ok:true,folder:DriveApp.getFolderById(folderId)};
  }catch(_){
    return {ok:false,error:'관리자 사진 폴더를 확인할 수 없습니다.'};
  }
}
// ⚠️ 이 함수는 shared/verify-id-token.gs의 정본과 동일해야 한다.
// 수정 시 정본도 함께 수정하고 scripts/check-id-token-sync.mjs로 검증할 것.
function verifyIdToken(idToken){if(!idToken)return {ok:false};try{const response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+FIREBASE_API_KEY,{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:idToken}),muteHttpExceptions:true});const result=JSON.parse(response.getContentText());if(!result.users||!result.users[0])return {ok:false};const user=result.users[0];if(!user.email||!user.localId)return {ok:false};return {ok:true,uid:user.localId,email:user.email};}catch(_){return {ok:false};}}
function findPostRow(sh,id){if(!sh||sh.getLastRow()<=1)return 0;const ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();for(let i=0;i<ids.length;i++)if(String(ids[i][0])===id)return i+2;return 0;}
function countLikes(sh,id){if(sh.getLastRow()<=1)return 0;return sh.getRange(2,1,sh.getLastRow()-1,1).getValues().filter(r=>String(r[0])===id).length;}
function json(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
