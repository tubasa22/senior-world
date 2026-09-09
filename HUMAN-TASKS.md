# 사람이 직접 해야 하는 작업 목록

이 파일은 코드로 자동화할 수 없고, 계정 로그인이나 민감한 키
입력이 필요해서 **사람만 처리 가능한 작업**을 모아둔 체크리스트다.
Codex나 Claude가 새 세션을 시작할 때 이 파일을 먼저 확인하고,
완료되지 않은 항목이 있으면 사용자에게 상기시켜야 한다.

완료한 항목은 `[ ]`를 `[x]`로 바꾸고, 완료 날짜를 옆에 적는다.

## ✅ 해결 완료 — Firestore `users` 공개 읽기 취약점 (2026-09-08)

- [x] Firebase Console → Firestore Database → 규칙 탭에서 기존 테스트 모드
  기본 규칙(2026-10-02까지 전체 공개 read/write 허용)을 발견했다. 저장소의
  `firestore.rules` 내용으로 교체한 뒤 **Publish**했다.
- [x] Publish 직후 인증 없는 Firestore REST GET 요청을 재실행해
  `403 PERMISSION_DENIED` 응답을 확인했다. 조치 전에는 같은 요청이 HTTP
  200으로 실제 회원 문서를 반환했다.
- [x] 확인된 노출 범위는 회원 2건의 이름, 이메일, 뉴스레터 동의 여부,
  가입일이다. 비밀번호 등 인증 정보는 Firestore가 아닌 Firebase Auth
  저장소에 있어 이 노출 범위에 포함되지 않았다.
- [ ] 회원 고지 필요 여부와 관련 기록 보관은 사람이 판단한다.

## 🔲 커뮤니티 게시판 사진 기능 (신규, 사람이 해야 하는 설정 1단계 있음)

- [ ] 구글 드라이브에 사진 저장용 폴더를 하나 만들고, `community-backend.gs`가
  배포된 Apps Script 프로젝트의 "프로젝트 설정 → 스크립트 속성"에
  `COMMUNITY_PHOTO_FOLDER_ID`라는 이름으로 그 폴더의 ID를 등록한다
  (폴더 자체를 공개로 바꿀 필요는 없음 — 업로드되는 파일마다 개별적으로
  "링크가 있는 모든 사용자 보기" 권한이 자동으로 부여됨).
- [ ] 코드 반영 후 첫 실행 시 Drive 접근 권한(새 스코프) 승인 팝업이 뜰 수
  있음 — 승인해야 사진 업로드가 동작한다.
- [ ] 재배포 후 admin.html에서 사진 1장 + 유튜브 링크 포함해서 글쓰기
  테스트, community.html에서 정상 표시되는지 확인.

## 🔲 관리자 대시보드 활성화

- [x] `firestore.rules` 내용을 Firebase Console(Firestore Database → 규칙 탭)에 재배포 (2026-09-08, 인증 없는 REST GET의 403 확인)
- [ ] Apps Script 프로젝트에 OAuth2 라이브러리 추가 (라이브러리 ID: `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`)
- [ ] Firebase 서비스 계정 JSON 키 발급 후 Apps Script "스크립트 속성"에 `FIREBASE_SERVICE_ACCOUNT_KEY`로 등록
- [ ] `newsletter-backend.gs`를 웹 앱으로 배포하고 `/exec` URL을 `admin.html`의 `NEWSLETTER_API`에 입력
- [ ] ⚠️ Apps Script 재배포 필수: `ihss-backend.gs`,
  `cemetery-backend.gs`, `newsletter-backend.gs`의 로그인 검증 코드는
  저장소에는 반영됐으나, Apps Script 편집기에 붙여넣고 웹 앱으로
  재배포해야 실제 서버에 적용됨. 기존 배포가 있다면 재배포 전까지는
  이전 코드로 동작하므로 IHSS·묘지 게시판을 실서비스로 켜기 전
  반드시 최신 코드로 배포하고 인증 없는 등록 요청의 거부를 확인할 것.
  `facility-outreach-backend.gs`도 verifyAdmin 내부 구조를 리팩터링
  했으므로(동작은 동일) 다음 재배포 시 함께 최신 코드로 교체할 것.

## 🔲 다음 세션 우선순위 (기술·법적 종합검토 기준)

- [x] Firestore 보안 규칙 Console 배포 및 검증 — 2026-09-08 완료
- [x] admin.html 변수명 충돌 재검증 — 문제 없음 확인, 2026-09-08
- [x] 묘지 파일 업로드 서버측 검증 재검증 — 이미 구현됨 확인, 2026-09-08
- [x] privacy.html 전면 갱신 — 실제 코드 필드 대조 및 diff 검증 완료, 2026-09-08
- [x] 백엔드 idToken 검증 방식 통일 — IHSS·묘지·뉴스레터 identitytoolkit
  전환 및 IHSS·묘지 서버측 로그인 검증 추가 완료 (커밋 `ad17e9c`,
  2026-09-08 커밋 해시 직접 검증으로 확인). 이번 완료 범위는 해당 3개
  파일이며, 8개 백엔드 전체에 로그인 검증을 추가했다는 의미는 아님.
