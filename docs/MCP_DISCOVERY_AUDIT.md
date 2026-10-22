# School MCP discovery and canonical-content audit

## Baseline and scope

The audit starts at public commit `46b45f4ec2f08799a30288093288b3507601fc4b`, tree `d61f3f587aab65a27ae2f59a0a29310d1aacf5fc`. The allowed live `studio_list_projects` capability response reported that same server revision and tool schema6. No direct live MCP transport request, credential creation, consent change or real content write is needed for the isolated audit.

`server/index.js` routes exactly `/mcp` to `mcpService` before browser API origin enforcement. It has one current MCP implementation; `/mcp/`, `/sse` and guessed API routes are not legacy School interfaces. OAuth protected-resource metadata identifies `/mcp`. Bearer authentication, protocol version and request JSON validation run before dispatch. Invalid supplied tokens receive401, disallowed origins403, and tool calls without a connection return an OAuth challenge without data. The JSON-only Streamable HTTP implementation does not offer a persistent SSE stream; authenticated GET receives405. It does not advertise tools/list-change notifications, so `listChanged:false` is intentional, not a switch to force a platform refresh.

## Discovery result

The current static registry has nine names: search, fetch, studio_list_projects, studio_get_project, studio_propose_changes, studio_read_content, studio_propose_content, studio_cancel_proposal and studio_apply_changes. Anonymous registration discovery and read/write grants receive all nine in one response with no nextCursor. Read-only grants receive five, including studio_read_content. School/full-content consent gates execution, not tool-list inclusion. There is no six-tool permission branch, School pagination filter or per-client legacy registry. Names, object properties, required fields, nested object schemas and nullable command fields are covered by discovery tests. Protocol versions2025-03-26,2025-06-18 and2025-11-25 return the same catalog and their negotiated version.

A connector exposing six older project tools and the older project-only initialization instruction therefore does not match the current registry. That observation does not prove which external registration/cache component is responsible. The executor's previous direct live `/mcp` probe was blocked by proxy CONNECT403 before a Studio response; it must not be retried via another route. Source and allowed runtime revision evidence cannot substitute for a captured live tools/list response at the App registration boundary.

The next legitimate diagnosis is to compare the authorized App registration's actual MCP endpoint/discovery response and registered tool snapshot, including initialize serverInfo/instructions and all tool names. No permission expansion or production content mutation is justified by this discrepancy. Repeating consent, refresh or new-chat steps already attempted is not a demonstrated fix. Existing legacy project tools stay project-only; School data is not tunneled through project IDs to evade missing tools.

## Code defects repaired by this audit

* School overview now reads canonical graduation configuration and computed area/GPA summaries. It accepts validated graduation updates while preserving omitted configuration keys. Full arrays/maps supplied as fields replace those fields; read the complete value before replacing them.
* Course grade and detailed creditCategory are exposed as readable/proposable fields, using existing School validators and calculations. S/P, F, completion and duplicate-credit semantics remain canonical; a grade alone does not promote a course to completed.
* An empty layout read from a course without an initialized page can be proposed/applied as a no-op without dereferencing a missing page or generating unwanted weekly notes.
* Initialization now distinguishes project command proposals from ordinary-content/School proposals. It directs School writes through studio_read_content → studio_propose_content → user confirmation → studio_apply_changes.

Tool schema7 and content contract5 describe these content/instruction updates. The nine callable names and the separate school-content-v1 consent boundary are unchanged. This repair does not claim to solve the external missing-tool catalog.

## Reproduction

Run `node --test tests/mcp.test.js tests/content-contract.test.js tests/connection-diagnostics.test.js` and `npm test`. The HTTP audit test creates temporary accounts/OAuth grants and performs registration, PKCE consent/token exchange, initialize, tools/list, tools/call, separate School consent, read/propose/confirmed apply/reread, missing-field preservation, invalid graduation references, empty layout, stale/replayed proposals, revocation/reapproval and other-account denial through the real localhost server. Private School file exclusion remains covered by the existing HTTP tests. The test grant has no ordinary full-content consent and cannot read documents through School approval.

Protocol references: [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports). JSON discovery is a valid transport response; persistent SSE/list-change notifications are optional features and are not claimed here.
