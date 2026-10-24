# Google read-account connections

## Implemented boundary

Docs and Forms support up to 10 real OAuth account connections **per Studio user and service**. The current operation is account-selected URL/ID metadata verification, not Drive listing, editing or Forms response access. Calendar, Tasks and Sheets support account-bound synchronization as detailed below. ChatGPT's existing grant/session model is unchanged and does not supply an external ChatGPT account name.

The detail UI uses compact account rows, a clear Add account action, per-account reconnect/disconnect and file verification, visible broad-read consent wording, and collapsed secondary setup help. Product marks use the existing verified official assets. Reference layout concepts are adapted to Studio's 16px phone gutter, 36/44px controls and theme tokens; no reference user's account identity or unsupported feature list is copied.

## Storage and default preservation

- Existing `google_read_accounts` primary rows and encrypted credential bytes are retained. Their public IDs are stable scoped hashes of owner/service/Google subject. Email is display metadata; duplicate detection uses the verified Google subject.
- `google_read_additional_accounts` stores separately encrypted grants with stable account IDs, unique owner/service/subject, generation and an actual creation time. Public status returns IDs/email/attention/primary/date only, never subject, credentials, token or generation.
- Add does not change the existing default, even if that default is disconnected while Add is in flight. Removing a default never promotes an additional account implicitly. An old account-less verification call fails when no legacy default exists; the UI always selects an explicit ID.
- `google_read_account_states` separately binds Add/reconnect mode, selected account generation and revocation fence to the existing PKCE/session-bound state. The original six-column `google_read_states` schema remains compatible with older images.
- `google_read_account_epochs` and `google_read_account_revocations` prevent a delayed Add/reconnect from resurrecting the same just-disconnected identity while allowing an unrelated account to complete. Commit rechecks occur inside an immediate SQLite transaction.
- Refresh is coalesced by owner/service/account/generation and rechecked after provider responses. A revoked secondary grant does not mark the primary or another service revoked.

## Versioned account routes

All require the existing live browser session and owner binding. Unknown/foreign IDs fail without provider access; IDs never fall back to the default.

- `GET /api/google/read/{docs|forms}/accounts`: `version: read-accounts-v1` plus account summaries/configuration.
- `POST .../accounts/connect`: explicit `approveScopes: true, mode: add`.
- `POST .../accounts/{id}/connect`: explicit reconnect of that identity; choosing another Google subject is rejected.
- `POST .../accounts/{id}/verify`: selected account plus validated file ID.
- `POST .../accounts/{id}/disconnect`: selected account/service only; files and other connections remain intact. No provider-wide revoke.

Legacy primary routes remain available for the previous UI. The new UI requires the new status version and paths, so an older server returns an error instead of silently ignoring an account ID and reading through another account. New `read2-{service}-` states also fail safely on older images. The canonical callback remains `/oauth/google/callback`; no OAuth client, redirect registration, production scope or secret configuration is changed.

Add requests use the existing exact read scope with `prompt=consent select_account`, PKCE S256, one-use return proof and live session checks. Google's [web-server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server) specifies space-delimited consent/account-selection prompts. Login and explicit consent remain user actions. Development and QA use synthetic providers/accounts only.

## Retention and rollback

All four additive tables are reviewed private user data in existing account-deletion preview/purge. Existing authority, confirmation and protected-account checks remain intact. Whole SQLite/data-volume backups naturally include the tables; grants remain encrypted under the existing persistent key. User-facing workspace JSON is not a credential export. Back up/restore the complete private data volume as described in NAS_DEPLOYMENT.md; no production backup or NAS operation is performed by this change.

No legacy columns or credentials are rewritten. Tests verify old six-value state inserts still work and encrypted additive account rows survive a whole-database snapshot. Reverting the image makes new account routes unavailable; it does not switch to a different account or remove stored additional grants. As before, keep the persistent data/key volume intact.

## Validation

