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
