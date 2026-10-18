# Application URLs

Authenticated application URLs begin with the signed-in account's username. Project pages use `/:username/project/:slug/:projectId/:tab`: the readable name comes before the stable ID, and the ID selects the project. Korean names are supported, duplicate names remain separate through their IDs, and old slugs normalize to the last confirmed saved name. Draft input is never serialized into navigation URLs.

| Screen | Canonical path |
| --- | --- |
| Project home | `/:username/project/:slug/:id/home` |
| Schedule list | `/:username/project/:slug/:id/schedule` |
| Schedule calendar | `/:username/project/:slug/:id/schedule/calendar/YYYY-MM` |
| Shoots | `/:username/project/:slug/:id/shoots` |
| Camera layout | `/:username/project/:slug/:id/camera` |
| References | `/:username/project/:slug/:id/references` |
| Members | `/:username/project/:slug/:id/members` |
| Equipment | `/:username/project/:slug/:id/equipment` |
| Checklist | `/:username/project/:slug/:id/tasks` |
| Shoot mode | `/:username/project/:slug/:id/shoot-mode` |
| Project settings | `/:username/project/:slug/:id/settings` |
| Account / connections / data settings | `/:username/settings/account`, `/:username/settings/connections`, `/:username/settings/data` |
| Administrator users / equipment | `/:username/admin/users`, `/:username/admin/equipment` |
| Invited read-only project | `/:username/shared/:ownerId/:projectId/:slug` |
| Login | `/login` |
| Invitation signup | `/signup`, `/signin` |

Usernames preserve exact case and permit the existing account alphabet (letters, numbers, underscore, dot and hyphen, up to 64 characters, including legacy one-character names). `.` and `..` are not namespaces. To avoid API, asset and authentication protocol collisions, usernames `api`, `src`, `oauth`, `mcp` and `.well-known` use an `@` prefix in the path, such as `/@api/settings/account`; the actual username is still `api`. This escape is reserved for those names, case-insensitively. Ordinary usernames use their plain path. Real `/api/...`, `/src/...`, OAuth and MCP routes are never reinterpreted as account pages.

The namespace is account context, never authorization. A namespaced URL must match the authenticated username exactly (account ID is only a fallback for legacy session objects without a username). A foreign namespace displays an access error before project lookup; it is not silently rewritten to the current account. Shared projects additionally qualify identity with the owner and project ID, never replace the personal workspace, and retain read-only server boundaries.

Detail and creation dialogs append `/dialog/:kind` and, for existing records, `/:id`. For example, `/:username/project/:slug/:id/shoots/dialog/content/:shootId` opens a shoot detail. Only allowlisted kinds and current-project record IDs restore. Dialogs replace the current history entry rather than adding an entry for every open/close: browser Back returns to the preceding page and Forward can restore the dialog. Escape/Close removes it from the current URL. Reloading a creation dialog opens a fresh form, not its unsubmitted draft. Administrator action/confirmation state is excluded from URLs and must be entered again before execution.

Settings contains account, connections and data sections only. Signup invitation-link management lives in administrator User Management. Old `/settings/invitations` and `/:username/settings/invitations` links redirect to the corresponding administrator users page; regular accounts still receive an access error and cannot fetch its list.

Unauthenticated deep links display `/login?returnTo=...` and return to the same authorized screen after login. The encoded return target is an authentication handoff rather than view-state navigation. Only local allowlisted destinations are accepted; external URLs, protocol-relative URLs and login loops are rejected. Invitation hashes and connection authorization keep their dedicated existing flows, and signup tokens are consumed rather than copied into application navigation URLs.

Legacy unnamespaced `/projects/:id/:slug/:tab`, global/admin/shared paths, project/shared query links, calendar/detail query parameters and named/hash-form view links remain supported and normalize to the signed-in account's canonical namespace. Stable project IDs, owner qualification and account checks remain authoritative during normalization.

The server serves the SPA document for allowlisted application GET/HEAD paths only. API, source asset and private filesystem paths retain separate routing and security checks. Absolute assets support direct navigation and reload at every depth. Validation covers namespace spoofing, reserved-name/API collisions, Unicode and duplicate project names, rename/old slugs, legacy compatibility, safe login returns, dialogs, shared ownership and regular/admin boundaries on desktop and mobile.

Schedule now defaults to the monthly calendar. `?period=week&day=YYYY-MM-DD` and `?period=day&day=YYYY-MM-DD` retain the selected date and time-grid view, including through detail dialogs, reload and history navigation. `?mode=list` explicitly selects the legacy schedule list. Bare schedule paths open the current local month; stored project dates determine legacy shoot placement, not the visible month. Calendar date values use local civil dates rather than UTC conversions.
