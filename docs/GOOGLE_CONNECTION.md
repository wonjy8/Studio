# Unified Google connection

Settings → 연결 contains one Google provider row with a logo, title/status, right-aligned [+] connect/reconnect action and a disconnect action in its expandable management section. Calendar publication and Tasks list/project selection remain inside expandable sections; Sheets list selection remains in equipment. Home schedule/tasks pages retain content and a plain empty state, without connection buttons, guides or setup links.

Nothing migrates grants merely by loading the page. Existing accounts and project/list/mapping records remain unchanged until explicit user action. The button discloses the union of existing scopes, asks confirmation, then opens Google's consent page. Only the returned scopes are trusted. Fully approved services receive encrypted credentials atomically; services omitted by partial consent retain their previous credentials and selections. The row identifies omissions. An existing connection without recorded scope evidence says permission verification is needed; an approved scope is not proof of actual API synchronization. Provider/API errors remain separate.

The existing web OAuth client and `/oauth/google/callback` are reused. No new callback path, client ID or secret is created. Confirm the existing registration of `https://studio.wonjongyou.com/oauth/google/callback` rather than adding it twice. Google Calendar API, Google Tasks API and Google Sheets API must be enabled for use; this task does not inspect/change Cloud settings. Exact scopes:

- `openid`, `email`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- `https://www.googleapis.com/auth/tasks`
- `https://www.googleapis.com/auth/spreadsheets`

No Drive/general profile or unrelated scope is added; `include_granted_scopes=false`. Actual Google permission choices belong to the user. Google scopes include deletion powers; Studio's selected Calendar/Tasks sync does not propagate deletion.

The unified flow has its own hashed state table and encrypted PKCE verifier, bound to the current user's exact live session. PR50's callback-specific HttpOnly, Secure-in-production, ten-minute SameSite=Lax proof is reused at the existing callback, while the ordinary login cookie remains SameSite=Strict. Legacy Calendar/Tasks/Sheets callbacks remain valid for their own states. New connection/disconnect cancels in-flight callback attempts. Account mismatches fail atomically and preserve old connections. Missing refresh tokens are never substituted from an unverified older service grant; only a recorded matching grant can be reused. No raw tokens, authorization codes, secrets or provider messages are logged or returned in settings.

Disconnect removes local service credentials, not Google grants, items or Studio links/mappings. Existing selections resume if the same Google account reconnects; no mass publish/import is triggered by the callback. Already-issued remote requests can complete before a local stop, so the normal stable-ID/mapping safeguards remain applicable.

Tests use fictional accounts and provider responses. `tests/google-unified.test.js` covers full/partial consent, migration safety, reconnect, mismatch, scope evidence, cancellation and session/expiry/replay boundaries. `tools/qa-google-unified.mjs` checks one provider row/button, partial/full results and cross-site Chromium cookie behavior at mobile/desktop widths. Legacy callback and service sync suites remain required. CI/GHCR/runtime revision are distinct from live user consent and successful provider synchronization.

## Optional Docs and Forms read connections

Settings → Connections also offers separate Docs and Forms provider rows with their own [+] action and expandable management controls. The existing Calendar/Tasks/Sheets button keeps its existing scopes. These connections request only `openid email` plus, respectively, `https://www.googleapis.com/auth/documents.readonly` or `https://www.googleapis.com/auth/forms.body.readonly`. They reuse the existing web OAuth client, encrypted credentials, PKCE, exact-session binding and callback return proof at `/oauth/google/callback`. Each user must consent; loading settings never expands grants. Missing consent, cancellation, stale callbacks and errors preserve previous credentials and unrelated services. Disconnect deletes only the selected service's local credentials without revoking a shared Google grant.

These scopes authorize reading accessible documents or form definitions broadly; they are not restricted to the single URL entered. Initially Studio only verifies a user-entered editable URL or ID with a metadata-only `documents.get` / `forms.get` field mask and returns its title. There is no file listing, editor, Drive scope, survey response scope, or response API call. Published Forms responder URLs (`/d/e/...`) cannot be used as form IDs. IDs are validated and provider hosts are fixed server-side.

The OAuth client's Cloud project must have Google Docs API / Google Forms API enabled and its consent configuration must permit these scopes. That setup is a separate administrator action; code deployment does not enable APIs or change live security settings. API-disabled and file-access failures are distinct from revoked/expired credentials requiring reconnection. External apps in Google OAuth testing mode may receive refresh tokens expiring after seven days.

Official references: [Docs authorization](https://developers.google.com/workspace/docs/api/auth), [Forms get](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/get), [Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth). Future listing/Picker support requires a separate scope decision; `drive.file` includes write/delete capabilities and must not be described as read-only.

`tests/google-read.test.js` verifies minimal grants, encryption, URL validation, partial consent, cancellation, stale sessions, disabled APIs, refresh expiration and disconnect races. `tools/qa-workspace-calendar-google-read.mjs` exercises fictional cross-site consent and verification at desktop and mobile sizes. No operational accounts, documents, forms or calendars are used.

The current logo/title/[+] presentation is covered by `tools/qa-connection-service-rows.mjs`: light/dark 320/390/768/1440px, failed status reads and retry, cancelled/repeated/busy connection attempts, partial grants, visible provider errors, independent Docs verification/disconnect, and ChatGPT disclosure/failure/success/focus. Provider responses and account state are fictional; no live credentials are used.
