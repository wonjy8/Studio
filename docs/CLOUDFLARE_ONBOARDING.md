# Isolated Google onboarding and document milestone

This candidate is stacked on the Cloudflare foundation and Google identity branches. It does not change the Node/NAS entrypoint, publish an image, configure a Worker, or migrate accounts. Keep these PRs unmerged while NAS publication is held.

The Worker serves a self-hosted Korean login/setup interface. Google login, explicit new registration, partial required consent, retry, same-account reconnect, account-switch confirmation and local disconnect call the actual isolated identity API. Browser callback handoff uses a fixed relative location, secure cookies and no code/token in redirect parameters. Legacy NAS account linking remains disabled.

When setup is ready, users can create a plain paragraph document, save it using revision-checked D1 storage, and reopen it. Existing document IDs, blocks, formatting runs and comments are preserved; this first UI treats non-plain blocks as read-only rather than flattening them. Save failures retain the draft; conflicts require deliberate server reload. This is a milestone interface, not the completed Studio workspace port.

Document JSON resides in D1. **Drive original-file attachment storage is not implemented by this candidate.** No file upload button or false Drive-save success is shown. Original Studio document schema and account/session/setup checks remain in force.

## Configuration preparation; do not execute without approval

Suggested separate deployment identifiers are `studio-edge` for the Worker and `studio-edge-db` for D1. These are proposals, not resources that exist. An operator must first confirm the Cloudflare account and environment, D1 binding and migration execution plan. No account ID or real database ID is committed.

The production origin remains the previously selected service origin. Register the exact OAuth callback as `<APP_ORIGIN>/oauth/google/callback`; the path is fixed. Do not change current DNS/Worker routes before a separately approved cutover. The public `APP_ORIGIN`, Google client ID and revision are environment configuration; Google client secret and a random 32-byte base64url `GOOGLE_TOKEN_KEY` belong in Worker secret bindings through the Cloudflare dashboard or approved secret CLI input, never repository files or command-line literal values. Key replacement invalidates existing encrypted credentials and requires an explicit recovery plan.

The current required scopes are `openid`, `https://www.googleapis.com/auth/drive.file`, `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.calendarlist.readonly`. Google client configuration must enable the relevant APIs and an approved consent/test-user or publishing configuration. `drive.file` does not grant arbitrary access to all Drive files. A later administrator bootstrap must additionally verify the signed, verified Google email and stable subject against an explicitly approved environment target; no bootstrap target or role is configured here.

No paid service or cloud resource has been provisioned. Actual plan eligibility, quotas, OAuth publishing/verification requirements and charges must be checked against the selected account before activation; this code does not promise a free production tier.

Remaining first-milestone work: Drive original-file API and safe D1/Drive consistency, reviewed administrator bootstrap, approved environment activation, then real consent and document save/reopen integration checks. Remaining Studio APIs/workspaces are still explicitly unported.
