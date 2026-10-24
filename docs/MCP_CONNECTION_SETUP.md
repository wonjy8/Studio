# MCP connection setup

Studio remains on its existing NAS service and domain. This change improves the connection handoff; it does not register a ChatGPT plugin, authorize a real account, create a production credential, revoke an existing connection, or prove that a reported remote failure is resolved.

## Observed server support

- `APP_ORIGIN` is validated at startup and is authoritative for the public OAuth/MCP URLs. The checked-in compose configuration uses `https://studio.wonjongyou.com`; the MCP endpoint is `https://studio.wonjongyou.com/mcp`.
- Protected-resource discovery is at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`. Authorization-server discovery is at `/.well-known/oauth-authorization-server`.
- Discovery advertises `/oauth/register`, `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`, PKCE S256, `studio:read` and optional `studio:write`. DCR accepts public clients and the existing secret-post/basic confidential methods. CIMD is not advertised or implemented; select DCR for this server.
- Registration validates HTTPS callbacks on the existing exact ChatGPT hosts. Authorization and token exchange require the exact registered redirect URI and MCP resource. Success and denial callbacks include the configured issuer and round-trip state. Codes are single-use, refresh tokens rotate, and login/consent are required. Registration alone grants no account access.
- Reverse-proxy `Host`, `X-Forwarded-Host` and `X-Forwarded-Proto` do not determine OAuth URLs. Keep the existing HTTPS `APP_ORIGIN` and secure-cookie configuration. Internal HTTP transport to the container does not justify changing the public origin or trusting arbitrary proxy headers.

## Handoff and automation boundary

The [OpenAI authentication guide](https://developers.openai.com/plugins/build/auth) documents discovery/DCR and automated code/token exchange, followed by user login and consent. The [plugin connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) still requires adding/configuring the server in ChatGPT and reviewing its discovered tools. Studio cannot silently install a ChatGPT plugin or skip account authorization.

For a newly registered plugin, its owner registers this server URL with OAuth/DCR in ChatGPT. Ordinary users then select the Studio plugin and complete Studio login and explicit permission approval. Manual client ID/secret entry is a compatibility fallback, not the normal DCR path. Keep existing manual clients/grants; changing the plugin registration does not require deleting them. New plugin registration and actual account connection are separate from this code deployment.

Settings → Connections → ChatGPT now displays the server's canonical endpoint, a copy action, a retryable setup state, and a fixed link to ChatGPT Plugins. It explicitly distinguishes setup information from a verified connection. The browser does not derive the endpoint from `location.origin`. Clipboard denial selects the text for manual copying and does not claim success.

`GET /api/connections/setup` requires the normal live browser session. It returns only configured URLs, automatic-registration capability, PKCE and existing scope/login/consent requirements. It creates no client/request/code/grant, returns no credentials, contacts no external service, and cannot test external reachability. Read failure disables copying and permits an explicit GET retry without modifying existing connections.

## Verification and remaining remote checks

Run `npm run check`, `npm test`, and `STUDIO_PLAYWRIGHT_MODULE=<installed-playwright-module> node tools/qa-mcp-setup.mjs` where Chromium is available. Tests use only temporary SQLite accounts and synthetic OAuth clients on localhost. They cover setup access/configuration/no writes, discovery consistency behind an HTTPS proxy, DCR without manual credentials, login, state/issuer, PKCE failure, denial, exact redirects/resources, reused-client reconnection with independent read/write scopes, copy failure/retry and 1440/390/320px keyboard/layout behavior. The existing MCP tool schema9/nine-tool registry, consent boundaries and confirmed write flow remain unchanged.

For the real connection, capture the actual sanitized plugin endpoint/discovery/authentication failure stage before attributing a cause. Compare the registered tool snapshot with the deployed server; setup success and local tests cannot prove ChatGPT can reach it. The plugin owner handles registration/installation, and the user completes login/consent. Do not auto-create grants, copy real tokens into diagnostics, broaden permissions or bypass proxy/security policy to force a successful probe.
