# Studio UI Language

Studio's UI contract is: **Glanceable · Calm · Contextual · Connected · Shoot-friendly**.

## Hierarchy

Every screen prioritizes information in this order:

1. Current state and next action
2. Essential production information
3. Supporting detail
4. Management metadata

## Shape language

Studio uses **squircle / continuous corners** as its primary shape language.

Feature code must not invent arbitrary radii. Shape values come from shared design tokens and shared surface/control primitives. Browser-native `corner-shape: squircle` may be used as progressive enhancement with a stable rounded fallback.

Suggested semantic shape tokens:

- `control` — buttons, inputs, compact badges
- `surface` — cards and rows
- `panel` — sheets, drawers, dialogs
- `hero` — large overview surfaces

## Visual density

Information can be rich; interaction should remain simple. Avoid dashboard decoration that does not improve a production decision.

## Color

Use a pure white (#ffffff) base for the app, sidebar, header, and login page. Secondary surfaces use neutral gray rather than warm cream. Semantic color is reserved for state and action.

Status must never rely on color alone. Pair color with a label and, when useful, an icon/marker.

Canonical status vocabulary:

- 준비 완료
- 확인 필요
- 문제 있음
- 미정

## Actions

Prefer one obvious primary action per context. Secondary actions should visually recede. Destructive actions must be explicit.

Frequent/simple actions belong in direct UI. Conversational AI must not replace obvious buttons, toggles, drag interactions, or simple forms.

## Context preservation

Opening a script, camera, reference, person, or equipment item from a content item should preserve the content context. Avoid making users navigate to a global management page just to inspect linked information.

## Progressive disclosure

Forms start with essential fields. Advanced fields live under a deliberate `세부 정보 추가` or equivalent disclosure.

## Reference UI

References are visual first. Prefer image boards/grids, large previews, group names, and lightweight tags over tables.

## Shoot Mode

Shoot Mode is designed for one-handed mobile use:

- large touch targets
- NOW / NEXT hierarchy
- minimal chrome
- current assignments visible without drilling down
- script and references one tap away
- no management metadata unless it affects the shoot

Test: **Can someone holding a phone on set understand what to do next within three seconds?**

## Component hierarchy

`tokens → primitives → patterns → features → pages`

Pages and features must compose shared modules rather than restyling their own versions of buttons, cards, badges, sheets, schedule rows, avatars, or reference grids.

A global visual change should have one source of truth.

## Workspace navigation
Use an icon rail for Production and bottom-aligned Settings. The adjacent sidebar lists Projects with configurable icon/color identities. Within-project Home, Schedule, Shoots and other surfaces use horizontal navigation immediately below the header. Project settings live in the rightmost project tab. Global Settings contains Account Settings, External App Connections and Data; logout appears under Account Settings. Invitation links live only in the administrator workspace User Management page. Mobile keeps the rail and opens Projects in a dismissible drawer. The production workspace icon keeps the same geometry across selection and navigation.

The workspace icon rail uses a compact 44px desktop / 42px mobile width. Use the typography roles below for navigation and supporting text; retain 16px mobile form inputs.
## Typography contract

글자 크기는 아래 역할만 사용한다. CSS의 `--text-*` 토큰이 단일 기준이며 페이지별 임의 크기나 화면 폭에 따른 탭 축소를 추가하지 않는다. 아래 px는 기본 브라우저 글자 크기 16px 기준이며 rem을 사용해 사용자 확대 설정을 존중한다.

| 역할 | 토큰 | 크기 | 사용 위치 |
| --- | --- | --- | --- |
| 페이지 제목 | `--text-page` | 22px / 1.375rem | Home·각 탭·설정·로그인·촬영 모드 제목 |
| 핵심 수치 | `--text-metric` | 22px / 1.375rem | 준비도·촬영 수·인원·장비 통계 |
| 섹션 제목 | `--text-section` | 16px / 1rem | 오늘 일정·확인 필요 등 화면 내 구역 |
| 카드·헤더 제목 | `--text-title` | 15px / .9375rem | 카드 제목·프로젝트 헤더·사이드바 제목 |
| 기본 조작·본문 | `--text-body` | 13px / .8125rem | 탭·버튼·목록 이름·본문·폼 라벨·입력 |
| 보조 설명 | `--text-support` | 12px / .75rem | 설명·시간·소유자·담당자·오류·도움말 |
| 메타 정보 | `--text-meta` | 11px / .6875rem | 상태 배지·통계 라벨·저장 상태·상단 영문 라벨 |

제목 행간 1.3, 카드 제목 1.4, 본문·조작 1.5, 보조 설명 1.6을 사용한다. 제목·강조·선택 항목은 500, 조작·라벨·본문은 400을 기준으로 한다. 상태는 색만으로 구별하지 않는다. 모바일에서도 제목·탭 크기는 유지하고 공간이 부족하면 탭을 가로 스크롤한다. 모바일 폼 입력은 자동 확대 방지를 위해 16px로 올린다. 아이콘과 로고는 텍스트 계층을 새로 만드는 근거가 아니다.

프로젝트 모양 설정은 색상 팔레트와 원형 아이콘 미리보기를 같은 행에 둔다. 아이콘 검색·분류·페이지는 선택창 안에만 표시하고, 아이콘마다 같은 원형 배경·24px 채움형 벡터를 쓴다. 기본 페이지는 제목·데이터·동작을 우선하고, 제목을 반복 설명하는 문장은 생략한다. 권한·만료·입력 제한·실패 복구 안내는 필요한 위치에 짧게 남긴다.

배치 항목도 같은 6색 팔레트와 원형 선택창을 사용한다. 사람·테이블·의자·무대·장비·기타 사물은 공통 24px 채움형 SVG로 구별하고 색상은 배치도와 편집창에 함께 반영한다. 팀 생성·멤버 초대·팀 배정은 멤버 탭 한 곳에서 관리한다.

프로젝트 설정은 넓은 화면에서 좌우로 나눈다. 왼쪽은 이름 → 색상·아이콘 → 설명, 오른쪽은 촬영일 → 시간 → 장소 순서다. 멤버 화면은 왼쪽에 명단·계정 초대, 오른쪽에 팀 생성·배정을 둔다. 좁은 화면에서는 같은 순서로 세로 배치한다. 색상과 아이콘·종류 컨트롤은 라벨을 위에 맞추고 44px 미리보기와 작은 팔레트로 구성하며 내부 세로 구분선은 사용하지 않는다.

프로젝트 모양 선택은 아이콘을 왼쪽, 색상 팔레트를 오른쪽에 둔다. 좌우 설정 구분선은 왼쪽 설명란 끝까지 이어진다. 일반 버튼·한 줄 입력·드롭다운은 데스크톱 36px, 모바일 44px 높이를 기준으로 한다. 여러 줄 텍스트와 체크박스·라디오·아이콘 전용 조작은 각각의 용도에 맞는 크기를 쓴다.

설정 제목은 한국어 제목만 남긴다. 계정·데이터·외부 연결·관리자 정보는 왼쪽 속성명, 오른쪽 값/동작으로 정렬한다. 이름은 연필 버튼으로 편집하며 600ms 입력 대기 또는 Enter/포커스 이동 시 자동 저장한다. 실패한 입력은 유지하고 재시도를 제공한다. 로그아웃은 구분선 아래 붉은 버튼으로 표시한다. 사이드바의 공유 프로젝트는 존재할 때만 표시하며 불러오기 실패 시에는 재시도를 제공한다.

사람·사물 추가의 모양 선택은 왼쪽 아이콘 아래에 종류 이름을 두고, 색상 팔레트를 바로 오른쪽에 배치한다. 색상 제목은 화면에서 생략하고 보조기기용 레이블은 유지한다.

## Workspace layout contract

`src/workspaces.css` is loaded after feature styles and owns the shared workspace frame. Production, equipment, Data Space, settings and administration use the same page title size and aligned action row. Avoid local page-width and heading-spacing overrides.

- Content maximum width: 1,440 px; desktop gutter 24 px, tablet 20 px, mobile 16 px.
- Page title: 24 px; title/action row minimum height 44 px; following gap 24 px (20 px on mobile).
- List/detail layouts: 280 px list column, flexible detail column, 24 px gap; one column at 760 px and below.
- Detail padding: 24 px desktop, 20 px tablet, 18 px mobile. List padding: 12 px.
- Inputs and action buttons: 44 px minimum height; list choices: 48 px minimum height.
- Selected rows: neutral secondary surface plus a 3 px leading marker. Focus uses the shared blue outline.
- List/detail panel corners use the shared surface radius; controls use the shared control radius.

Equipment item and loan lists use the same master/detail selection pattern as admin and Data Space. Operational canvases such as the calendar and camera layout retain their task-specific content inside the common frame.

자료 워크스페이스는 레퍼런스 / 장비 / 인원 / 대여소로 구성한다. 장비에서는 소유 인원·조직별 목록을 조회하고, 별도 장비 관리 화면에서 등록·시트 연결·반출 내역을 관리한다. 인원 기록과 로그인 계정은 구분하며, 계정 연결 시 참여 프로젝트 조회 권한이 부여된다는 확인을 표시한다. 프로젝트 레퍼런스는 ‘자료에서 불러오기’와 ‘연결 해제’를 사용한다. 프로젝트 장비의 수량 보기 왼쪽 분류는 ‘사용 확정 / 미사용 장비 / 전체 장비’로 고정하고, 멤버·조직별 보기의 소유자 목록과 구분한다.

사용자 관리는 좌측 단일 검색·목록과 우측 단일 편집 영역으로 구성하며, 목록 그룹 순서는 ‘가입자 / 조직 / 비가입자’로 고정한다. ‘인원 자료’는 ‘멤버’로 표기한다. 계정 조치는 기본 접힘으로 두고, 회원 초대는 관리자 사이드바의 별도 메뉴로 분리한다. 멤버 정보는 사용자 관리에서, 보유 장비는 캠코더 아이콘의 장비 워크스페이스에서 관리한다. 자료 사이드바에는 레퍼런스와 대여소만 표시한다.

내부 권한 키 `super_admin`의 화면 명칭은 ‘대표’로 통일한다. 대표는 모든 실제 프로젝트의 멤버에 자동 포함하며, 관리자 워크스페이스의 전체 프로젝트에서 삭제할 수 있다. 마지막 프로젝트 삭제 후에는 가짜 프로젝트를 목록에 노출하지 않고 ‘프로젝트가 없습니다.’와 프로젝트 추가 동작을 제공한다.

장비 워크스페이스의 사이드바는 **멤버 장비 / 조직 장비** 두 항목으로 구성한다. 상단 제목은 워크스페이스명이 아닌 현재 페이지명을 표시한다. 조직 선택은 본문 상단 탐색 줄의 왼쪽 검색 드롭다운에 두고, 바로 오른쪽에 **장비 목록 / 반출 현황 / 반출·반납 내역**을 둔다. 조직 변경 시 탭을 유지하고, 탭 변경·새로고침 시 조직을 유지한다. 모바일에서는 드롭다운 아래로 탭이 흐른다. 멤버 선택도 같은 위치의 검색 드롭다운을 사용하며, 멤버 장비에는 반출·반납 화면을 제공하지 않는다. 소유 멤버의 장비 등록·시트 기능은 유지한다.

조직 장비의 탐색 순서는 **장비 목록 / 반출 신청 / 반출 현황 / 반출·반납 내역 / 조직 관리**다. 반출 입력은 독립 탭에 표시한다. 조직 설정·멤버 관리와 Google 시트 만들기·연결·동기화는 조직 관리 탭에 모은다. 좁은 화면의 탭은 본문 폭을 늘리지 않고 가로 스크롤하며, 진입 시 선택 탭을 보이게 한다. 페이지 제목은 상단바에서 한 번 표시하며, 설정·자료 본문에서 같은 제목을 반복하지 않는다. 제목과 탭 사이에는 구분선을 넣지 않는다.

멤버 관리에는 장비 입력 폼을 넣지 않는다. 멤버·개인 장비는 조직 장비와 같은 장비 요약, 검색 목록, 선택 항목 상세와 편집 버튼을 사용한다. 별도의 상시 ‘보유 장비’ 입력 영역을 만들지 않고, 장비 등록 버튼에서 입력 창을 연다. 이전 멤버 기록에 저장된 개인 장비도 기존 데이터와 편집 권한을 유지한 채 같은 목록에 표시한다. 개인 장비에는 반출·반납 UI를 넣지 않는다.

사이드바는 데스크톱 208px 폭, 항목 높이 38px, 가로 여백 10px, 아이콘 간격 8px를 사용한다. 선택 항목은 연한 파랑 배경과 파랑 글자로 구분한다. 추가 동작은 `+ 이름`처럼 줄이고, 아이콘 전용 버튼에는 접근 가능한 이름과 툴팁을 제공한다.

## Workspace browse pages

사용자 관리는 가입자·조직·비가입자 탭 아래에 전체 폭 목록을 표시한다. 목록에서 선택하면 해당 항목의 편집 화면과 목록 복귀 버튼을 표시하고, 작성 중인 입력에는 기존 이탈 확인을 적용한다. 전체 프로젝트도 같은 목록 → 설정 흐름을 사용하며 분류 탭은 우선 전체 프로젝트 하나를 표시한다. 관리 화면에 추가 사이드바를 만들지 않는다.

모든 워크스페이스는 프로젝트 화면과 같은 반응형 좌우 여백 토큰을 사용한다. 탭은 헤더 바로 아래에 놓고 공통 20px 간격과 밑줄형 선택 표시를 사용한다. 1단 워크스페이스 레일에는 로고를 표시하지 않는다.

## People and project assignments

사용자 관리의 멤버 정보는 이름·호칭·연락처·이메일을 관리한다. 기존 저장 필드 `role`은 호칭으로 표시하며 권한 등급과 구분한다. 프로젝트에서 맡는 역할과 콜타임은 각 프로젝트의 멤버 항목에 저장하며 멤버 목록의 수정 버튼에서 변경한다. 여러 역할은 쉼표로 구분해 입력하고 각각 칩으로 표시한다. 연락처와 콜타임, 호칭과 프로젝트 역할을 상호 복사하지 않는다. 기존 저장 값은 자동 삭제하지 않는다.

장비 관리의 목록과 프로젝트 장비는 카메라·렌즈·조명·삼각대·SD 카드·음향·기타 장비 순으로 묶는다. 검색 결과가 없는 분류는 숨기며 현재 선택·편집 기능을 유지한다. 프로젝트 장비의 미선택 버튼은 ‘사용하기’, 선택 후 상태는 ‘✓ 사용 확정’으로 표시한다.

## Equipment model catalog

장비 워크스페이스의 멤버·조직 장비 탭에 ‘장비 도감’을 추가한다. 도감은 제조사·정식 장비 이름·별명·사진을 표시하며 소유자나 재고를 표시하지 않는다. 사진이 없으면 ‘사진 없음’으로 명확히 표시한다. 도감 편집은 대표·관리자에게만 제공하고 사용자는 조회·검색할 수 있다.

멤버·조직·프로젝트 대여장비의 이름 입력 아래에 사진·별명·제조사·정식 이름을 포함한 추천 목록을 표시한다. 선택할 때만 연결하고 이름은 별명으로 입력한다. 방향키·Enter·Escape를 지원하며, 추천을 가져오지 못해도 직접 입력할 수 있다. 이름·분류를 직접 바꾸거나 연결 해제를 누르면 모델 연결을 해제한다. 직접 입력한 기존 장비를 이름 유사성만으로 연결하지 않는다.
