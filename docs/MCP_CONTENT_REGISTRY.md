# Common MCP content discovery

The callable interface remains the same nine tools. `studio_read_content` with `resource: "manifest"` returns the current semantic resource IDs, workspace labels, supported fields and effective read/write status. Discovery supports bounded `query`, `offset` and `limit`; it returns a registry revision and `nextOffset`. Clients read a returned resource, propose changed fields with its content revision, show the impact, and apply only after explicit confirmation. New resources do not become new tools, enums or connector registrations.

The existing server already accepted runtime resource strings. Previously, discovery was coupled to project capabilities and future resources had no distinct durable consent contract. This change adds direct common discovery and an optional current/future workspace consent. It does not claim to repair the external ChatGPT catalog that still exposes six old project tools: source emits nine, while that external catalog also retains an old initialization instruction. No denied live MCP request was retried or bypassed.

## Trusted workspace contract

`contentRegistry()` combines the app's canonical content descriptors with trusted startup `contentWorkspaces` registrations. A registration declares an ID, display name and semantic resources using vetted adapters. The initial extension adapters reuse account-owned documents, references, materials and vendor content patterns. A genuinely new storage/behavior adapter must be implemented and reviewed in server code, using the normal app validators and permission checks. The client cannot register adapters or submit a route, service, method, SQL or role. New workspaces that implement this contract are discoverable through the same fixed tools after app deployment; they do not require another per-workspace ChatGPT registration.

Settings, administrator, account, permission and credential resource names and adapters cannot be registered through this extension contract. Existing excluded services remain excluded; an administrator role never bypasses their MCP prohibition or another account's private ownership. File bytes, unrestricted uploads and external-provider authorization remain outside the contract. Google integrations do not gain scopes. Existing team/project/organization visibility and catalog-manager checks still apply through the existing content adapters.

## Owner consent and compatibility

Existing OAuth tokens, legacy full-content approval and separate School approval retain their existing scopes. No migration or connection creation silently approves future workspaces or adds write scope. An optional separate `workspace-content-v1` approval covers current and future contract-supported content workspaces, including personal Scripture/QT/prayer and School records, within the connection's existing read-only/read-write scope and underlying content permissions.

The owner explicitly chooses **Settings → Connections → ChatGPT → current connection → 현재·향후 콘텐츠 워크스페이스 → 현재·향후 콘텐츠 워크스페이스 허용**. The confirmation explains sensitive personal content and exclusions. It can be revoked independently. Revocation preserves older approvals, invalidates pending content proposals and rotates approval generation on reapproval; stale proposals cannot gain renewed authority. It does not require new OAuth credentials. A connector still missing the common tools needs a supported catalog refresh/registration repair; this code cannot make unavailable host tools callable.

## Verification

Temporary accounts and real local JSON-RPC requests test unchanged tools/list, runtime discovery of a future fixture workspace, legacy approval rejection for that future resource, explicit owner opt-in, read/propose/confirmed apply/reread, stale/replayed proposals, revocation/reapproval, unknown and protected resource rejection even for an admin, cross-account isolation and read-only token restrictions. No real connection or user content is modified. Isolated desktop/mobile UI checks cover cancel/approve/revoke/reload, keyboard entry, failure/retry, account isolation and unchanged OAuth/legacy consent scopes.
