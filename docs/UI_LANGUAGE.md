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
Use an icon rail for Production and bottom-aligned Settings. The adjacent sidebar lists Projects with configurable icon/color identities. Within-project Home, Schedule, Shoots and other surfaces use horizontal navigation immediately below the header. Project settings and logout live inside Settings. Mobile keeps the rail and opens Projects in a dismissible drawer. Icons are shared original vectors with outline/filled selection states.

The workspace icon rail uses a compact 44px desktop / 42px mobile width. Prefer restrained 11–14px navigation and supporting typography; retain readable headings and 16px mobile form inputs.
