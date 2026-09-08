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
const CEMETERY_POSTS_SHEET = 'cemetery_posts';
const CEMETERY_VERIFICATION_SHEET = 'cemetery_verification';
const CEMETERY_POST_COLUMNS = ['id','type','nickname','cemeteryName','area','plotInfo','price','contactMethod','contactValue','postedAt','status'];
const CEMETERY_VERIFICATION_COLUMNS = ['id','driveFileUrl','uploadedAt'];
const CEMETERY_TYPES = ['양도합니다','구합니다'];
const CEMETERY_CONTACT_METHODS = ['전화','이메일'];
const CEMETERY_MAX_FILE_BYTES = 5 * 1024 * 1024;
const CEMETERY_ALLOWED_MIME_TYPES = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];

function setupCemeterySheets(){
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ensureCemeterySheet_(spreadsheet, CEMETERY_POSTS_SHEET, CEMETERY_POST_COLUMNS);
  ensureCemeterySheet_(spreadsheet, CEMETERY_VERIFICATION_SHEET, CEMETERY_VERIFICATION_COLUMNS);
}

function ensureCemeterySheet_(spreadsheet, name, columns){
  let sheet = spreadsheet.getSheetByName(name);
  if(!sheet){
    sheet = spreadsheet.insertSheet(name);
    sheet.appendRow(columns);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,columns.length).setFontWeight('bold');
  }
  return sheet;
}

function doGet(){
  const postsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CEMETERY_POSTS_SHEET);
  const posts = [];
  if(postsSheet && postsSheet.getLastRow() > 1){
    postsSheet.getRange(2,1,postsSheet.getLastRow()-1,CEMETERY_POST_COLUMNS.length).getValues().forEach(row=>{
      const post = {};
      CEMETERY_POST_COLUMNS.forEach((column,index)=>post[column]=row[index]);
      if(String(post.status).trim() === '노출'){
        posts.push({id:post.id,type:post.type,nickname:post.nickname,cemeteryName:post.cemeteryName,area:post.area,plotInfo:post.plotInfo,price:post.price,contactMethod:post.contactMethod,contactValue:post.contactValue,postedAt:post.postedAt});
      }
    });
  }
  posts.sort((a,b)=>new Date(b.postedAt)-new Date(a.postedAt));
  return cemeteryJson_(posts);
}

function doPost(event){
  try{
    const body = JSON.parse((event.postData && event.postData.contents) || '{}');
    if(body.action !== 'submitListing') return cemeteryJson_({ok:false,error:'지원하지 않는 요청입니다.'});
    if(body.website) return cemeteryJson_({ok:true});
    return submitCemeteryListing_(body);
  }catch(_){
    return cemeteryJson_({ok:false,error:'등록에 실패했습니다.'});
  }
}

function submitCemeteryListing_(body){
  if(CEMETERY_TYPES.includes(body.type)){
    const verified = verifyIdToken(body.idToken);
    if(!verified.ok) return cemeteryJson_({ok:false,error:'로그인이 필요합니다.'});
  }
  const type = CEMETERY_TYPES.includes(body.type) ? body.type : '';
  const nickname = cemeteryText_(body.nickname,40) || '익명';
  const cemeteryName = cemeteryText_(body.cemeteryName,120);
  const area = cemeteryText_(body.area,40);
  const plotInfo = cemeteryText_(body.plotInfo,160);
  const price = cemeteryText_(body.price,60);
  const contactMethod = CEMETERY_CONTACT_METHODS.includes(body.contactMethod) ? body.contactMethod : '';
  const contactValue = cemeteryText_(body.contactValue,100);
  if(!body.consent || !type || !cemeteryName || !area || !contactMethod || !contactValue){
    return cemeteryJson_({ok:false,error:'필수 항목과 공개 동의를 확인해주세요.'});
  }

  const certificate = cemeteryCertificate_(body);
  if(!certificate.ok) return cemeteryJson_({ok:false,error:certificate.error});
  const folder = cemeteryPrivateFolder_();
  if(!folder.ok) return cemeteryJson_({ok:false,error:folder.error});

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const postsSheet = ensureCemeterySheet_(spreadsheet,CEMETERY_POSTS_SHEET,CEMETERY_POST_COLUMNS);
  const verificationSheet = ensureCemeterySheet_(spreadsheet,CEMETERY_VERIFICATION_SHEET,CEMETERY_VERIFICATION_COLUMNS);
  const id = cemeteryNextId_(postsSheet);
  const file = folder.folder.createFile(certificate.blob.setName('cemetery-certificate-' + id + '-' + certificate.safeName));
  postsSheet.appendRow([id,type,nickname,cemeteryName,area,plotInfo,price,contactMethod,contactValue,new Date(),'검토중']);
  verificationSheet.appendRow([id,file.getUrl(),new Date()]);
  return cemeteryJson_({ok:true});
}

function cemeteryCertificate_(body){
  const base64 = String(body.certificateBase64 || '').replace(/\s/g,'').replace(/^data:[^,]+,/,'');
  const mimeType = String(body.certificateMime || '').toLowerCase();
  const safeName = cemeteryText_(body.certificateName,120).replace(/[^A-Za-z0-9._-]/g,'_') || 'certificate';
  if(!base64 || !mimeType || !CEMETERY_ALLOWED_MIME_TYPES.includes(mimeType)){
    return {ok:false,error:'JPG, PNG, WEBP, GIF 또는 PDF 증빙 서류를 업로드해주세요.'};
  }
  try{
    const bytes = Utilities.base64Decode(base64);
    if(!bytes.length || bytes.length > CEMETERY_MAX_FILE_BYTES) return {ok:false,error:'증빙 서류는 5MB 이하만 업로드할 수 있습니다.'};
    return {ok:true,blob:Utilities.newBlob(bytes,mimeType),safeName:safeName};
  }catch(_){
    return {ok:false,error:'증빙 서류 형식을 읽을 수 없습니다.'};
  }
}

function cemeteryPrivateFolder_(){
  const folderId = PropertiesService.getScriptProperties().getProperty('CEMETERY_CERT_FOLDER_ID');
  if(!folderId) return {ok:false,error:'관리자 증빙 서류 폴더 설정이 필요합니다.'};
  try{
    const folder = DriveApp.getFolderById(folderId);
    if(folder.getSharingAccess() !== DriveApp.Access.PRIVATE){
      return {ok:false,error:'증빙 서류 폴더는 관리자 전용 비공개로 설정해야 합니다.'};
    }
    return {ok:true,folder:folder};
  }catch(_){
    return {ok:false,error:'관리자 증빙 서류 폴더를 확인할 수 없습니다.'};
  }
}

function cemeteryNextId_(sheet){
  if(sheet.getLastRow() < 2) return 1;
  const ids = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().map(row=>Number(row[0]) || 0);
  return Math.max.apply(null,ids) + 1;
}

function cemeteryText_(value,maxLength){
  return String(value || '').trim().slice(0,maxLength);
}

function cemeteryJson_(value){
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
