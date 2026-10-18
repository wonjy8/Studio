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
| 페이지 제목 | `--text-page` | 24px / 1.5rem | Home·각 탭·설정·로그인·촬영 모드 제목 |
| 핵심 수치 | `--text-metric` | 24px / 1.5rem | 준비도·촬영 수·인원·장비 통계 |
| 섹션 제목 | `--text-section` | 18px / 1.125rem | 오늘 일정·확인 필요 등 화면 내 구역 |
| 카드·헤더 제목 | `--text-title` | 16px / 1rem | 카드 제목·프로젝트 헤더·사이드바 제목 |
| 기본 조작·본문 | `--text-body` | 14px / .875rem | 탭·버튼·목록 이름·본문·폼 라벨·입력 |
| 보조 설명 | `--text-support` | 13px / .8125rem | 설명·시간·소유자·담당자·오류·도움말 |
| 메타 정보 | `--text-meta` | 12px / .75rem | 상태 배지·통계 라벨·저장 상태·상단 영문 라벨 |

제목 행간 1.3, 카드 제목 1.4, 본문·조작 1.5, 보조 설명 1.6을 사용한다. 제목은 700 전후, 조작·라벨은 600 전후, 본문은 400을 기준으로 한다. 상태는 색만으로 구별하지 않는다. 모바일에서도 제목·탭 크기는 유지하고 공간이 부족하면 탭을 가로 스크롤한다. 모바일 폼 입력은 자동 확대 방지를 위해 16px로 올린다. 아이콘과 로고는 텍스트 계층을 새로 만드는 근거가 아니다.

프로젝트 모양 설정은 색상 팔레트와 원형 아이콘 미리보기를 같은 행에 둔다. 아이콘 검색·분류·페이지는 선택창 안에만 표시하고, 아이콘마다 같은 원형 배경·24px 채움형 벡터를 쓴다. 기본 페이지는 제목·데이터·동작을 우선하고, 제목을 반복 설명하는 문장은 생략한다. 권한·만료·입력 제한·실패 복구 안내는 필요한 위치에 짧게 남긴다.

배치 항목도 같은 6색 팔레트와 원형 선택창을 사용한다. 사람·테이블·의자·무대·장비·기타 사물은 공통 24px 채움형 SVG로 구별하고 색상은 배치도와 편집창에 함께 반영한다. 팀 생성·멤버 초대·팀 배정은 멤버 탭 한 곳에서 관리한다.

프로젝트 설정은 넓은 화면에서 좌우로 나눈다. 왼쪽은 이름 → 색상·아이콘 → 설명, 오른쪽은 촬영일 → 시간 → 장소 순서다. 멤버 화면은 왼쪽에 명단·계정 초대, 오른쪽에 팀 생성·배정을 둔다. 좁은 화면에서는 같은 순서로 세로 배치한다. 색상과 아이콘·종류 컨트롤은 라벨을 위에 맞추고 44px 미리보기와 작은 팔레트로 구성하며 내부 세로 구분선은 사용하지 않는다.
