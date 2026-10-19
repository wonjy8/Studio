# Studio Architecture

## Information architecture

```text
Workspace
└── Project
    ├── Home / Overview
    ├── Schedule
    ├── Shoots
    ├── Camera Layout
    ├── References
    ├── Members
    ├── Equipment
    └── Budget (later)
```

A **Project** is the overall production project. A **Shoot** is the practical shooting unit inside that project. `Shoot` replaces the former `Content` concept in product language.

## Domain relationships

```text
Project
├── ScheduleItem ──> Shoot
├── Shoot
│   ├── ScriptFile[]
│   ├── CastAssignment ──> Person
│   ├── CrewAssignment ──> Person
│   ├── CameraSetup ──> CameraPosition
│   ├── EquipmentUse ──> Equipment
│   ├── ReferenceLink ──> ReferenceGroup
│   └── Location
├── Person ──owns──> Equipment
├── Equipment
│   ├── owner
│   └── dayOfAssignee
└── ReferenceGroup
    └── ReferenceImage[]
```

Relationships are stored once and reused across surfaces.

## Script model

A script is primarily a source file, not an in-app rich-text document.

- Preserve original file for download.
- Provide an embeddable preview, with PDF as the preferred preview format.
- Keep script version metadata separate from file bytes.
- User files belong to runtime/private storage, never the repository.

## Reference model

A `ReferenceGroup` is a reusable visual target such as bust shot, two-shot, wide, or side. It contains ordered images and optional notes. Cameras and Shoots can link to one or more groups.

A reference group is not a required shot list.

## Camera model

A camera position links body, lens, operator, equipment, and visual references for a Shoot. Camera layout is Shoot-aware because the same room can use different setups for different Shoots.

## Source architecture

```text
src/
├── app/                 # app shell, routing, providers
├── design-system/
│   ├── tokens/          # spacing, type, color, shape, motion
│   └── primitives/      # Button, Card, Squircle, Badge, etc.
├── patterns/            # ScheduleRow, PersonChip, ReferenceGrid, etc.
├── domain/              # types, validation, domain operations
├── features/            # feature-specific composition
├── pages/               # route-level composition
└── integrations/        # optional runtime integrations, behind interfaces
```

Dependency direction is one-way:

`pages → features → patterns → primitives → tokens`

Domain operations may be consumed by pages/features and by integrations. Design-system code must not depend on feature code.

## Data boundaries

Studio separates four classes of data:

```text
PUBLIC SOURCE
  source code + docs

PUBLIC DEMO
  synthetic fixtures only

PRIVATE RUNTIME DATA
  projects + shoots + scripts + images + people + equipment + files

SECRET AUTH DATA
  provider credentials + sessions/tokens
```

No private runtime or secret auth data belongs in Git.

## AI integration boundary

AI is optional and disconnected by default. The app exposes a provider-neutral integration boundary. The current integration is an external ChatGPT MCP app authorized through Studio OAuth. The in-app API-key assistant and provider configuration are not provided.

AI actions call the same domain operations as direct UI actions. This gives both paths the same validation, conflict checks, authorization, history, and undo behavior.

Example domain operations:

- `moveScheduleItem`
- `assignPerson`
- `assignEquipment`
- `setEquipmentOwner`
- `updateCameraSetup`
- `linkReferenceGroup`
- `setReadinessState`

Provider credentials are never checked into source code and must not be embedded into browser bundles.

## Change safety

Important cross-feature mutations should calculate impact before commit. Moving a schedule item may affect cast call times, crew availability, camera/equipment conflicts, and adjacent schedule items.

The UI and AI layer should present an impact summary and support undo/history for meaningful changes.

## Scene layout and equipment inventory
`src/domain/layout.js` owns layout mutations and shared equipment categories. Camera setups reference `gearId` in the project's inventory (category `camera`); new setups must select an existing, available camera from project equipment. Creating a setup never creates an inventory item. Legacy setups are linked during project preparation, idempotently. The existing camera body field is retained for compatibility.

Optional `layoutObjects` supports person/table/chair/stage/equipment/other, percentage x/y and rotation. Equipment placements require a valid project-local `gearId`; people may link a project-local `memberId`. Other objects are spatial context, not inventory. Camera, lens, lighting, tripod, SD card, audio and other are inventory categories; uncategorized legacy items remain supported. Server validation checks these references and coordinates for active and inactive projects. Project snapshots retain layout objects. Removing a placement keeps the source inventory/member record. Layouts remain project-level in this version.

`src/features/layout/layout.js` composes the stage and shared forms; pointer, keyboard and numeric controls use the same domain mutation. Saved workspace revision checks apply to all placements.


