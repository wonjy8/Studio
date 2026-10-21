# Google Calendar content contract

This describes the supported data paths, not the current state of an individual Google account.

| Direction / field | Supported behavior |
| --- | --- |
| Google → Home personal schedule | Read-only range query under the signed-in owner's existing grant; never import into a shared project |
| All-day dates | Keep `start.date` and Google's exclusive `end.date`; display the final included date |
| Timed events | Read RFC3339 offsets; resolve offset-less times with explicit IANA timezone rather than the NAS timezone; display start and end in the connection timezone |
| Recurrence | Request `singleEvents=true` so Google expands series and exceptions into instances; preserve each instance ID and recurring indicator; omit cancelled instances |
| Pagination | Follow bounded next-page tokens; deduplicate by `(calendarId,eventId)`, with later pages replacing earlier copies/tombstones |
| Incremental sync | Not used: each requested date range is a bounded complete read; there is no `syncToken` database or bidirectional change feed |
| Studio → Google | Explicit per-project publication to an existing writable calendar and start date; shoots and dated tasks become individual events |
| Studio all-day source | A date without a clock becomes one all-day event ending the following date |
| Studio time | `HH:mm`, or start/end separated by `–`, `—`, `~`, `-`; a single clock defaults to one hour; earlier end clocks are overnight. Invalid clocks (including `24:00`) are skipped with a reason |
| Timezone / DST | Use the connection IANA timezone; range boundaries respect 23/25-hour days. Do not publish a nonexistent or ambiguous DST wall time without a unique instant |
| Publication identity | Stable event ID from account, Google subject, project, source type and source ID; source hash/ETag checks protect unrelated Google events and retry idempotency |
| Changing target calendar | Previously published/attempted events retain their recorded target; only new sources use the new target |
| Update | Update the matching previously published source event; no matching by title, iCalUID or recurring-series ID |
| Delete / complete / cancel | Studio deletion/completion does not delete or cancel Google events. A Google-deleted/cancelled published event is not automatically recreated |
| Unsupported transfer | No Studio recurrence-rule authoring, attendee/organizer management, reminders, conference links, attachments or free/busy import. These are not copied or synchronized; Google remains the editor for its private events |

## Provider failures are separate from event format

A 403 alone does not identify its cause. Calendar errors retain a bounded code,
HTTP status, request phase and allowlisted provider reason. Raw provider messages,
consumer/project metadata, URLs, credentials and event content are never logged
or placed in diagnostics. Existing approved scope records are distinguished from
the latest token response; neither is presented as a successful live API read.

- `API_DISABLED`: verify Google Calendar API activation in the project owning the existing Studio OAuth client. No reconnect can activate an API.
- `SCOPE_INSUFFICIENT`: review the existing grant's Calendar list/event scopes; do not change the OAuth client or request broader unrelated scopes.
- `TOKEN_REVOKED`: Google rejected refresh of this grant; only this explicit result warrants reapproval guidance.
- `RATE_LIMITED`: wait and retry, retaining the connection.
- `CALENDAR_FORBIDDEN` / `CALENDAR_NOT_FOUND`: review that calendar's access. An aggregate read may show other calendars with an explicit partial warning.
- Unknown 403: show `PROVIDER_FORBIDDEN` rather than asserting that consent is missing.

One early access-token 401 retries after refreshing the existing grant once.
Refresh calls share an in-flight promise, and connection generation/session
checks still prevent stale responses from authorizing another connection.
Personal-read errors and project-publication errors are displayed separately.
