# Google Tasks

홈의 Google Tasks에서 각 사용자가 직접 연결합니다. 기존 Google OAuth 클라이언트와 서버 암호화 키를 재사용하지만 Calendar·Sheets와 토큰, 동의 상태, 연결 테이블을 분리합니다. 기존 연결의 권한을 자동으로 확대하지 않습니다. MCP에는 개인 Google 데이터와 연동 설정을 노출하지 않습니다.

관리자는 Google Cloud에서 Tasks API를 활성화하고 `/oauth/google/tasks/callback`의 공개 origin 전체 URI를 기존 OAuth 클라이언트에 등록해야 합니다. 동의 화면의 테스트 사용자·게시 상태도 확인합니다. 요청 범위는 `openid email https://www.googleapis.com/auth/tasks`이며, 실제 각 사용자 승인 없이 연결하지 않습니다.

기존 Google 목록과 프로젝트의 개별 할 일을 선택하고 ‘선택 범위 연결·동기화’를 확인합니다. ‘이 프로젝트의 모든 할 일’은 현재 항목과 이후 추가 항목 모두를 포함합니다. 개인 Google 목록 전체를 Studio로 가져오지 않습니다. 프로젝트 소유자만 자신의 프로젝트를 연결합니다. 연결 중지는 원격 항목을 삭제하지 않습니다. 연결 해제는 Tasks 자격증명과 연결만 제거하고 Calendar·Sheets에는 영향을 주지 않습니다.

선택한 Studio 제목·날짜는 Google에 게시하며 완료·미완료 상태만 양방향으로 반영합니다. Google의 개인 제목·메모는 Studio에 가져오지 않고 기존 메모를 보존합니다. 약 1분 간격으로 확인하며 활성 편집 초안이 있으면 화면 갱신을 미룹니다. 양쪽 변경이 충돌하면 자동 덮어쓰기 대신 표시된 상태에서 Studio 또는 Google을 직접 선택합니다. 선택 후 원본이 바뀌었으면 다시 확인해야 합니다.

목록을 바꾸어도 기존 연결·게시 시도 항목은 원래 목록에 남고 새 항목부터 새 목록을 사용합니다. 촬영 복제의 할 일은 새 ID와 미완료 상태로 별도 취급합니다. 개별 선택 범위에는 복사본을 자동 추가하지 않습니다. 삭제·목록 이동은 전파하지 않습니다. 응답이 유실된 생성은 비공개 연결 표식을 재조회해 복구합니다. 생성 여부를 확인할 수 없으면 중복 생성을 막기 위해 재생성하지 않고 문제를 표시합니다. 권한 상실·만료·할당 항목·하위 항목·삭제 항목·할당량 오류도 표시하며 일시적 오류는 재시도 간격을 늘립니다.

Google Tasks API는 예정 날짜만 지원하고 시각은 읽고 쓸 수 없습니다. Studio 시각은 보존합니다. 반복 설정과 하위 계층, Docs/Chat에서 할당한 항목은 동기화하지 않습니다. 반복의 다음 발생을 추정해 만들지 않습니다. API 제한을 넘는 제목·메모를 잘라 저장하지 않습니다.

공식 계약: [Task 리소스](https://developers.google.com/workspace/tasks/reference/rest/v1/tasks), [생성](https://developers.google.com/workspace/tasks/reference/rest/v1/tasks/insert). 테스트는 격리 DB와 가짜 Google 응답만 사용합니다. 실제 Google 동의와 운영 쓰기는 별도 사용자 동의 이후 검증해야 합니다.
