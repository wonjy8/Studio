# All schedules and event editing

All schedules offers only day/week/month views, with period controls left, previous/today/next centered in the entire toolbar, and a three-line source-sidebar button right. List/Year/month-input controls are absent in this view. Old account browser preferences migrate to calendar mode while preserving a valid anchor and supported period. Other calendar surfaces and their APIs remain compatible. Source colors, visibility, pastel contrast and actual all-day/time ordering remain intact.

Clicking an event opens an in-app editor. Native project shoots/tasks reuse existing revision-safe workspace commands; legacy schedule tuples remain supported without duplicating shoot-derived rows. School tasks/events use the private revision-safe School store. Date/time and other unrelated fields stay unchanged unless edited.

Google event detail/update endpoints use only the existing Calendar grant and account connection. The server rechecks calendar access, actual granted write scope, session and connection generation, event identity and current etag. Updates use minimal PATCH fields and If-Match; conflicts/errors retain the user's draft. No access-token/refresh-token reaches the browser. No OAuth grants or live Cloud settings are changed.

Only standard standalone events or explicitly confirmed single recurring instances are editable. Read-only calendars, unknown/missing write grants, recurring masters, locked/special events, attendee-bearing events and Studio-managed published copies show disabled fields with an explanation. Recurring-series editing, attendee notification policy and event-type conversion are deliberately unsupported. Existing recurrence/attendees/attachments are never patched. The request uses sendUpdates=none and does not support attendee-bearing writes.

All-day editing displays an inclusive last date and converts back to Google's exclusive end. Timed editing displays the original event/calendar time zone (including a different end zone), preserves exact original timestamps/seconds on unchanged fields, and resolves changed wall times against IANA zones. Ambiguous/nonexistent daylight-saving times return an actionable validation error rather than choosing an instant silently.

Official references: [Events.patch](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch), [recurring instances](https://developers.google.com/workspace/calendar/api/guides/recurringevents), [conditional modifications](https://developers.google.com/workspace/calendar/api/guides/version-resources).

Testing uses synthetic accounts, temporary databases and mocked Google HTTP only; no real calendars are modified. Browser checks cover aligned320/390/1440 layouts, cancel, read-only denial, single-instance confirmation, etag conflicts, provider failure/retry, exclusive end, exact timestamp preservation, native/School persistence, reload and account isolation.
