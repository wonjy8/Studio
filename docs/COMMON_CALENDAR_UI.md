# Shared calendar surfaces

Home, School (including course schedules) and project schedule pages bind the same calendar controller. Source display choices remain account-owned and stable-ID keyed. The current School/course or project source is listed first; Google sources with no prior preference begin hidden. Existing explicit visibility choices remain intact. Hiding a source never disables publication.

Home and School publication targets are selected at the bottom of the right source panel. Project targets and shared-calendar review are in that project's settings. The select lists connected-account calendars, marks read-only destinations unavailable and ends with “연결 안 함”. Selecting no connection pauses publication; it does not disconnect OAuth, delete calendars/events or relocate existing mappings. Initial/reconnected destinations ask whether to include existing unmapped sources. The server snapshots the publication-link state before reserving source identities so disconnected-era sources cannot bypass a new-only choice. Existing mappings retain original destinations.

The sidebar toggle remains in the toolbar when opened; the panel starts below it and has no duplicate X. Mobile and keyboard can use the same toggle. Left workspace-settings entries are removed. The generic sidebar-navigation-to-page rule remains; calendar controls are part of calendar pages rather than a new standalone workspace-settings page.

No production calendars, invitations, credentials or grants are created by deployment or QA. Tests use isolated accounts and mock Google. The current linked-project member model remains read-only.

Korean public holiday integration is still pending a verified data source. This candidate does not invent lunar/substitute/temporary holidays or classify arbitrary all-day events as public holidays. Existing explicitly configured holiday sources remain supported. Exact reference-image placement is not claimed where only descriptions were available.
