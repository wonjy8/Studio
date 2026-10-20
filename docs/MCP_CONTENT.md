# Studio content MCP contract

Tool schema 5 keeps the original project tools and adds `studio_read_content`, `studio_propose_content` and `studio_cancel_proposal`. Apply uses the existing `studio_apply_changes` tool and always requires explicit user confirmation. Content resources and fields are discovered from `studio_list_projects.capabilities.resources` (contract version 3), not a static resource enum. Changes to ordinary fields/resources can therefore appear in discovery without changing tool signatures. Initial ChatGPT metadata Refresh and a new conversation are still required to discover these three tools; the server cannot force a client refresh.

## Scope and consent

Each person connects their own account. The connection consent screen discloses account-visible projects, documents, member/organization equipment, materials, and private scripture/QT/gratitude/prayer/verse annotations. Write consent remains optional and applies only to additions/updates. New OAuth approval records full-content consent for that new grant only. Existing grants retain project-only access until their own signed-in owner explicitly approves that connection in Settings → external connections → “전체 콘텐츠 연결”. A read-only grant remains read-only after this approval. Refreshing a token retains the same grant and consent; unrelated grants/users are not migrated. Existing scopes `studio:read`/`studio:write` are unchanged; the additional per-grant consent is checked in the database on every content request and again before application.

Account, login, password, deletion, settings, integrations, invitations, permission changes and administrator actions remain outside MCP. Organization roles are not expanded. Shared project content and Bible source remain read-only. Shared equipment catalog metadata supports create/update only for accounts with the existing Studio catalog-manager (site administrator) permission; no role, grant or account administration is exposed. No attachment bytes are returned; existing file metadata and account-owned file references may be used.

## Coverage

| Resource | Read | Add/update | Boundary |
| --- | --- | --- | --- |
| Original project tools plus paged `shoots`, `tasks`, `project_members`, `project_equipment`, `project_references` | Yes | Original propose/apply commands | Existing project consent for original tools; full-content consent for new resource tools; owned projects |
| `shoot_configuration` | Yes | Selections, rentals, cameras, layout arrays | Owned project + shoot IDs, domain validation |
| `documents`, `project_documents` | Summaries/detail/fields | Title/content | Preserve other documents |
| `document_blocks`, `project_blocks`, `note_blocks` | Paged blocks | Append/update one stable block | `id` is parent document/note; `blockId` optional |
| `notes`, `qt` | Summaries, detail and selected fields | Note and journal content | Private to connected account; original external/automatic QT identity preserved |
| `gratitude`, `prayers` | Paged entries/search | Add/update entry | Use `noteId` to edit the owning QT; entry IDs preserved |
| `annotations` | Book/chapter annotations | Memo/color/background/ranges | Own book/chapter/verse |
| `bible` | Imported/stored translations | Source read-only | No invented verses or external repository credentials |
| `references`, `boards` | Metadata/board detail | Content, owned file links, layout | Preserve all attachments and validate file ownership |
| `materials` | Paged metadata | New link and metadata updates | Immutable existing link/file identity; no raw bytes or implicit preview fetch |
| `members`, `member_equipment` | Own member-content records | Contact content/equipment | Account linkage hidden, preserved internally and never accepted as input |
| `inventory`, `organizations` | Existing accessible items/organization ID and name only | Item add/update; organization metadata read-only | Existing organization role/canonical custody checks |
| `loans`, `returns` | Existing visible loan/return history | Issue loan / record return | Stable proposal request key; stock and current role validation |
| `catalog` | Search/detail | Create/update manufacturer, model name, nickname, category and optional photo | Shared catalog; existing catalog-manager permission + full-content write consent; no delete or permission changes |
| `vendors` | Search/detail | Add/update | Own vendor records |
| `shared_projects` | Existing membership projection | Read-only | Owner + project identity checked against the connecting actor |

## Requests and pagination