- [x] idToken 검증 로직 통합·재사용 — `shared/verify-id-token.gs`를
  정본으로 신설하고, `cemetery-backend.gs`·`community-backend.gs`·
  `ihss-backend.gs`·`member-backend.gs`·`newsletter-backend.gs`·
  `facility-outreach-backend.gs` 6개 파일이 정본과 동일한지
  자동 검증하는 `scripts/check-id-token-sync.mjs` 작성, 실행 결과
  6개 전부 일치 확인, 2026-09-08. Apps Script가 프로젝트 간 코드
  공유를 지원하지 않아 "복사-후-자동검증" 방식을 택함 (진짜 라이브러리
  방식은 프로젝트마다 라이브러리 추가·버전 갱신이라는 별도 수동
  배포 부담이 생겨 현재 1인 운영 구조에는 부적합하다고 판단).
- [ ] apartments.json 계열 email 필드 보유 건수 확인
- [x] 이해충돌 정책 문서 초안 작성 — `CONFLICT-OF-INTEREST-POLICY.md`
  신설 (IRS Form 1023 부록 A 구조 기반, 운영자 겸업 회피 절차 포함),
  2026-09-08. **초안 단계이며 아래 3가지는 사람이 직접 처리해야
  최종 완료됨:**

- [ ] 비영리 전문 변호사/CPA 검토
- [ ] 이사회 구성 후 정식 채택 결의
- [ ] 제6조 "외부 검토자" 실제 후보자 지정

- [x] 누적 미확인 지시사항 4건 재검증 — 아래 구현을 로컬 코드로
  직접 확인, 코드 수정 불필요, 2026-09-08:
  - 모달 취소 버튼 CSS: `admin.html`의
    `.hidden{display:none!important}`가 `.modal-backdrop{display:grid}`보다
    우선 적용됨. 이는 뉴스레터/시설 아웃리치 확인 모달 검사이며,
    IHSS/묘지 모달 동작을 검증한 것은 아님.
  - `ltc-facilities.html` 편의시설/FAQ/갤러리: amenityCategories,
    faq `<details>`, photo-gallery/gallery-fallback 렌더링 모두 구현됨.
  - 시설 아웃리치 이메일(영/한 템플릿): admin.html 탭·템플릿·
    수신자 선택·확인 모달·FACILITY_OUTREACH_API 호출 코드 연결 확인.
    API URL은 아직 비어 있으며 실제 발송 검증은 남아 있음.
  - tubasa22@gmail.com 관리자 네비 자동 노출: `assets/auth.js`의
    `isAdminUser()`가 관리자 이메일을 대조하고 `[data-auth-ui]` 영역에
    "🔧 관리자" 링크를 주입함. 해당 영역과 auth.js를 사용하는 페이지에 적용됨.

## 🔲 데이터 관련

- [ ] KIWA(kiwa.org)에 연락해서 2026년 8월 저소득 아파트 목록(LA 9건)을
  사이트에 정식 게시해도 되는지 재게시 허락 받기
- [ ] `data/ltc-facilities.json`에 실제 한인 운영 요양시설 정보·
  소개글·사진을 직접 수집해서 채워 넣기 (AI가 소개글을
  대신 작성하지 않는 원칙 유지 — 반드시 사람이 작성)

## 🔲 데이터 수집 (신규)

- [ ] `data/apartments.json`, `data/la-apartments-2026-08.json`의
  email 필드 보유 건수 확인 — 관리자 시설 정보 업데이트
  이메일 기능의 실효성 판단 근거
  (현재 `data/apartments.json`은 없고 LA 데이터 9건의 email은 모두 null)
- [ ] 시설 방문 시 `FACILITY-INTAKE-GUIDE.md` 체크리스트대로
  정보·사진 수집 (사람 미노출 촬영 원칙 준수)

## 🔲 법적/거버넌스

- [ ] `LICENSE` 파일 내용 검토 (저작권자 표기가 실제 소유 구조와
  맞는지 — 개인 소유인지, 향후 단체 명의로 바꿀 것인지 결정)
- [ ] `privacy.html`(개인정보처리방침) 내용이 실제 수집 항목과
  일치하는지 주기적으로 재검토 (새 기능 추가 시마다)

## 🔲 콘텐츠 검수

- [ ] 랜딩 페이지 히어로/창업스토리 이미지가 실제로 반영됐는지
  브라우저에서 직접 확인 (이전 세션에서 "반영함"으로 기록됐으나
  최종 화면 확인은 안 됨)
- [ ] `funeral-guide.html`에 상업적 콘텐츠(보험사명, 상담사 정보,
  납입요율표)가 실수로 섞여있지 않은지 직접 읽어보고 확인

## 사용법

- 새 작업을 Codex/Claude에게 지시할 때 "이건 사람이 해야 함"이라는
  판단이 나오면, 이 파일에 새 항목을 추가해달라고 요청한다.
- 이 파일의 미완료 항목이 5개 이상 쌓이면, 정기적으로(예: 주 1회)
  훑어보고 처리한다.
