# 데이터 출처

사이트에 게시하는 데이터의 출처, 검증 방법, 갱신 주기를 기록한다. 확인되지 않은 시설 정보는 공개 데이터로 간주하지 않는다.

| 데이터셋 | 원 출처 | 검증 원칙 | 사이트 표시 | 갱신 주기 |
| --- | --- | --- | --- | --- |
| 한인 운영 RCFE 시설 목록 | 커뮤니티 직접 제보/확인 | 자체 취합 데이터 — 각 시설의 California 면허번호를 CCLD 공개 검색으로 교차 검증한 것만 게시 | 시설별 licenseVerifyUrl 표시 | 수시 (신규 제보 시) |

## `data/ltc-facilities.json` 스키마

- `id`: 시설을 구분하는 고유 번호
- `name`, `nameKorean`: 시설 영문명과 한글명
- `address`, `city`, `zip`, `fullAddress`: 시설 주소 정보
- `phone`, `website`: 시설이 직접 제공한 연락처와 웹사이트
- `licenseType`: 시설 면허 유형. 현재 데이터셋은 `RCFE`를 사용한다.
- `licenseNumber`, `licenseVerifyUrl`: 방문자가 직접 라이선스 상태를 확인할 수 있게 하는 필드로 반드시 채워야 한다. CCLD 공개 검색에서 확인되지 않은 시설은 사이트에 게시하지 않는 것을 원칙으로 한다.
- `photo`: 실제 사진을 추가하기 전에는 `assets/img/ltc/PLACEHOLDER.jpg`를 참조하며, 파일이 없으면 카드에 기본 안내가 표시된다.
- `intro`: **AI가 채우지 않는다. 사람이 직접 작성한다.** 비어 있으면 카드에 “소개 준비 중입니다”가 표시된다.

## Firestore `users` 컬렉션 스키마

- 문서 ID: Firebase Authentication의 사용자 UID
- `name`: 가입자가 입력한 이름
- `email`: Firebase Authentication 계정 이메일
- `newsletterOptIn`: 뉴스레터 수신 동의 여부(Boolean). 실제 발송 시스템은 아직 연결하지 않았다.
- `newsletterUnsubscribedAt`: 회원이 수신 해지를 선택한 시각(Firestore 서버 시간). 수신 해지 시 `newsletterOptIn`은 `false`로 변경한다.
- `createdAt`: Firestore 서버 시간으로 기록한 가입 시각

회원 정보는 `firestore.rules`에서 인증된 본인이 자신의 문서에만 읽기·쓰기를 할 수 있도록 제한한다. 실제 보호를 위해서는 이 규칙을 Firebase Console에 수동 배포해야 한다.
