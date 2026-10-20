# Unified Google connection

Settings → 연결 contains one Google card, one connect/reconnect button and one disconnect action. Calendar publication and Tasks list/project selection remain inside expandable sections; Sheets list selection remains in equipment. Home schedule/tasks pages retain content and a plain empty state, without connection buttons, guides or setup links.

Nothing migrates grants merely by loading the page. Existing accounts and project/list/mapping records remain unchanged until explicit user action. The button discloses the union of existing scopes, asks confirmation, then opens Google's consent page. Only the returned scopes are trusted. Fully approved services receive encrypted credentials atomically; services omitted by partial consent retain their previous credentials and selections. The card identifies omissions. An existing connection without recorded scope evidence says permission verification is needed; an approved scope is not proof of actual API synchronization. Provider/API errors remain separate.

The existing web OAuth client and `/oauth/google/callback` are reused. No new callback path, client ID or secret is created. Confirm the existing registration of `https://studio.wonjongyou.com/oauth/google/callback` rather than adding it twice. Google Calendar API, Google Tasks API and Google Sheets API must be enabled for use; this task does not inspect/change Cloud settings. Exact scopes:

- `openid`, `email`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- `https://www.googleapis.com/auth/tasks`
- `https://www.googleapis.com/auth/spreadsheets`

No Drive/general profile or unrelated scope is added; `include_granted_scopes=false`. Actual Google permission choices belong to the user. Google scopes include deletion powers; Studio's selected Calendar/Tasks sync does not propagate deletion.

The unified flow has its own hashed state table and encrypted PKCE verifier, bound to the current user's exact live session. PR50's callback-specific HttpOnly, Secure-in-production, ten-minute SameSite=Lax proof is reused at the existing callback, while the ordinary login cookie remains SameSite=Strict. Legacy Calendar/Tasks/Sheets callbacks remain valid for their own states. New connection/disconnect cancels in-flight callback attempts. Account mismatches fail atomically and preserve old connections. Missing refresh tokens are never substituted from an unverified older service grant; only a recorded matching grant can be reused. No raw tokens, authorization codes, secrets or provider messages are logged or returned in settings.

Disconnect removes local service credentials, not Google grants, items or Studio links/mappings. Existing selections resume if the same Google account reconnects; no mass publish/import is triggered by the callback. Already-issued remote requests can complete before a local stop, so the normal stable-ID/mapping safeguards remain applicable.

Tests use fictional accounts and provider responses. `tests/google-unified.test.js` covers full/partial consent, migration safety, reconnect, mismatch, scope evidence, cancellation and session/expiry/replay boundaries. `tools/qa-google-unified.mjs` checks one card/button, partial/full results and cross-site Chromium cookie behavior at mobile/desktop widths. Legacy callback and service sync suites remain required. CI/GHCR/runtime revision are distinct from live user consent and successful provider synchronization.
