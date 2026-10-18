# Application URLs

Project pages use `/projects/:projectId/:slug/:tab`. The stable project ID selects the project; the readable slug reflects its last confirmed saved name. Korean names are supported, duplicate names remain separate through their IDs, and old slugs still open the correct project and normalize to its current slug.

| Screen | Path |
| --- | --- |
| Project home | `/projects/:id/:slug/home` |
| Schedule | `/projects/:id/:slug/schedule` |
| Shoots | `/projects/:id/:slug/shoots` |
| Camera layout | `/projects/:id/:slug/camera` |
| References | `/projects/:id/:slug/references` |
| Members | `/projects/:id/:slug/members` |
| Equipment | `/projects/:id/:slug/equipment` |
| Checklist | `/projects/:id/:slug/tasks` |
| Shoot mode | `/projects/:id/:slug/shoot-mode` |
| Project settings | `/projects/:id/:slug/settings` |
| Account settings | `/settings/account` |
| Administrator users/equipment | `/admin/users`, `/admin/equipment` |
| Invited read-only project | `/shared/:ownerId/:projectId/:slug` |
| Login | `/login` |
| Invitation signup | `/signup`, `/signin` |

Calendar view adds `?mode=calendar&month=YYYY-MM`. Existing detail and create dialogs add only an allowlisted `dialog` kind and, for existing records, an `id`. Draft form content is never serialized. Dialogs replace the current history entry rather than creating an extra entry for every open/close: browser Back returns to the preceding page and Forward can restore the dialog; Escape/Close removes it from the current URL. Reloading a creation dialog opens a fresh form, not its unsubmitted draft.

Unauthenticated deep links display `/login?returnTo=...` and return to the same authorized screen after login. Only local allowlisted application destinations are accepted; external URLs, protocol-relative URLs and login loops are rejected. The return target does not bypass account or administrator checks. Shared routes qualify project identity by both owner and project ID, never replace the personal workspace with a shared snapshot, and retain read-only API boundaries.

Legacy `?project=...`, `?sharedOwner=...&sharedProject=...`, named view hashes, and hash-form application paths normalize to canonical paths. Invitation hashes and connection authorization continue through their dedicated existing flows. Signup tokens are consumed rather than copied into application navigation URLs.

The server serves the SPA document for allowlisted application GET/HEAD paths only. API, source asset and private filesystem paths retain their separate routing and security checks. Absolute asset URLs make direct navigation and reload work at every depth.

Validation: unit routing round trips, stable IDs, Unicode/duplicate names, safe returns, dialog scoping and static/API boundaries; isolated browser checks for all project tabs, calendar state, detail/create dialogs, rename/old slug, multiple projects, shared ownership, regular/admin access, login return, legacy links, desktop and mobile history/reload.

Dialog restoration is limited to project page routes and records in that project. A project-creation dialog opened from an unrelated global route does not restore there on reload; use its project-sidebar entry. Administrator inline action/confirmation state is intentionally excluded from URLs and must be entered again before execution.
