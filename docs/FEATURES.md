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
**Current scope:** the in-app GPT/AI integration and its settings entry are removed at the user’s request. External ChatGPT access is a separate account-authorized integration, not a server-side OpenAI API chat feature.

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
**Flow:** administrator Settings → choose a 12/24/48-hour window and positive integer/unlimited capacity, then create/copy a link → recipient chooses a username/password → login. Administrators can list invitation status and cancel available links.
**Reuse:** existing login fields/button styles, separate signup page/controller and invitation feature module.
**Privacy:** only the first owner's account is administrator; invitees retain private account workspaces. Tokens are hashed server-side, not stored in browser storage, and never committed.

## Typography and scene layout
**Why:** consistent type roles make production information easier to scan; a camera plan needs people, furniture, stage and equipment context.
**Flow:** Camera → add camera or placement → drag or edit coordinates → save; Equipment → select category → reuse that item in the layout.
**Data:** camera setups link to equipment by ID; other placements link optionally to a member or equipment, with independent position/rotation. Existing camera setups gain a linked camera equipment record on load without dropping old fields. People/furniture/stage are layout objects, not equipment inventory. Camera, lighting, tripod and SD card are equipment categories.
**Reuse:** shared typography tokens, layout domain operations and layout feature composition; existing form/button primitives.
**UX:** fixed type roles, visible object type labels, keyboard arrows and numeric position controls as alternatives to dragging. Layout coordinates are percentages; changes persist per project.
**Privacy:** layout data stays inside the existing authenticated workspace and revision/ownership boundaries. Fixtures are fictional. This release keeps the existing project-level layout; per-Shoot plans are future work.

## Configurable invitations and connected assistants
**Why:** invite groups with a suitable signup window and work on production data through natural language without bypassing ownership or validation.
**Flow:** owner chooses 12/24/48 hours and one-or-more/unlimited signups; each successful atomic signup consumes capacity. Existing links remain single-use. ChatGPT connects through a private MCP endpoint with account consent and scoped, revocable OAuth credentials.
**Data:** account-private workspaces, revision checks and shared domain commands; AI never supplies authoritative account IDs or raw database operations. External content is data, not instructions. Changes target a selected project, report impact, and preserve unrelated projects/files.
**Reuse:** common command service for external tools, existing account/session and settings controls. No third-party frontend scripts or provider keys in browser storage.
**Privacy:** users explicitly authorize an external ChatGPT connection before selected workspace data is accessible; tokens are hashed and revocable. ChatGPT connection registration is an external prerequisite, not implied by a successful local test.

## Manual OAuth client setup
**Why:** provide a supported alternative when app creation stops before dynamic client registration.
**Flow:** administrator creates a confidential client in Studio, copies the one-time ID/secret into the external app's manual OAuth configuration, then signs in and consents normally. Callback URLs are exact registered HTTPS ChatGPT URLs. Client registration does not grant account/data access.
**Privacy:** client secrets are shown once, stored only as hashes, and never placed in diagnostics, URLs, browser storage or chat. Administrators can revoke a manual client and its existing grants. This alternative does not establish the cause of platform-side app rejection or guarantee that it will resolve it.
