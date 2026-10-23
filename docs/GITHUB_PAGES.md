# Studio GitHub Pages scope

## What is prepared

A static-only publication candidate, **not a working replacement for the Studio server**. Studio requires Node session authentication, same-origin `/api` routes, a database, private file storage, OAuth callbacks and server-owned revision checks. Pages cannot execute these. The generated entry explicitly explains the missing backend, sends no API/login/upload requests and links to the existing public Studio address. It never pretends to save data. The existing root index, canonical-origin bootstrap, API/CORS rules, NAS domain and container workflow are unchanged.

The repository is already public and reports `has_pages: true`. The connected GitHub read tool rejects `/repos/wonjy8/Studio/pages` as an unsupported URL, so the existing Pages source branch, custom domain and Actions-source setting remain **unverified**. No alternate transfer/settings route was attempted. Deployment must wait until the owner or a supported tool confirms that replacing this Pages site is appropriate and its publishing source is GitHub Actions.

## Publication boundary

`pages/public-assets.json` lists exactly which committed public `src` files can be copied. The builder reads Git blobs at HEAD, never workspace files, excludes all unspecified files, rejects traversal/symlinks and refuses to overwrite an existing output directory. Public licenses are included. No server, tests, tools, `.git`, environment files, runtime data, DB, user uploads, reports or backups enter the artifact.

Generated output under `build/pages/` contains:

- `index.html`: explicit backend-unavailable status, no executable scripts or forms, relative stylesheets and CSP blocking script/API connections;
- `pages-status.css`;
- `.nojekyll`;
- `public-files.json`: exact source revision, static-only mode and complete public output list;
- only the files listed in `pages/public-assets.json`, including four third-party notices.

Run after committing the reviewed files:

```sh
node --test tests/pages-static.test.js
node tools/build-pages.mjs
STUDIO_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/qa-pages-static.mjs
```

Use a new `build/` output path for another build. Output is ignored by the repository. Do not upload the repository directory as a Pages artifact.

## Workflow and NAS impact

The new `pages-static.yml` builds on relevant pull requests and supports manual publication with the exact independently reviewed SHA. PR runs cannot deploy. The deploy job alone receives `pages:write` and `id-token:write`, uses the existing `github-pages` environment and refuses an SHA mismatch. `configure-pages` has enablement disabled; it must not create/enable or change Pages configuration automatically. No credentials or OAuth grants are created.

A new workflow normally needs to exist on the default branch before manual dispatch is available. **Any main push currently triggers the existing container workflow**, including merging this candidate. Therefore do not merge or dispatch until the parent/user has explicitly accepted that image-publication side effect or chosen a supported alternative. This candidate has no push-main auto-deploy trigger. A successful static upload does not establish backend functionality or NAS runtime deployment.

## Decisions still required

1. If the immediate goal is only a public static address, approve the honest static-only status/asset publication and confirm the current Pages settings. Existing NAS app remains available via its link.
2. If login and app editing must work at the Pages address, choose backend hosting/API routing. The current backend requires same-origin cookies and callbacks; a cross-origin Pages frontend would need a separately reviewed authentication/CORS design. No such expansion is included or authorized by this candidate.
3. Confirm how to register the workflow without an unintended main container publication. No existing deployment workflow or repository visibility has been changed.

Official guidance: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages and https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages.

## Candidate validation

The reviewed snapshot emits 174 files (about 2.87MB), including 170 explicitly listed public source assets/notices and four generated/entry files. The complete paths are reproducible in build/pages/public-files.json. Local full suite: 689 passed, one existing historical skip. Chromium static hosting at the project prefix /Studio/ passed all174 file reads, relative CSS loading, no app/API/login execution, keyboard link focus and1440/390/320 overflow checks. Deep app routes deliberately return404 rather than pretending to route a working authenticated app. Other browsers and actual Pages publication remain unverified.
