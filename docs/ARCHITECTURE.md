# Studio Architecture

## Information architecture

```text
Workspace
└── Production
    ├── Home / Overview
    ├── Schedule
    ├── Content
    ├── Camera Layout
    ├── References
    ├── Members
    ├── Equipment
    └── Budget (later)
```

## Domain relationships

```text
Production
├── ScheduleItem ──> Content
├── Content
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

A `ReferenceGroup` is a reusable visual target such as bust shot, two-shot, wide, or side. It contains ordered images and optional notes. Cameras and content can link to one or more groups.

A reference group is not a required shot list.

## Camera model

A camera position links body, lens, operator, equipment, and visual references for a content item. Camera layout is content-aware because the same room can use different setups for different content.

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
  productions + scripts + images + people + equipment + files

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