1. List owned projects/capabilities. Read a semantic resource with explicit IDs obtained from Studio. Default page size is 25, maximum 100. Use `query`, `offset`, `limit`, and the returned `nextOffset`.
2. For large documents, read the block resources or `field:'blocks'`. For notes, select `field:'document.blocks'`, `qtJournal.word`, `qtJournal.application`, `qtJournal.gratitude`, `qtJournal.prayers`, `qtJournal.memos`, or `qtVerses`. Summary reads omit document blocks and large journals. Responses are capped at 128 KiB; array pages shrink automatically. Never replace a complete array using a partial page.
3. Propose with the same resource/target, the returned content revision, and `valuesJson`, a JSON object of changed fields from the runtime manifest. Prefer one-block changes. `qtJournal` patches merge top-level journal fields; array values replace their complete arrays. Do not invent original Bible/QT source text.
4. Show the exact proposal values/impact. The preview is executed in a transaction on a separate worker database connection and rolled back, including nested service transactions and generated history/loan numbers. Preview-generated IDs are temporary. No network fetch or initialization/migration runs inside these adapters.
5. After explicit confirmation, apply the single-use proposal. Consent, account status, token/grant expiry, object permissions and the content snapshot are checked again in the worker transaction. Conflict means reread → re-propose → renewed confirmation. Cancelling deletes the pending proposal; otherwise it expires in ten minutes. No permanent delete operation is exposed.
6. Re-read the actual applied record IDs. Apply returns bounded metadata rather than unrelated workspace state.

The dedicated worker prevents preview/apply transactions from sharing the HTTP request connection. Existing service validators/permission checks perform the mutations; nested transactions compose as savepoints. Reads also roll back incidental service reconciliation, so they do not silently migrate content. Link previews and remote Bible repository synchronization remain app operations.

## Maintenance and verification

`content-resources.js` is the finite semantic resource/field contract; member, reference, vendor and inventory handlers share its editable field lists. Document/block and scripture changes reuse domain validators, so supported content types and formatting follow their canonical implementations. `content-contract.js` explicitly classifies app services. A newly routed service with no classification fails coverage tests; a classified consent-required service with no adapter fails resource coverage tests. Existing project command fields must exist in the tool schema. Unknown resource IDs, URLs, SQL/table names, account/settings/admin services and unapproved grants fail closed. New sensitive or permission-related features require an explicit exposure/consent decision; they are never auto-published.

Run `npm test`, `npm run check`, and `node --test tests/mcp.test.js tests/content-contract.test.js`. Tests cover consent downgrade, legacy isolation, cross-account IDs, organization viewer denial and role revocation, source/shared read-only boundaries, preview rollback, owner-only renewal, expiry, cancellation, conflict and replay.

## Exact existing-connection approval preparation

Prefer the self-service button on each connection; no operator needs credentials or tokens. An authorized operator can prepare a single-target review with `DATA_DIR=... node tools/content-consent.js --user EXACT_USERNAME --connection EXACT_UUID`. This defaults to read-only and prints only account/connection identity, current scope and consent status. Add `--approve` only after verifying explicit owner approval for that exact account/connection. There is no all-users/all-grants migration mode. Do not infer the owner from project names. This change does not itself approve any production connection.

## Reading connection diagnostics

`capabilities.services[].access` is the fixed service requirement: `consent-required` remains present even after approval. Never interpret it as a failed or missing approval. Use `capabilities.connection.fullContentApproved`, `requiresOwnerConsent`, `canReadFullContent` and `canWriteFullContent`, which are computed for the exact authenticated grant, plus each service's `effectiveAccess`. These report grant-level capability, not authorization to every individual object; existing object checks still apply. `toolSchemaVersion` and `serverRevision` identify the running MCP response without exposing account IDs or tokens. A full-content-approved connection with only the six old tools needs ChatGPT metadata Refresh and a new conversation, not repeated Studio consent.


## Shared equipment catalog writes

Discover `catalog` in `studio_list_projects.capabilities.resources`. Its `operations` are `create` and `update`, `shared` is true, and `writeRequires` identifies the existing catalog-manager permission. `readOnly`/`canWrite` reflect the connecting account role, current full-content consent and write scope. The worker rechecks the actual role mode and current membership on both preview and apply, so a demotion cannot use an older proposal. The global catalog is intentionally readable by other signed-in users; it is not account-owned equipment stock. No tenant or organization permission is expanded.

Read with `studio_read_content({resource:"catalog",query:"model"})`, then propose with that exact target/revision. Omit `id` to create; use the returned model `id` to update only changed fields. The existing case-insensitive manufacturer+model uniqueness, category, linked-equipment restrictions and revision validators apply. Preview inserts/updates roll back; apply returns the actual generated model ID, and each proposal still requires explicit user confirmation. A stale or cancelled proposal must not be silently retried.

`photo` optionally accepts `{type,base64}` for an existing supported PNG/JPEG/WebP payload within the 65,536-byte `valuesJson` limit; omission preserves the existing photo, and explicit null removes it. Raw image bytes are never returned by MCP. No external image URL is fetched or accepted as a photo, and a photo cannot be assigned by guessing file IDs. Photo URLs in reads remain the existing authenticated Studio metadata links. No archive/delete operation is exposed.
