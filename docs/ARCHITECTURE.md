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

AI is optional and disconnected by default. The app exposes a provider-neutral integration boundary. A user connects a supported provider from Settings at runtime.

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
`src/domain/layout.js` owns layout mutations and shared equipment categories. Camera setups reference `gearId` in the project's inventory (category `camera`); new setups may reuse an existing camera or register one. Legacy setups are linked during project preparation, idempotently. The existing camera body field is retained for compatibility.

Optional `layoutObjects` supports person/table/chair/stage/equipment/other, percentage x/y and rotation. Equipment placements require a valid project-local `gearId`; people may link a project-local `memberId`. Other objects are spatial context, not inventory. Camera, lens, lighting, tripod, SD card, audio and other are inventory categories; uncategorized legacy items remain supported. Server validation checks these references and coordinates for active and inactive projects. Project snapshots retain layout objects. Removing a placement keeps the source inventory/member record. Layouts remain project-level in this version.

`src/features/layout/layout.js` composes the stage and shared forms; pointer, keyboard and numeric controls use the same domain mutation. Saved workspace revision checks apply to all placements.
