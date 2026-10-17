# Studio overnight QA — 2026-10-17 UTC

## Authorized scope and safety

Cloud checkout `/workspace/Studio`, remote `https://github.com/wonjy8/Studio.git`. No AGENTS.md or local .agents skills were present. Read CONTRIBUTING and its four required documents. Initial worktree was clean. Node24 and Chromium are available. Baseline24 tests and check passed. Only invented local accounts and disposable SQLite directories were used. No operating account reset/suspension/deletion, production data edits, or NAS configuration changes were performed.

The user subsequently authorized GitHub reflection and deployment through the existing workflow. GitHub app repository metadata confirms push permission; the shell GH_TOKEN is invalid, so use the connected GitHub app for metadata/CI. Git transport read/fetch works. Six newer main commits were fetched and merged without discarding OAuth/client diagnostics work (merge b34d57c). Preserve these changes.

## Implemented and locally verified

- Signup title simplified; optional account display name; immediate login after signup.
- Stable production glyph and contextual settings sidebar; current account identity and self-only display-name update.
- Project settings at rightmost tab; description and project identity moved out of global settings.
- Rectangular/circular tables, eight resizing edges/corners and numeric fallback; circle preserves equal axes. People use silhouette plus name; kind icon choices preserve typed drafts. Rounded coordinate display retains unchanged decimal source values.
- Account search, immediate read-only project invitation with automatic linked roster entry, manual roster chips and multiple teams. Invitees discover shared snapshots in settings. Private owner attachments remain inaccessible.
- Server-authorized admin user and equipment menus, temporary-password reset plus mandatory replacement, timed/permanent suspension, reversible deletion/restore, username/reason confirmations, audit history and admin self-lockout protection. No admin profile editing or privilege assignment.
- Common account-owned equipment identity with explicit project/member links, repeated-link deduplication and no destructive propagation. Legacy free-text ownership retained; physical ownership is never guessed by name. Camera-linked category invalidation is rejected atomically.
- Schedule list/calendar switch, project checklist, scoped shoot creation actions, shoot editing.
- 1900 licensed vendored icons, search/categories/48 per page, major SNS; initial JS transfer grows about790KB uncompressed.
- Empty-project readiness copy, keyboard shoot activation, connected form labels, camera optional-field separator cleanup and long sidebar name containment.

## Verification as of first round

Full suite43/43 and npm run check passed after latest-main integration and profile/category hardening. Optional real Chromium harness `tools/qa-browser.mjs` passed desktop/mobile flows, creation/keyboard/Escape focus, two schedule views, checklist completion, table resize and form draft retention, icon search/save/reload, long project name, invite/automatic roster/multi-team persistence, manual roster distinction, invitee read-only access/admin403, inventory deduplication, self display name persistence and admin list views. No browser exceptions. Harness creates/discards its own invented DB. Run with `STUDIO_PLAYWRIGHT_MODULE=/tmp/studio-qa/node_modules/playwright/index.mjs node tools/qa-browser.mjs` and system Chromium. Playwright is installed outside the repo in /tmp only.

Docker build and isolated container health passed on the first candidate. Final image must be rebuilt after final changes. No lint/typecheck/build scripts exist; this is dependency-free native JS. Syntax checks, tests, Docker build and browser acceptance are applicable.

## Deployment verification handoff

Existing main workflow validates, publishes GHCR latest + immutable SHA. User confirms NAS polls every minute; existing updater retains volume, pins image IDs and rolls back unhealthy startup. New health revision field is wired from GitHub build SHA for exact version verification. Shell/public URL access is403 in this environment; parent cloud Chrome has an authenticated working session and owns operational verification. Do not ask for credentials or change access/security settings to bypass this.

Parent should verify `/health` revision against published candidate SHA, then refresh and check project tabs end with 할 일 / 촬영 모드 / 설정, project settings identity controls, settings-specific secondary sidebar, signup title and stable production icon. Preserve existing QA production data. Any actual reset/suspend/delete actions remain excluded.

## Later rounds

Hourly follow-up tasks scheduled for16:45–22:45 UTC, final closeout23:00 UTC (08:00 KST next day), this night only. Each run must inspect this log and current working tree, avoid overlapping in-progress work, use cloud only, test before publishing, and distinguish CI/image publication from actual NAS deployment. Do not claim future tasks executed until observed. No new work after23:00 UTC.