## External assistant boundary
ChatGPT is an external MCP client, not an embedded in-app API assistant. OAuth grants bind the account and read/write scope; the same account-private workspace validation and revision service is used by UI and MCP. Shared domain commands create/update shoots, members, inventory and reference metadata, update/create projects, and call camera/layout operations. Proposals stage a candidate snapshot with the current revision; confirmation commits once or returns a conflict. ChatGPT cannot provide an account ID, direct database patch or attachment access token. Details and limitations are in AUTH_AND_SERVER.md.

## Placement rotation and text

Purpose: annotate a project floor plan and adjust object orientation without switching to numeric fields. Select a placement, drag one of its four outside corner handles to rotate, and hold Shift to snap to 45°; Alt+Left/Right rotates by 5°, with Shift by 45°. Cameras retain their existing move/edit flow. Tables, people and text have eight resize handles; people and round tables preserve their aspect ratio. Resize snaps near the original default size using an 8 screen-pixel entry threshold and 12-pixel release threshold. Rotated resizing uses local axes and keeps the opposite world anchor fixed within canvas bounds.

Text is a layout object: its name stores the literal multiline content once, with an optional transparent or six-digit hexadecimal background. The shared layout form and appearance controls add/edit it; the canvas escapes markup and clips visible content to its box without discarding the stored text. Pointer cancellation restores exact values and does not save. Keyboard and numeric alternatives remain available. Coordinates keep internal precision while forms show integers.

Workspace validation covers active and inactive projects, text size/content/background and project-local references. No schema migration, account permission change or destructive link propagation is required. Removing a placement keeps its reusable member/equipment source. Regression fixtures are isolated fictional accounts and temporary databases.


### List/detail workspaces and rental vendors

Administration uses the same left list / right detail pattern for users, equipment, organizations and projects. Existing form nodes stay mounted while selecting items so switching selection preserves drafts and event handlers. Project members put the directory on the left and team management on the right; project equipment selects an owner or organization on the left and confirms usage on the right.

The Data Space workspace (`/dataspace/rental-vendors`, also account-namespaced) stores rental vendor contacts in `rental_vendors`. Reads and writes are scoped to the authenticated account; updates/deletes require the current revision. Vendor records are private account data in permanent deletion. Project rental equipment stores the chosen vendor name as its historical owner-label snapshot and an `isRental` boolean; deleting or renaming a vendor does not rewrite existing project records.

Layout viewport height (280–1200 px) and zoom (40–300%) are browser preferences keyed by account and project. Both top and bottom handles resize the viewport; wheel/pinch gestures zoom about the pointer. Existing pointer geometry converts screen movement through the stage transform so dragging, resizing and rotation remain correct when zoomed.


### Project member selection

The member tab opens a native modal dialog with separate member and organization tabs. Account choices are scoped to an owned project, searchable with a single character, paginated in batches of 50, and contain only public name/username/ID and connection flags. Organization choices retain organization-admin authorization. Selection persists across searches and tabs; existing connections are checked and disabled.

`POST /api/projects/:id/member-selection` validates a workspace revision and all selected active accounts/organization permissions inside one transaction, then creates all membership and organization approvals together. It shares the client workspace mutation queue with team assignment. Repeating an already-applied selection returns the current revision without duplicating records, including after a response is lost. Site administrators and the highest administrator are eligible project members without receiving or transferring any additional site privileges. Owners may add themselves to their roster; their own projects remain excluded from the shared-project sidebar.

## Materials workspace (2026-10-18)

The `자료` workspace groups reference library, equipment overview, contacts and rental vendors. Existing inventory and Data Space URLs remain valid; new account-scoped `/dataspace/references`, `/dataspace/contacts`, and `/dataspace/equipment` routes use the same shell and master/detail pattern. Inventory management, Sheets and loan history remain available from the equipment overview.

Contacts are owner-private records independent from login identities. They contain role, phone, email, notes, an optional explicitly selected account, and separately versioned descriptive `contact_equipment` records. These records describe a collaborator's belongings; they do not transfer inventory custody. Adding a contact to a project retains its identity in `member.contactId`. Explicit account connection grants read-only project membership for that contact's projects; replacing or clearing the account removes only the corresponding generated membership, leaving unrelated invitations intact. The member picker batches accounts, contacts and organizations in one revision-checked transaction. Contact removal archives the directory record, preserving historical project membership and marking descriptive equipment unavailable.

