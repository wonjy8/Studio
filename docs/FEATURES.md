# Studio Features

## Projects and account settings

Choose a project from the production sidebar, then use its tabs to plan the shoot. Project settings let you edit the name, description, date, time, location, icon and color. On mobile, open the project drawer from the menu button.

Use an invitation link to sign up. Account settings provide name editing, password changes and logout.

## Readiness and shooting

Home shows readiness, upcoming activity and items needing attention. Open a shoot to edit its date, name, time and location, or view its script, camera plan and references. Upload a PDF script to preview it or download the original.

Shoot Mode focuses on the current and next shoot, with quick access to scripts and references and an action to mark a shoot complete.

## Schedule and tasks

Switch between the schedule calendar and list. Calendar controls offer month, week and day views, date selection and navigation to today. Shoots can have individual dates; undated items remain marked as undated.

The task tab supports adding, renaming, completing, flagging and deleting tasks, with optional dates and times.

## Members and teams

Search for an existing account and select it to invite a project member. People without accounts can be added to the manual roster. Labels distinguish linked accounts from manual entries. Create teams and assign one person to multiple teams.

Equipment ownership and shoot-day responsibility are separate. Member views show assigned equipment, while equipment views show the owner and responsible person.

## Camera plans and references

Add cameras, people, furniture, equipment, lighting and annotations to the project plan. Move, resize, rotate or recolor placements using the available pointer, keyboard or numeric controls. People and round tables keep their proportions. Select existing equipment when adding a camera or lighting placement.

Reference groups collect images and notes. Link them to cameras and open them from the shoot context.

## Equipment collections and checkout

Open the equipment workspace and use the sidebar dropdown to choose My Equipment or an organization collection you can access. The same dropdown has an Add Organization action. The selected collection stays selected when you reload or use browser history.

Register individual or quantity-based equipment, optionally adding a management code, model, serial number, storage location, condition and custodian. View owned, checked-out and available quantities. Record checkout, filter outstanding loans and record partial or complete returns. Checkout and return history retains earlier events.

Project equipment offers personal equipment, shared member equipment, approved organization equipment and direct project registration. Link existing equipment instead of registering it again; linking does not increase stock. Newly registered project equipment stays within that project. Connecting manual equipment to an account requires an explicit request and that account's acceptance; matching names does not create ownership.

Personal equipment owners choose which projects may use their equipment. Organization managers approve project access to organization equipment. A project link does not share the whole organization collection or other borrowers' records. Project colleagues cannot change someone else's equipment source.

## Organization roles and invitations

| Role | Available actions |
| --- | --- |
| Owner | Edit organization settings, appoint administrators, invite members and manage equipment, checkout and returns. |
| Administrator | Invite members, manage lower roles and manage equipment, checkout and returns. |
| Operator | Register and edit equipment and manage checkout and returns. |
| Viewer | View equipment, checkout status and return history. |

Organization invitations require acceptance. Members can leave, but the last available owner cannot leave or give up ownership. Equipment and history remain with the organization when a member leaves.

The Studio administrator workspace includes user and equipment pages and an organization invitation page. Its organization page lists organizations and can invite another account as administrator, operator or viewer, or cancel a pending invitation sent from that page. This invitation action does not transfer ownership or give the Studio administrator additional organization equipment or borrowing access.

## Site roles and project management

Site roles are Supreme Administrator, Administrator and User, separate from organization roles. The first successful login receives the supreme role on a newly initialized installation with role management enabled. Existing installations require a separate verified transition. The supreme administrator appoints or removes administrators and cannot be deleted.

Both administrator grades can open the All Projects page and edit project details, shoots, members, teams, tasks and reference notes, with a reason recorded for changes. The page also edits existing cameras and placement position, size and text, and manages scripts and reference images linked to the selected project. Upload, preview, download or unlink an attachment; unlinking retains its original file and other links. Equipment changes there are limited to project assignments and readiness. Account settings and equipment ownership remain separately controlled.

When site role management is enabled and the highest administrator is established, account deletion requires a separate preview and explicit confirmation. Protected accounts and accounts connected to shared or historical records cannot be deleted. An allowed deletion removes the login and private project/file data and cannot be restored in the app; separately retained backups and eligible historical deletion audit records are unaffected. Previously deleted accounts are not restored or automatically purged. Administrators can delete ordinary users; only the supreme administrator can review deleting another administrator, subject to the same dependency checks. The supreme administrator cannot be deleted.

Account settings also offer permanent account deletion with a fresh password check and explicit confirmation. Administrator accounts must first have their administrator role removed by the supreme administrator. Shared ownership and retained history can block deletion and require separate review; no shared records are removed automatically.

## External apps

External app connections are optional. Connect an app from settings, review the requested access and disconnect it when no longer needed. Connected assistants can help find project information and prepare supported changes within the access you allow.

## 관리자·조직 연결·장비 시트

- 관리자 사용자 화면에서 정지 및 영구삭제 사유는 선택 입력입니다. 아이디 확인은 `@` 없이 입력하며, 최근 관리 기록 영역은 표시하지 않습니다. 영구삭제의 미리보기·보호 계정·삭제 범위 확인은 유지됩니다.
- 기존 조직 관리 화면에서 조직명과 선택 설명으로 조직을 만들 수 있습니다. 생성 후 해당 조직을 선택해 초대를 관리할 수 있습니다.
- 프로젝트 멤버 화면에서 관리 권한이 있는 조직을 연결할 수 있습니다. 기존 조직의 프로젝트 공유 승인을 사용하며, 조직 장비는 원본 장비 ID로 자동 연동됩니다. 이후 추가된 장비도 프로젝트를 불러올 때 반영되며, 다른 프로젝트 및 조직의 재고·대여 내역 접근 권한은 추가하지 않습니다.
- 장비 보관함의 **시트 만들기**에서 최대 200행을 작성하거나 CSV 양식을 내려받아 불러올 수 있습니다. 등록 전 행별 오류를 확인하며, 일괄 등록은 전체 성공 또는 전체 취소로 처리됩니다. 같은 요청을 재시도해도 장비가 중복 생성되지 않습니다. 등록 위치는 현재 선택한 개인/조직 보관함입니다.