`tests/google-read.test.js` covers existing legacy behavior, A/B account addition, duplicate identity, explicit source reads, cross-user rejection, wrong-subject reconnect, Forms parity, 10-account bound, scoped refresh/revocation, delayed Add/reconnect vs disconnect, absent-default behavior, user purge and encrypted backup compatibility.

`tools/qa-multiple-read-accounts.mjs` runs actual local app routes through a synthetic cross-site Google consent provider: PKCE/return proof, add/reconnect/wrong identity/cancel/browser return, primary preservation, per-account verification/disconnect, Forms parity, status failure/retry, compact light/dark 320/390/1440 layout and focus. No real grant or persistent user credential is created.

## Calendar, Tasks and Sheets

Calendar, Tasks and Sheets also support up to ten account grants per Studio owner/service. Settings → Connections → each app shows compact account rows with Add account, reconnect, disconnect and explicit “Use this account”. Calendar source and new Sheets connection screens expose an account picker. Choices are scoped to the signed-in Studio account. Each mounted view captures its account before requests; changing selection cannot retarget an in-flight operation. Existing primary Calendar source preferences retain their IDs; secondary source IDs and preferences include the account identity. Calendar cache identities already include session, subject and generation.

New versioned routes use `/api/google/accounts/{calendar|tasks|sheets}` and `/{accountId}/{action}`. Additional accounts request only that app's existing scopes through the existing callback/PKCE/one-use return proof; credentials stay encrypted. No real grant, OAuth client, production scope or configuration is created by development/QA. Existing primary shared-calendar creation/ACL consent remains available; additional accounts receive the existing normal Calendar event/list scopes and do not silently gain calendar creation/ACL permissions.

`google_sync_accounts`, `google_sync_states`, `google_sync_epochs` and `google_sync_bindings` are additive. Legacy credentials and table column layouts remain intact. A binding uses the original Studio owner, service, resource and verified Google subject. Projects cannot be silently moved to another account. An organization manager's existing Sheets sync follows the original link creator's grant, regardless of the manager's own selected account; private Google email/account IDs are omitted for other managers. Resource-bound inventory sync/unlink uses the existing resource route, while new connection creation explicitly selects an account. Account-scoped routes reject other accounts' links.

Secondary active configurations live in `google_sync_calendar_projects`, `google_sync_tasks_projects` and `google_sync_sheet_links`. **They never enter old worker-visible active configuration tables**, so rolling back to an older image cannot execute them through the legacy default grant. Mappings retain existing subject keys. Workspace/Home settings also retain their original subject checks; additional Calendar shared provisioning is unavailable without a separately reviewed scope decision. Existing primary configuration is pinned at migration. A legacy config with no recoverable owner identity is fenced as unresolved rather than assigned to a new account; it needs an explicit owner/source recovery decision. No production data is changed to resolve such ambiguity automatically.

Account disconnect is local to the selected app/account: no Google `/revoke`, no deletion of other accounts, remote files/events/tasks, or source mappings. Calendar/Tasks project activation is paused for that account while target details survive. Reconnect never promotes an additional account to default or moves existing targets. Legacy connect callbacks also reject replacing the original primary identity recorded in surviving configurations. Pending Sheets outboxes and baselines survive disconnect and remain bound to their original account. All additive tables follow the existing confirmed user-deletion policy and private volume backup; rollback leaves additional grants dormant and encrypted.

Validation: `tests/google-sync-accounts.test.js` covers actual synthetic OAuth/PKCE, defaults, duplicates/wrong identity, owner/service isolation, same-ID A/B reads and Tasks completion, account-bound Calendar workers, shadow rollback visibility, old schema inserts, failed-setup rollback, organization ownership/privacy, account-specific disconnect and gated simultaneous primary/secondary Sheets creation. `tools/qa-multiple-sync-accounts.mjs` covers actual Chromium cross-site synthetic consent, explicit selection, cancellation, disconnect and 320/390/1440 light/dark layouts. Existing service regression tests remain required.
