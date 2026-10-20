# Google Calendar integration

Each person connects their own Google account explicitly from Home → 내 일정 → Google Calendar 연결. Calendar credentials/states are separate from Sheets and encrypted using the existing Google credential codec/key. Existing Sheets grants and MCP consent are not expanded. This change does not create or provision production credentials, connect a real Google account, or post to a real calendar.

## Google Cloud/user setup

Use the existing web OAuth client; enable Google Calendar API and add the exact `APP_ORIGIN/oauth/google/calendar/callback` redirect URI. The app requests `openid email`, `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.calendarlist.readonly` with explicit consent and offline access. Google may require test-user configuration or verification/publishing for the configured consent screen. Client ID/secret remain in the existing server environment, never in the browser or repository. No new client secret is generated. A missing configuration disables the connect button; API/scopes/expiry errors remain visible and retryable.

These scopes are required to list the user's existing calendars and publish to a selected calendar where that account is owner/writer, including shared church/work calendars. There is no dedicated-calendar creation and no primary-calendar publishing restriction. The read-only home picker can select a readable calendar; it defaults to the user's primary calendar but can be changed.

## Explicit project publication

In Home → 내 일정 → 프로젝트 일정 게시, select an existing writable calendar and a publication start date for each owned Studio project, then choose “선택한 범위 동기화 시작”. The UI warns that viewers of that Google calendar may see the project name, event title and location. Configuration alone makes no immediate API writes; the explicit UI action starts sync, and enabled project links subsequently poll approximately every minute. Dates before the chosen start are not bulk-published. Undated/invalid-time source items are reported as skipped. Source project schedules include shoots and dated tasks using the existing calendar model.

Calendar list roles and actual API authorization are checked by the server. A project link is personal to the connecting Studio user; a shared-project viewer cannot publish another owner's project. Google events are not copied into shared workspace data.

Each source gets a stable Google-compatible ID from a hash of the user, Google subject, project, source type and stable source ID. A mapping claims its target calendar before insertion; response-loss retries reconcile that same event rather than insert a duplicate. App-owned private source markers prevent overwriting a different event. Studio changes patch only app-owned fields, using the remote ETag. Concurrent Studio changes are eventually picked up on the next poll. Request-limit/server failures back off and can be retried manually.

Changing a project target applies to source items that have not yet been published or attempted. Existing/attempted mapped events keep their original calendar and continue to receive Studio changes there. Nothing is moved, copied or deleted automatically. If a previous calendar loses access, an error is shown rather than copying those events to the new target. Likewise, external deletion/cancellation of a previously published event does not recreate it automatically. Unlinking a project, deleting a Studio source or disconnecting Calendar leaves Google events in place. Google edits/deletions are never imported into the Studio project. This is intentional one-way project publication, not two-way external content editing.

## Private home reads

Home's date range is bounded to 93 days and uses the connection's IANA timezone, including DST day boundaries. All-day ends are exclusive; timed events preserve timezone and overnight ranges. `singleEvents=true` expands recurring Google events; cancelled entries are filtered, pagination and response bounds are enforced. Only title, start/end, location, recurrence indicator and a validated Google link are returned. Personal external events are held only in a short-lived, user/generation/calendar/range-scoped memory cache and returned to that user's cookie-authenticated home request; they never enter project workspaces, shared projections or MCP resources.

Disconnect clears only Calendar credentials/states/project links/cache and aborts pending requests; it does not revoke a shared Google OAuth grant that could break Sheets. Already-issued remote requests may have committed before an abort; stable mappings prevent a blind duplicate retry. Token refresh, callback ownership/session, grant generation, active account and current link status are rechecked after awaits.

## Verification

`node --test tests/google-calendar.test.js` uses fictional accounts and a mock Google API, not operational calendars. It covers explicit OAuth scopes/session binding/replay, encrypted independent credentials, calendar ACLs and cross-account isolation, selected date bounds, idempotency, uncertain insert retry, target changes, external deletion, scope loss, disconnect/expiry, all-day/overnight/DST conversion and private recurring reads. Run `npm test` and `npm run check` as well. Deployment/CI success is distinct from real Google Cloud setup, consent and successful live synchronization.

Official contract: [Calendar OAuth scopes](https://developers.google.com/workspace/calendar/api/auth), [event insertion and stable IDs](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [recurring event list expansion](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).