Registered inventory is projected automatically into each eligible project on read/write: the project owner's personal inventory, active project accounts' personal inventory, and explicitly connected organizations' inventory. Canonical names and quantities refresh, while project-specific IDs and `status` confirmations remain stable. Membership removal, organization disconnection and sheet archival revoke availability. Canonical edit, organization custody, loan access and borrowing history permissions are unchanged. Manual equipment connection and per-item personal project-sharing forms are removed. Count view filters across all owners by confirmed, unused or all items.

`reference_library` stores owner-private source records with title, collection, tags, notes, HTTP(S) link, image file references and other supported attachments. Projects reference a library ID; reads resolve current source values without copying blobs. Unlinking removes only a project reference and camera association, while source deletion is rejected until all project links are removed. Shared project members can fetch only files in that project's linked library references; unrelated library records/files remain private, and file responses are not cached. PNG/JPEG/WebP, PDF and MP4/WebM uploads validate signatures, allow 50 MiB per file, and retain the existing 250 MiB account quota.

Startup migration preserves legacy member, equipment, camera and reference IDs and stores pre-migration workspace JSON/revisions in private `material_migration_backups`. Existing roster entries become contacts (account identities can be reused, names alone are never merged). Explicitly member-owned manual project gear becomes descriptive contact equipment, retaining layout and confirmation state. Legacy references become library sources. Migration is idempotent; private material tables and migration backups participate in account deletion, and contact gear cascades from its contact. Unit/integration tests cover migration/restart, ownership isolation, combined selection rollback/replay, account access and linked-file revocation. `tools/qa-materials-browser.mjs` covers actual uploads, contact/account/gear registration, global overview, project selection, confirmations, count filters, reference reuse and mobile width.

### Unified member administration and standalone equipment workspace

The administrator's `사용자 관리` is a single master/detail directory with ordered groups `가입자 / 조직 / 비가입자`. Subscribers come from authenticated account administration; unregistered member records come from the administrator-only contacts endpoint; account-linked contact records are not duplicated in the unregistered list. Existing user protections, revisions, permanent-deletion previews, organization roles and unsaved-input guards remain in their respective editors. Record selection uses one shared search/list and one visible editor; account actions are collapsed by default. Member equipment forms are excluded from this directory.

`/api/admin/contacts` requires current site-administrator authority and may read/update directory records across record owners, preserving the original owner and project association. Changing another owner's account connection additionally requires project-management authority; bounded legacy administrators cannot grant project access through member metadata. The equipment overview shows the full minimal catalog to site administrators, without lending-history or custody permissions. Normal account inventory visibility is unchanged.

Member equipment registration moves to the independent camcorder workspace at `/inventory/members`; overview is `/inventory/equipment`. Inventory management, Sheets, outstanding loans and history retain their URLs and editors. Materials now contains only references and rental vendors. The administrator sidebar has `사용자 관리 / 회원 초대 / 전체 프로젝트` (last subject to capability); organization and equipment sidebar entries are removed. Invitation link controls live exclusively under `/admin/invitations`. Legacy links remain readable. `tools/qa-admin-directory-browser.mjs` exercises grouped administration, record/organization creation, search, separate invitations, equipment registration, workspace separation and mobile width.

Subscriber detail also exposes associated member contact fields without another list entry. It can create or edit the member record through the same guarded editor; connecting an account removes that record from the unregistered group while keeping its role/contact/notes accessible under the subscriber. Site-role actions, like account actions, are collapsed by default and shown only to an authorized highest administrator.

### Representative participation and project deletion

The display label for internal `super_admin` is `대표`; persisted role keys and role security checks are unchanged. `project-representative.js` adds the configured active representative as a real project-account membership and roster entry for existing projects on startup/shared-list refresh and for new projects on workspace writes. IDs are stable, existing invitations are reused, duplicate read-time projections are reconciled, and ordinary saves cannot exclude the representative. Automatic representative rows do not create redundant member-directory records. Shared project visibility follows these memberships; administrative editing remains explicit.

Only the representative can DELETE a managed project, with exact project-name confirmation and workspace revision checks and a repeated live role check after request input. The transaction snapshots the project privately in `deleted_projects`, records the administrator audit event, revokes project account/organization/equipment-sharing links and pending claims, removes project teams, and updates the owner's workspace revision. Reference library sources, uploaded originals, inventory and history are retained. Deleted identifiers cannot be reintroduced through stale or fresh workspace saves. If the final project is removed, an empty placeholder maintains workspace revision continuity without appearing as a project; the next new project replaces it. Placeholder state is empty-only and cannot be forged to hide a real project. Deletion snapshots participate in private account-data cleanup. The browser QA covers the representative label, automatic participation, deletion, empty state and subsequent project creation.

