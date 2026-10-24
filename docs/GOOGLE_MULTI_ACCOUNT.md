# Google read-account connections

## Implemented boundary

Docs and Forms support up to 10 real OAuth account connections **per Studio user and service**. The current operation is account-selected URL/ID metadata verification, not Drive listing, editing or Forms response access. Calendar, Tasks and Sheets still use their existing shared/synchronizing account model; this change does not advertise or implement additional accounts for those services. ChatGPT's existing grant/session model is unchanged and does not supply an external ChatGPT account name.

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
