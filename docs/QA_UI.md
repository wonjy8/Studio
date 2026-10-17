# QA UI improvements

The overnight QA work keeps project editing inside project context and global account/connection settings in the workspace settings sidebar. The production rail always uses the same vector. Shoot creation appears in Schedule and Shoots, where its effect is clear. Existing project data is preserved.

The schedule keeps its original list and adds a month calendar using the project's existing shooting date; undated shoots remain explicitly visible rather than receiving invented dates. Tasks are a lightweight project checklist. Shoot detail edits the existing shoot and updates its linked schedule row, avoiding duplicate shoots.

Forms use connected labels; clickable shoot rows support keyboard activation. An empty project has no readiness assertions. Optional camera summary values are joined only when present. Project identity form is shared between creation and project settings. Global settings displays the signed-in identity but cannot edit it.

Account and administrator interfaces use server-controlled capabilities; all tests use fictional isolated data. No production migration or account operation is run.

## Implemented behavior and verification

- Existing-account invitation immediately links the roster and grants a narrowly scoped read-only shared project view. No email/message is sent. Owner-side settings and members reuse one account/team panel. Teams permit several checked memberships per person.
- Global settings includes invited-project discovery; snapshots show shoots, people, and equipment without owner-private file links or edit controls.
- Administrator forms require username, reason, and explicit browser confirmation. Temporary reset passwords are shown only in the response area; reset accounts are forced to replace them before any workspace access. Personal fields are never editable. Equipment is a read-only admin listing.
- Browser Back restores project tab navigation. Modal Escape restores its trigger; Tab cycles inside open dialogs. Changing layout kind preserves current form draft fields.
- Signup signs in immediately after successful registration; failures remain visible on the form.

Validation run: `npm test` passed 28 tests before adding UI tests; `node --test tests/ui.test.js` passed 3 tests. `npm run check` passed. Parent performs isolated Chromium integration runs against the final combined changes; no production service was accessed.

Latest full combined verification: `npm test` **35/35 passed**, `npm run check` passed, `git diff --check` passed. Explicit syntax checks also cover the accounts feature, signup flow, shell, and navigation modules. Common equipment reuse on the project Equipment page selects an existing catalog record plus optional owner/assignee member IDs; links reuse backend identity and reload the authoritative workspace.