### Equipment workspace navigation

The equipment rail opens member equipment. Its secondary sidebar contains only member equipment and organization equipment. Organization selection and the items/outstanding/history navigation share one horizontal row; organization IDs stay in account-scoped URLs across section changes and reloads. Organization switching preserves the current section and checks inventory drafts before leaving. Member selection uses the same searchable dropdown pattern, with personal inventory registration and Google Sheets controls retained for the current account and descriptive equipment editing retained for directory contacts. Organization items are explicitly excluded from member catalog groups. Catalog entries carry ownership and contact identity; registered members group by their actual account ID, and zero stock stays zero. Checkout/return controls are offered only in organization views; existing stored loan records are retained. Organization history filters issuance scope as well as current item identity so a former personal loan does not become organization history after an ownership conversion. Existing organization membership and inventory editing permissions continue to apply.

Automatic representative memberships in an account's own projects, and generated links to the representative's personal equipment in those projects, are not shared-data deletion blockers. Permanent account deletion removes these generated edges in the same transaction as the private workspace, preserving the representative's account and original equipment. Explicit invitations, other equipment dependencies, organization custody and historical records retain their existing protection. Preview snapshots still include the generated edges, so changes between review and confirmation are rejected. The administrator directory removes the full account record and updates grouped selection after successful deletion.

### Representative account deletion (complete mode)

The representative can permanently delete another account even when it has projects, personal equipment, invitations, role history or shared memberships. The preview identifies this as `deletionMode: complete`; the confirmed operation rechecks live representative authority, target identity and a hash of the account and affected dependency graph inside one SQLite transaction. Unrelated logins do not invalidate the preview. The current representative cannot delete themselves through this entry point. Delegated administrators and self-deletion retain their existing narrower policy.

Complete mode deletes the account's private workspace, files, contacts and their equipment, reference library, rentals, cached migration/deleted-project data, personal equipment, sessions, credentials, Google sheet associations, owned OAuth clients and grants, issued invitations, roles and old account-specific administration logs. Foreign projects retain unrelated material while account membership, private equipment, cameras/layout links and deleted file/reference connections are removed. Organization entities and stock remain independent: administrative custody moves to the representative, surviving approvals remain attached to the organization and membership changes preserve an active owner. Organization loan/return arithmetic remains intact; deleted actor identities are redacted and labelled `삭제된 계정`, with custody foreign keys held by the representative. Deletion receipts contain no target identifier or optional reason. External Google documents and separately retained infrastructure backups are outside application deletion.

## Global equipment model catalog

`equipment_catalog` stores manufacturer, official model name, nickname, category, optional validated PNG/JPEG/WebP bytes (max 2 MB), revision and archived state. It is shared reference data, independent of account inventory. Authenticated users can read; live site administrators manage it. No arbitrary URL fetching or access to private uploaded files is involved. Twelve common models seed a fresh catalog; missing photographs are explicitly shown as missing and may be uploaded by administrators. Catalog photos are intentionally shared reference material and remain when a contributing account is removed.

`equipment_model_links` links canonical equipment IDs to catalog IDs with cascading cleanup when an inventory record is removed. Offline contact equipment stores its optional `catalogModelId` in its existing revisioned body. Project rentals create their own canonical project-scoped record with the same model link. Read-time hydration supplies public catalog metadata/photo URLs; client-supplied model metadata never overrides the canonical model. Stock counts, owners, rental shops, serial numbers and per-project readiness are independent. Photos follow the model's latest revision; names are filled with the nickname on explicit selection and existing names are not rewritten by fuzzy matches.

Global catalog autocomplete matches manufacturer, official name, nickname and limited typo/brand-alias variants, with bounded results and stale-response protection. Selecting a result fills nickname/category/model, persists the catalog ID and previews the photo. Editing the name or category away from a selected model clears the link, and users can unlink explicitly. Manual registration remains supported. Model archival removes it from future searches while preserving existing links/photos. Referenced models cannot change equipment category. No background bulk reclassification of existing equipment occurs.

### Requested model reference pack

`studio-equipment-models.js` contains the supplied models without owner/count fields. `equipment_catalog_seed_entries` maps stable pack keys to model IDs so upgrades can add missing records without duplicating the existing Sony 24–70 GM II or PXW-Z90. Renamed and archived records remain untouched on subsequent startups. Manufacturer/model-unknown SD cards, readers and stands stay explicitly unspecified and have no substituted product photographs. Photographs and camera-specific battery/charger choices remain pending until authoritative product sources can be accessed and compatibility confirmed.
