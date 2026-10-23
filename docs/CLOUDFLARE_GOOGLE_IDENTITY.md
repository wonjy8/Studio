# Google identity backend: scoped contract

This candidate adds a backend-only Google identity unit on top of the unmerged Workers/D1 foundation. It is not a complete Studio frontend or an operational deployment. Existing application/deployment paths remain unchanged.

## Available endpoints

- `GET /api/edge/auth/bootstrap`: configuration readiness, required scopes and browser-bound CSRF setup. It does not expose secret values.
- `POST /api/edge/auth/google/start`: explicit signin, reconnect, or verified legacy-ticket link. Exact configured origin/CSRF are required. Unknown subjects need explicit signup confirmation. Existing live sessions need explicit account-switch confirmation.
- `GET /oauth/google/callback`: fixed configured callback, durable one-use browser state, PKCE/nonce, validated Google signature/issuer/audience/subject/time, and access-token subject check. Credentials remain server-side encrypted and sessions use secure HttpOnly host cookies.
- `POST /api/edge/auth/verify`: recheck required services and refresh expired access with a durable generation-bound lease. Definitive provider revocation invalidates local credentials/sessions. Transient failures are not reported as successful reauthorization.
- `POST /api/edge/auth/disconnect`: stops Studio access and removes local credentials. `providerGrantRevoked:false` is explicit: this does not claim the Google account's external permission grant was revoked. No external revocation endpoint is called.

The final configured service origin is authoritative; fixture URLs are not a requested domain change. Callback construction and verification do not silently use a different test origin. Real DNS, routes, OAuth clients/redirects/scopes and persistent secret configuration remain separate approved operations.

## Identity and consent boundaries

Google `iss`+`sub` is the login identity. Email/profile names never merge accounts or grant administrator roles. Existing account IDs and explicit role bindings are preserved when a valid single-use proof ticket is consumed. There is no public ticket-issuance endpoint: obtaining a ticket requires a separately reviewed process proving the existing account. That proof issuer, operational account migration and end-user linking UI are still pending. Test-seeded tickets are not a production recovery mechanism.

Minimum required setup is OpenID plus `drive.file`, Calendar events and calendar-list read. These scopes do not activate unrelated services or grant unrestricted Drive browsing. Denial, missing/partial consent, missing offline refresh, unavailable required APIs or no confirmed writable calendar keep app access blocked. A readiness probe is read-only; this unit does not upload files, create calendars, invite users or send notifications.

Credentials are authenticated-encrypted with account/generation context. Same-client refresh reuse is restricted to the same verified identity/source. Client/key/context changes require fresh consent and cannot reuse another service grant. Explicit reconnect rotates the connection generation; old sessions and late refresh results cannot overwrite the new context. Ordinary same-context signins can retain existing connection generation. Durable state/rate limits/refresh leases do not rely on isolate memory.

External Google permission revocation is detected when Google is checked/refreshed; an instant push-revocation integration and background synchronization are not claimed. Signup/linking, callbacks, refresh and disconnect recheck relevant D1 authority atomically before committing. No first-signin administrator inference exists.

## Remaining work and activation

The actual Google login button/onboarding pages, username/profile migration, legacy proof issuance, Drive originals/proxy/ownership, Calendar event services, remaining feature/admin/MCP APIs and durable jobs are later units. Callback JSON is a backend result, not a complete interactive app. Shared-project originals and owner-withdrawal behavior are not performed here.

Real activation needs separately approved target bindings and secure settings for a Google web OAuth client and token-encryption key, plus the exact final callback origin/scopes. Do not send secret values in chat or commit them. No cloud resource, permission grant, persistent secret, data transfer or deletion has been performed by this candidate. Main merge remains on hold under the current publication constraint.

## Validation

Fixtures use generated test signing keys and fake tokens only. Node tests cover signature/issuer/audience/nonce/lifetime/access-subject rejection, one-use state and legacy proof, role preservation, consent denial/partial scopes, no offline refresh, wrong-account reconnect, session/client switches, revoked grants, stale refresh and disconnect races, expired proofs/attempts, durable rate limiting and redirect rejection. Malformed/oversize foundation requests and interleaved resource reads/writes were added.

Real local workerd/D1 exercises the OAuth callback with a mock Google provider, RSA/AES, PKCE/state/nonce, encrypted persistence, replay and refresh revocation. It also runs foundation concurrent/interleaved reads and writes. CI is PR-only and includes imported document/comment/emoji domain paths. No production identity or account was used. Production Google OAuth, browser onboarding and cross-browser behavior are not yet verified.

Sources: https://developers.google.com/identity/openid-connect/openid-connect ; https://developers.google.com/identity/protocols/oauth2/web-server ; https://developers.google.com/workspace/drive/api/guides/api-specific-auth .

## Updated deployment scope

The Cloudflare service uses new Google registrations. Legacy NAS account linking is disabled at both start and callback, even for preexisting proof tickets. The preserved schema does not authorize migration. No legacy proof issuer or migration UI is planned in this scope. Administrator assignment remains an explicit reviewed operation, never a first-signup or email-match side effect.

Every successful credential replacement rotates its connection generation, invalidating prior sessions. This fences delayed refresh and readiness failures from a newer sign-in. Calendar readiness follows up to 20 pages, rejects repeated/invalid cursors, and leaves setup incomplete if no writable calendar can be established.
