# Studio Security & Privacy Policy

Studio is developed in a **public repository**. The repository must contain only source code, public documentation, and fully fictional demo data.

## Non-negotiable rule

**No personal, production-private, or credential data may be committed to this repository.**

This applies to source files, fixtures, tests, screenshots, documentation, commit messages, issues, pull requests, logs, examples, and generated artifacts.

## Never commit

- Real names, phone numbers, email addresses, addresses, account identifiers, or other personal information
- Real production schedules, scripts, call sheets, reference images, location documents, budgets, contracts, or uploaded project files
- API keys, access tokens, refresh tokens, passwords, OAuth secrets, cookies, session identifiers, private keys, or connection strings containing credentials
- User AI conversations or prompts containing private project data
- Local databases, exported user data, debug dumps, or analytics payloads containing user content

## Demo data

All repository demo and test data must be fictional. Do not anonymize a real production and reuse it as a fixture; create synthetic data from scratch.

## AI integrations

External ChatGPT connections are disconnected by default and require Studio login plus explicit read or read/write OAuth consent. Grants are account-scoped, expire, and can be revoked in Settings. The in-app API-key AI feature is not provided. See docs/AUTH_AND_SERVER.md for the MCP authorization boundary.

Credentials must never be stored in Git, committed configuration, frontend source code, demo data, URLs, or application logs. Do not treat a frontend build-time environment variable as a safe place for a secret: values bundled into browser code can be exposed to users.

The concrete authentication design must be reviewed against the provider's current official security guidance before implementation. Prefer provider-supported authorization and server-side/session-based credential handling where applicable.

## User data boundary

Repository source, demo data, runtime user data, and credentials are separate trust boundaries:

1. **Source** — public and safe to publish.
2. **Demo data** — synthetic and safe to publish.
3. **User data** — runtime-only/private storage, never committed.
4. **Credentials** — secret storage/authentication boundary, never committed or exposed to the client unnecessarily.

## Logging

Do not log secrets or full private user content. Diagnostic logging should use non-sensitive identifiers and redact sensitive fields.

## Before every contribution

Ask: **Would it be safe if this exact diff, commit message, test fixture, and screenshot were indexed publicly forever?**

If not, do not commit it.
