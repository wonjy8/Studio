# Cloudflare foundation: public implementation contract

This is an isolated foundation candidate, not a deployed or complete Studio app. Existing application entry points and deployment workflows are unchanged. Do not merge into a production publication branch or deploy until separately reviewed and authorized.

## Implemented unit

- Web-standard Worker request handling and a namespaced D1 migration.
- Hashed session validation, active-account and connection-generation checks.
- Required Drive/Calendar setup states fail closed for partial/revoked access.
- Explicitly provisioned administrator bindings are preserved; creation order grants no administrator role.
- Own-document reads/writes require the expected account; writes also require same-origin CSRF protection.
- Validated structured content is split into bounded chunks to respect D1 row limits. One SQL read selects a consistent head/chunk generation. A single atomic batch checks authority and expected revision, replaces content, and removes obsolete chunks. A failed CHECK fence rolls back the batch. Identical retries remain idempotent.
- The optional local inventory tool reports only schema/count/size hazards. It does not export row values or credentials and has only been tested against synthetic data.

## Explicitly unfinished

Google login/session issuance, safe existing-account linking, frontend onboarding, Drive file I/O, Calendar synchronization, durable background jobs, remaining feature/admin/MCP APIs and operational migration are separate implementation units. Unknown routes return an explicit not-ported error. Health reports foundation-only. No account/session provisioning endpoint is exposed by this unit; test seeds are not a production login mechanism.

Future identity linking must validate the Google issuer/subject and prove the existing Studio account. Email alone must not merge accounts or transfer roles. Mandatory Drive/Calendar setup must preserve denial/partial-consent states. Optional services retain separate consent. No credentials or permissions have been created or activated by this candidate.

Original files belong in each user's own Drive. Shared-project storage-owner policy remains provisional; Studio membership must not be mistaken for Google sharing permission. Future file services need stable source IDs, scoped access checks, provenance, idempotent intents and uncertain-result reconciliation before success. No actual file sharing/transfer is included.

Owner withdrawal requires a reviewed impact plan and explicit confirmation. Existing personal Drive/Calendar objects must not be deleted. Future cleanup needs provenance checks, durable partial/failure/retry states and bounded credential handling. No deletion endpoint or live cleanup is included.

## Verification

Local full suite:694passed/1existing historical skip. Focused foundation/inventory:8passed. A real local workerd/Miniflare+D1 fixture blocks external requests and verifies migration, sessions, CAS conflicts, identical retries, valid >2MB UTF-8 JSON roundtrip in512000-byte chunks, concurrent one-winner CAS, batch rollback and connection-generation rejection. The database-time fence also rejects sessions that expire while a write waits.

Miniflare4.20260730.0 and compatibility date2026-08-06 were tested. The example configuration uses only a local placeholder database ID, disables public development/preview routing and has no deployment trigger. The added CI workflow validates local fixtures only and has read-only repository permissions.

Actual cloud validation requires a separately approved target account/environment, resource bindings, callback origin and secure secret-setting path. Do not send secret values in chat or commit them. No real resource creation, billing change, credential setup, data migration, sharing or deletion is authorized by this code candidate.

D1 reference: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/worker-api/d1-database/ .
