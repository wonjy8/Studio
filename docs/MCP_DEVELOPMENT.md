# Studio MCP maintenance and verification

Studio keeps its existing NAS service, `APP_ORIGIN`, OAuth clients, account data and plugin identity. This revision does not create a second plugin or move hosting. The configured production origin in `compose.yaml` gives the connection URL `https://studio.wonjongyou.com/mcp`; Settings → Connections → ChatGPT displays the current browser origin plus `/mcp`.

## Current contract

The stateless JSON-only Streamable HTTP endpoint accepts POST JSON-RPC. It supports initialize, ping, tools/list, tools/call and notifications, with protocol versions 2025-03-26, 2025-06-18 and 2025-11-25. It does not implement an SSE subscription or claim list-change notifications. The catalog still has nine tools:

| Tools | Purpose |
| --- | --- |
| `search`, `fetch` | Account-owned project retrieval and citation URLs |
| `studio_list_projects`, `studio_get_project` | Account-owned project metadata/detail and effective capability discovery |
| `studio_read_content` | Runtime manifest and explicitly approved content reads |
| `studio_propose_changes` | Stage project commands using the read revision, without applying |
| `studio_propose_content` | Stage one approved content change using its read revision, without applying |
| `studio_cancel_proposal` | Cancel this connection's pending proposal |
| `studio_apply_changes` | Apply this connection's fresh single-use proposal after explicit confirmation |

OAuth authorization-code/PKCE S256, resource binding, separate `studio:read`/`studio:write`, token revocation and existing content/School/workspace consent remain in place. Read-only grants discover five read tools; unauthenticated discovery shows static definitions but no account content. The content services still enforce account/project/team/organization ownership and roles, with revision and consent checks repeated on application. Private attachment bytes, account/settings/administrator/permission actions and external provider authorization remain excluded. Source support does not prove that ChatGPT has registered the deployed endpoint or exposed its current catalog.

## Tool schema 9 changes

- Enforce the registry's finite input-shape constraints before dispatch: required fields, actual types (no coercion), enum, range, string length, array size and closed object properties. The helper in `server/mcp-contract.js` implements only the keywords used by this static registry; add validation and tests together when introducing a new keyword. Business/resource-specific checks remain in their owning services. Diagnostics name known argument paths, never unknown caller-supplied fields/values.
- `search` and `studio_list_projects` accept integer `offset` and `limit`, default 50 and maximum 100. Existing `results`/`projects`, revision, capabilities and citation fields remain; additive `total`, `offset`, `limit` and `nextOffset` make later pages explicit. Follow `nextOffset` until null, preserving the search query. These are tool-result pages, distinct from tools/list catalog pagination. The nine-tool catalog is a single page; unissued cursors are rejected.
- Reads exceeding 1 MiB of serialized tool-result JSON return `isError: true` / `RESULT_TOO_LARGE`, never silently truncated success. Existing generic content responses retain their stricter worker limits and field/block pagination. Use smaller pages or field-specific reads within existing consent; a large complete project may need to be viewed in Studio.
- Confirmed project writes return a compact `{revision, applied, impact}` receipt, rather than the internal full workspace (including unrelated projects/settings). Re-read the intended project/content after a successful receipt. Write receipts are not subjected to a read-only size rejection after a commit, avoiding an ambiguous applied-write error.
- The project icon field describes a catalog-validated ID instead of advertising only the original six values; the existing domain allowlist remains authoritative, including saved legacy IDs and the soccer identity.
- Read tools advertise `readOnlyHint` and `idempotentHint`; proposals/cancellation do not. Application remains destructive/non-idempotent and now advertises `openWorldHint: true`: existing enabled calendar publication can synchronize confirmed schedule changes to previously chosen Google targets. This does not grant new Google scopes, enable publication or allow changing its settings. Previews remain without external side effects.

Malformed RPC parameters, unknown/unauthorized tools or an invalid tools cursor use JSON-RPC errors. Valid tool calls with invalid inputs use `isError: true` / `INVALID_ARGUMENTS`, in line with the [MCP tools error contract](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#error-handling). Existing business denial, conflict and OAuth challenge responses remain distinct. A failed or conflicted proposal must be reread/reproposed/reconfirmed rather than silently reapplied.

## Isolated acceptance

Run `node --test tests/mcp.test.js tests/content-contract.test.js tests/connection-diagnostics.test.js`, `npm run check`, and `npm test`. Tests create only temporary SQLite accounts/OAuth fixtures on localhost and remove them afterward. They cover initialization/discovery, public data exclusion, read/write separation and annotations, malformed/nested inputs, no proposal on invalid inputs, pagination without dropped projects, oversized reads, compact write receipts, cross-account/role/consent denial, confirmation, stale revisions, expiry/replay and revocation. No production data, grants or credentials are used.

For the actual client connection, reuse the existing Studio custom app and its OAuth endpoint. Inspect its sanitized registered endpoint/catalog and compare serverInfo `1.0.0-tools-9`, nine tool names and tool schema 9. A cached six-tool client is not verified repaired merely by deploying code or toggling consent. New plugin registration is a separate user-approved operation handled by the plugin owner; do not create duplicates as an unapproved diagnostic workaround. Do not create a new persistent token/grant or broaden edge policies as a workaround. Actual connection/authorization and remote verification are separate user/client steps; NAS access is not part of these tests. See [deployment connection instructions](NAS_DEPLOYMENT.md#connecting-chatgpt-as-a-private-mcp-app) and [discovery audit](MCP_DISCOVERY_AUDIT.md).

Deletion, new external Google operations and administrator actions are deliberate scope decisions, not missing tools to add during compatibility maintenance.
