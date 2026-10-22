# OAuth connection compatibility and diagnosis

Studio advertises RFC 9207 authorization-response issuer support and includes the exact discovery issuer in both successful and denied authorization redirects. ChatGPT documents issuer identification as a prerequisite for its stable callback. Exact registered redirect matching, PKCE, explicit consent, resource binding, read-only scopes and single-use codes remain unchanged.

This corrects a documented compatibility gap. It does not establish the cause of a production connection error or update external App registration/catalog metadata. An already registered connection-specific callback still must exactly match that client's registered redirects. Never relax callback validation to make a connection pass.

For an unresolved connection failure, obtain the failure timestamp/timezone and the existing administrator-only Settings → Connections → ChatGPT → connection diagnostics output. Compare metadata, client registration, authorization, token exchange, initialize and tool discovery stages. Diagnostics contain allowlisted outcomes, callback host/type and server revision; never ask for tokens, secrets, cookies, authorization codes, state or full callback URLs. An absent event alone cannot distinguish a client-side rejection from an inaccessible edge/server.

A six-tool legacy catalog is a separate observation from OAuth connection success. A metadata refresh/new conversation is not proof that the external App catalog updated. Do not repeatedly prescribe these actions without evidence.

Isolated tests intercept the external callback and use temporary accounts/grants. They establish local protocol/UI behavior, not a successful production ChatGPT connection. Live endpoint access or runtime verification may remain unavailable; report that limitation separately from CI and container publication.

Sources: [OpenAI authentication](https://developers.openai.com/plugins/build/auth), [RFC 9207](https://www.rfc-editor.org/rfc/rfc9207.html), [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
