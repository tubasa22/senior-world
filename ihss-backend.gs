const FIREBASE_API_KEY = 'AIzaSyDmMQTIqpwB3NfsomVwEThhkSFUYuHxQ4Y';
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
const IHSS_SHEET = 'ihss_posts';
const IHSS_COLS = ['id','type','nickname','area','contactMethod','contactValue','content','postedAt','status'];
function setup(){ const ss=SpreadsheetApp.getActiveSpreadsheet(); let sh=ss.getSheetByName(IHSS_SHEET); if(!sh){sh=ss.insertSheet(IHSS_SHEET);sh.appendRow(IHSS_COLS);sh.setFrozenRows(1);sh.getRange(1,1,1,IHSS_COLS.length).setFontWeight('bold');} }
function doGet(){ const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IHSS_SHEET),out=[]; if(sh&&sh.getLastRow()>1){sh.getRange(2,1,sh.getLastRow()-1,IHSS_COLS.length).getValues().forEach(r=>{const p={};IHSS_COLS.forEach((k,i)=>p[k]=r[i]);if(String(p.status).trim()==='노출')out.push({id:p.id,type:p.type,nickname:p.nickname,area:p.area,contactMethod:p.contactMethod,contactValue:p.contactValue,content:p.content,postedAt:p.postedAt});});} out.sort((a,b)=>new Date(b.postedAt)-new Date(a.postedAt));return json(out); }
function doPost(e){try{const b=JSON.parse((e.postData&&e.postData.contents)||'{}');if(b.action==='listAll')return ihssListAll_(b);if(b.action==='approve')return ihssSetStatus_(b,'노출');if(b.action==='reject')return ihssSetStatus_(b,'거부');const verified=verifyIdToken(b.idToken);if(!verified.ok)return json({ok:false,error:'로그인이 필요합니다.'});if(b.website)return json({ok:true});const type=['구합니다','제공합니다'].includes(b.type)?b.type:'';const nickname=String(b.nickname||'').trim().slice(0,40)||'익명';const area=String(b.area||'').trim().slice(0,40);const contactMethod=['전화','이메일'].includes(b.contactMethod)?b.contactMethod:'';const contactValue=String(b.contactValue||'').trim().slice(0,100);const content=String(b.content||'').trim().slice(0,500);if(!b.consent||!type||!area||!contactMethod||!contactValue||!content)return json({ok:false,error:'필수 항목과 공개 동의를 확인해주세요.'});const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IHSS_SHEET);if(!sh)return json({ok:false,error:'게시판 설정이 필요합니다.'});sh.appendRow([sh.getLastRow(),type,nickname,area,contactMethod,contactValue,content,new Date(),'검토중']);return json({ok:true});}catch(_){return json({ok:false,error:'등록에 실패했습니다.'});}}

function ihssAdminToken_(idToken){const token=verifyIdToken(idToken);if(!token.ok)return {ok:false,error:'로그인이 필요합니다.'};if(!IHSS_ADMIN_EMAILS.includes(String(token.email||'').toLowerCase()))return {ok:false,error:'관리자 권한이 없습니다.'};return {ok:true};}
function ihssListAll_(b){const admin=ihssAdminToken_(b.idToken);if(!admin.ok)return json({ok:false,error:admin.error});const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IHSS_SHEET),out=[];if(sh&&sh.getLastRow()>1){sh.getRange(2,1,sh.getLastRow()-1,IHSS_COLS.length).getValues().forEach(r=>{const p={};IHSS_COLS.forEach((k,i)=>p[k]=r[i]);out.push(p);});}out.sort((a,b)=>new Date(b.postedAt)-new Date(a.postedAt));return json({ok:true,posts:out});}
function ihssSetStatus_(b,status){const admin=ihssAdminToken_(b.idToken);if(!admin.ok)return json({ok:false,error:admin.error});const id=String(b.id||'').trim(),sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IHSS_SHEET);if(!id||!sh)return json({ok:false,error:'게시글을 찾을 수 없습니다.'});const rows=sh.getLastRow(),ids=sh.getRange(2,1,rows-1,1).getValues();for(let i=0;i<ids.length;i++){if(String(ids[i][0])===id){sh.getRange(i+2,9).setValue(status);return json({ok:true});}}return json({ok:false,error:'게시글을 찾을 수 없습니다.'});}
function json(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
