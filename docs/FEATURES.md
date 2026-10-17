# Studio Features

Every feature follows `PRODUCT.md`, `UI_LANGUAGE.md`, `ARCHITECTURE.md`, and `SECURITY.md`.

## Overview / readiness
**Why:** the production owner needs to see readiness before navigating management screens.
**Flow:** Home → readiness stats → warnings → schedule/content.
**Data:** content readiness + equipment readiness.
**UX:** status uses text and color; warnings are actionable.

## Schedule
**Why:** time is the primary operational axis on shoot day.
**Flow:** Schedule → content row → content context.
**Data:** schedule item links to content by ID.
**UX:** script/location/readiness appear without leaving the row.

## Content detail
**Why:** production information should converge around the shooting unit.
**Flow:** content → contextual detail → camera/reference/script.
**Data:** content links rather than duplicating people/equipment/reference data.

## Script
**Why:** crews need the approved source document, not another editor.
**Flow:** content → script status/preview → original file.
**Privacy:** runtime files only; never repository assets.
**Current demo:** script registration state is implemented. Private file storage/preview requires a runtime storage backend and is intentionally not faked in the public static demo.

## Camera ↔ Reference
**Why:** an operator should understand the intended frame immediately.
**Flow:** Camera Layout → camera → linked reference groups.
**Data:** camera stores reference group IDs.
**UX:** references are visual-first and reachable directly from camera context.

## Members ↔ Equipment
**Why:** ownership and day-of responsibility are different facts.
**Data:** equipment has `owner` and `assignee` independently.
**UX:** member views show day-of equipment responsibility while equipment views show both roles.

## Shoot Mode
**Why:** management UI is too dense for active shooting.
**Flow:** NOW → script/reference → complete → NEXT.
**UX:** mobile-first, large actions, minimal metadata.

## AI & Integrations
**Why:** natural language can help with cross-feature operations and production checks.
**Privacy:** disconnected by default; credentials never live in public source or frontend fixtures.
**Current demo:** secure settings boundary is implemented; actual provider authentication is deferred until a backend/provider-supported authorization path is selected and reviewed.

## Demo persistence
The public demo stores synthetic/local user edits in browser `localStorage`. It does not upload them to GitHub. This is a prototype persistence layer, not the final multi-user data architecture.
