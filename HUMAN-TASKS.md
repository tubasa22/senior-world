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

## 🔲 관리자 대시보드 활성화

- [x] `firestore.rules` 내용을 Firebase Console(Firestore Database → 규칙 탭)에 재배포 (2026-09-08, 인증 없는 REST GET의 403 확인)
- [ ] Apps Script 프로젝트에 OAuth2 라이브러리 추가 (라이브러리 ID: `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`)
- [ ] Firebase 서비스 계정 JSON 키 발급 후 Apps Script "스크립트 속성"에 `FIREBASE_SERVICE_ACCOUNT_KEY`로 등록
- [ ] `newsletter-backend.gs`를 웹 앱으로 배포하고 `/exec` URL을 `admin.html`의 `NEWSLETTER_API`에 입력

## 🔲 다음 세션 우선순위 (기술·법적 종합검토 기준)

- [x] Firestore 보안 규칙 Console 배포 및 검증 — 2026-09-08 완료
- [x] admin.html 변수명 충돌 재검증 — 문제 없음 확인, 2026-09-08
- [x] 묘지 파일 업로드 서버측 검증 재검증 — 이미 구현됨 확인, 2026-09-08
- [x] privacy.html 전면 갱신 — 실제 코드 필드 대조 및 diff 검증 완료, 2026-09-08
- [ ] 8개 백엔드(.gs) 파일의 idToken 검증 방식 통일 여부 전수 확인 (identitytoolkit 방식으로)
- [ ] apartments.json 계열 email 필드 보유 건수 확인
- [ ] 이해충돌 정책 문서 작성 (501(c)(3) 신청 전제조건)

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
