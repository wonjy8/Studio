# Studio Features

Every feature follows `PRODUCT.md`, `UI_LANGUAGE.md`, `ARCHITECTURE.md`, and `SECURITY.md`.

## Overview / readiness
**Why:** the production owner needs to see readiness before navigating management screens.
**Flow:** Home → readiness stats → warnings → schedule/Shoot.
**Data:** Shoot readiness + equipment readiness.
**UX:** status uses text and color; warnings are actionable.

## Schedule
**Why:** time is the primary operational axis on shoot day.
**Flow:** Schedule → Shoot row → Shoot context.
**Data:** schedule item links to Shoot by ID.
**UX:** script/location/readiness appear without leaving the row.

## Shoot detail
**Why:** production information should converge around the shooting unit.
**Flow:** Shoot → contextual detail → camera/reference/script.
**Data:** Shoot links rather than duplicating people/equipment/reference data.

## Script
**Why:** crews need the approved source document, not another editor.
**Flow:** Shoot → script status/preview → original file.
**Privacy:** runtime files only; never repository assets.
**Current demo:** script registration state is implemented. PDF originals and private preview are available through the authenticated NAS backend.

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

## NAS persistence
The authenticated server stores account-isolated project state and attachments in the private NAS SQLite volume. Writes use revision checks. The browser demo is no longer the deployed persistence layer. See AUTH_AND_SERVER.md and NAS_DEPLOYMENT.md.

## Login presentation
**Why:** provide a calm, readable entry to a private production workspace.
**Flow:** username and password → submit with loading/error feedback → existing Project.
**Reuse:** shared color/shape tokens, field and button primitives; dedicated login page composition outside app.js.
**UX:** white background, centered single-column form, mobile sizing, visible keyboard focus, optional password visibility, administrator help.
**Privacy:** no external images/fonts, account discovery, or credential persistence in frontend storage.

## Production navigation and multiple projects
**Why:** keep project selection separate from within-project work.
**Flow:** production rail → project list → project tabs below the header. Settings and logout are reached from the rail's bottom Settings action.
**Data:** account-private workspace retains the active Project and a list of inactive Project snapshots. Legacy single-project data is preserved on first use. Switching projects retains each Shoot, schedule, file link, member, equipment and reference set.
**Reuse:** original vector icon primitive, navigation pattern, project identity form, shell and settings page. Projects select from six icons and six semantic identity colors.
**UX:** two-column desktop sidebar, persistent workspace rail, mobile project drawer, scrolling project tabs, visible focus and selected state.
**Privacy:** every attachment across active and inactive projects is validated for account ownership. No screenshots or user project names are fixtures.

## Invitation-only signup
**Why:** let the owner onboard members without opening public registration.
**Flow:** administrator Settings → create/copy a 48-hour single-use link → recipient chooses a username/password → login. Administrators can list invitation status and cancel unused links.
**Reuse:** existing login fields/button styles, separate signup page/controller and invitation feature module.
**Privacy:** only the first owner's account is administrator; invitees retain private account workspaces. Tokens are hashed server-side, not stored in browser storage, and never committed.
