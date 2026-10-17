# Login and private NAS runtime

## Rationale and first release boundary

A crew member must be able to return to the same Project and Shoots from another browser without putting private data in public source. This first release provides NAS-provisioned local accounts, multiple private projects per account, schedule/shoot/member/equipment/camera/reference state, PDF script preview and original download, and private reference images. Public signup, shared workspaces, OAuth and AI credentials are deferred. Administrators can invite new members through single-use registration links. A new account starts empty. Existing browser demo edits are never silently imported.

## User flow and reusable modules

Login → project settings → add Shoots and schedule → attach PDF scripts / reference images → changes persist on NAS → logout. The existing visual shell is retained. `src/app/session.js` owns login, `src/integrations/api.js` owns transport and revision handling, and `src/domain/workspace.js` owns the shared validation contract. `server/auth.js`, `server/store.js`, and `server/index.js` isolate passwords, database access, and HTTP routing. Further page extraction should follow ARCHITECTURE.md; new infrastructure does not belong in app.js.

The legacy `contents` storage key is an internal compatibility name for Shoot. User-facing language is Project → Shoot. Cameras and reference groups remain reusable entities. Scripts retain original PDF bytes and are linked by file ID. This first version supports PDF source documents; other document formats need a separate safe conversion boundary.

## Security

Passwords use asynchronously derived scrypt hashes with random salts. Account provisioning/reset runs inside the NAS container, receives a password on stdin, and invalidates that user's sessions. No bootstrap endpoint or public registration exists. Invitation-based registration is described below. Sessions contain 256 random bits; only SHA-256 token digests are stored. Cookies are Secure, HttpOnly, SameSite=Strict and expire after 12 hours. Mutating requests require the configured exact Origin. Login has account/global budgets and a concurrent hashing limit without trusting forwarded IP headers.

Every data/file query checks the authenticated account. Workspace writes validate structure, safe identifiers, references and ownership; revisions prevent silent overwrites from two tabs. Private bytes live in SQLite, never a public static directory. Files are limited to 10 MiB each, 250 MiB per account, and signature-checked PDF/PNG/JPEG/WebP. SVG/HTML are refused. File responses are sandboxed with nosniff; downloads preserve the original. CSP blocks inline scripts. No request bodies, passwords or filenames are logged.

The server explicitly serves only index.html and src JS/CSS. It never serves repository configuration, runtime databases or server source. SQLite WAL storage is in a named NAS volume. The container runs as an unprivileged user with a read-only root filesystem, dropped capabilities, no published host port, and access through the existing cloudflared network.

## Operational limits

This is a small trusted-team deployment, not a general public hosting service. Login budgets are process-local and reset on restart. Storage uses synchronous SQLite operations with bounded payloads. Files replaced in the UI remain in storage; deleting unused attachments and quota management UI are future work. Account workspaces are isolated, not collaborative. Project snapshots stay in the same private account workspace and share its revision check and quota. Older single-project data is retained without destructive database migrations. An old application image can display only the active project and may reject saving the newer multi-project payload; roll forward to this version to resume editing. Backups are required; the app does not encrypt the NAS disk. NAS administrators control the runtime database. See NAS_DEPLOYMENT.md for deployment and verification.

## Administrator and invitation registration
The first successful login becomes the site administrator. On upgrade, the earliest retained session identifies that owner; if no sessions remain, the first provisioned account is used. The selected account ID is stored once in private `site_settings` and cannot be changed by signup payloads. CLI-provisioned accounts do not automatically gain administrator status.

Settings exposes invitation creation/list/revocation only to the administrator. Each link contains 256 random bits, expires after 48 hours, and permits one new account. Only a hash of its token is stored. The raw link is shown once and uses a URL fragment, which the browser removes before submission; it does not enter server request URLs or referrers. The administrator shares links directly; Studio does not send email. A maximum of 20 active invitations bounds invitation creation.

Signup checks exact Origin, token validity, password policy, username format and case-insensitive uniqueness. Consumption and user creation are committed in one transaction after hashing, with a second expiry/revocation check so concurrent signup or revocation cannot reuse a link. Rate/concurrency budgets bound password hashing. Signup never assigns administrator privileges or shares the administrator's projects. Registration requires a signed-out browser (or a private window), avoiding confusion with an existing account session. The new user signs in separately and receives an empty private workspace. Revoking an unused invitation does not delete an account that already joined.
