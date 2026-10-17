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

## 16:02 UTC additional verification and handoff

Environment continuity verified after disconnect notification: same checkout, commits and local changes remained accessible. Branch `studio/qa-overnight-20261017` and draft PR https://github.com/wonjy8/Studio/pull/14 contain candidate8699dca; its CI run39047306981 succeeded. Main remainsdb328457fdfcb9e3d2e60e24513376d9a051b618. No GHCR publication or NAS rollout has occurred for this branch.

Additional local fixes: large table display geometry reserves handle margins and scales visually on narrow canvases without altering saved sizes/precision; admin equipment groups canonical identities and includes unlinked catalog items; administration refreshes status/audit after actions. Full tests46/46 and syntax checks passed. Real Chromium also passed circle resizing/cancel, exact coordinate preservation, max-size tables at both canvas limits/mobile scaling, isolated timed suspension+restore and mandatory reset-password replacement, project cancellation/new-description retention and signup auto-login. These admin actions involved only disposable invented local accounts.

User clarification is pending: original instruction explicitly forbids applying production migrations. Subsequent GitHub/deployment approval did not explicitly mention new DB tables. A question asks whether non-destructive additive tables are included. Until answered, preserve the full implementation on the tested branch/draft PR and do not publish main (which auto deploys/adds tables). User additionally confirmed NAS checks every minute. Parent has working authenticated operational Chrome and should validate once a deployment is authorized; no credentials should be requested.

Chosen unresolved policies: invitations immediately grant read-only access with no acceptance workflow; private attachments excluded. Admin deletion is reversible tombstoning, not permanent physical removal. Catalog custody stays with registering account; project-member ownership/assignee links are explicit and project-local, no name-based cross-account transfer. Circle remains a circle. Future role escalation, irreversible retention/deletion and cross-account inventory transfer require product decisions.

## Deployment authorization clarification and review gate

Parent clarified the initial migration restriction was a pre-deployment constraint and the user's later explicit automatic deployment request includes necessary non-destructive additive schema changes. No extra user answer is required. Destructive transformations, account privilege changes, security-configuration changes and real account administration remain excluded.

New migration wrapper `server/account-migration.js` creates a private online SQLite snapshot before first schema expansion on an existing populated installation, includes committed WAL data, uses a0700 backup directory and0600 file, and adds the nine new tables transactionally. Existing core rows/admin configuration remain identical. Snapshot stays inside the private data volume; nothing is uploaded to Git. `tests/account-backup.test.js` and `tests/account-migration-compat.test.js` verify preservation and historical server reopen. Important: after new account status/reset policies are actually used, old server versions ignore them; full rollback must retain new guards and latest data, prefer a forward fix. Never automatically restore a stale backup over post-deployment writes.

**Main merge/deployment is currently blocked by parent's independent read-only security review.** Reviewer found P1 active-project shared response leaked nested non-shared projects via cloning the workspace root. Fix uses an explicit project-only allowlist, with full-response private second-project sentinel regression. Do not merge until parent review explicitly clears this issue and any additional findings. Latest candidate and test results must be sent back for review. Parent owns operational browser verification and ongoing schedule ownership.

## Security review fixes — ready for parent's re-review

Shared project responses now use project-only scalar-field allowlists, excluding workspace projects/settings and owner attachment IDs/URLs/unknown nested extras. Full serialized response and discovery sentinel regressions cover an invited active project and a separate private project.

Password replacement verifies the still-valid hashed session and active account inside the transaction after asynchronous password work, then uses a password-hash compare-and-swap. Deterministic tests cover concurrent administrator reset with both revoked and retained session: reset hash and forced replacement flag survive. All account credential/status revocation also deletes outstanding OAuth codes; real registered-client PKCE consent code fails token exchange after suspend/restore.

Canonical inventory now tracks per-usage baseline values to distinguish intentional edits from old snapshots. Exact regression saves A then switches the original retained A-new/B-old client snapshot to B without a reload: values do not revert. Conflicting stale explicit edits reject409 atomically; inactive-project command updates propagate to all linked usages. Save response supplies authoritative normalized state which the UI adopts, and category edits use shared domain operations.

Latest complete local checks:51/51 Node tests, npm check, and full Chromium desktop/mobile suite pass. Backup failure prevents schema expansion; private pre-schema snapshot and historical reopen tests pass. Main/deployment remains held pending parent's independent review clearance. These fixes have no operating data/account effects before deployment.

## Deployment completed and operational smoke

Parent security review cleared4aed5e0. PR14 merged as348206230eac40bca547e260c0f05101ad678e9f; main CI and GHCR publish run39048624238 succeeded. Immutable image tag and latest share digest sha256:61feb0b08c6c9516799a3bf43b2176a9c2dad0ef5ec93e84292b7a98009c3ab3. Published-image isolated health/revision/unauthenticated401 passed. Parent authenticated cloud Chrome confirmed actual NAS /health revision exactly matches3482062 and operational smoke: settings/tasks tabs, calendar/list, original QA data preservation, checklist save+refresh, project settings1900icons/search/teams. No real invitations or administrator mutations occurred; smoke is not exhaustive. All earlier deployment review holds in this log are now resolved.

## 16:40 UTC resize feedback round

Parent measured west resize20CSSpx shrinking240→200 and circle north growth moving the perpendicular center at1180×757/DPR1/viewport scale1. Replaced centered double-delta logic with anchored boundary geometry and screen-to-canvas scaling. New4 unit tests plus full suite55/55 pass. Chromium resize harness passes32 shape/handle/scale combinations plus measured shrink, cancel, saved reload and mobile fitted geometry; full app browser regression rerun. No schema/auth changes. Existing production coordinates/data are retained; operational verification will follow the new image revision. Main publication follows CI success; parent owns browser verification and the existing hourly schedules.

The16:45 scheduled request was handled as this in-progress resize round, without a duplicate branch or repeating job. PR15 candidate51d63e4 passed CI and merged as53b3732af42872ab2c583ea8b5ca1df00e7b0dac. An additional repeated-keyboard check then reproduced placement focus loss after asynchronous save; follow-up restores focus after the latest save completes. Regression verifies successive arrow moves and retained dimensions. Production account actions remain excluded; all mutation tests are isolated.
