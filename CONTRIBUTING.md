# Contributing to Studio

Before implementing or reviewing a feature, read:

1. `SECURITY.md`
2. `docs/PRODUCT.md`
3. `docs/UI_LANGUAGE.md`
4. `docs/ARCHITECTURE.md`

## Implementation order

For product work, use this decision order:

`PRODUCT → UI_LANGUAGE → existing components → feature rationale → implementation`

## Reuse contract

- Do not create page-local versions of shared primitives.
- Do not hard-code arbitrary radii when a shape token exists.
- Do not create a second status vocabulary for one feature.
- Add reusable patterns when the same interaction appears in multiple features.
- Keep global visual decisions in the design system.

## Feature rationale

Before a meaningful feature is implemented, document:

- Why it exists
- Primary user flow
- Domain relationships/data it uses
- Reusable UI modules it needs
- UX constraints
- Privacy/security considerations

## Public repository privacy rule

Never include real personal or production-private information in code, fixtures, tests, screenshots, docs, issues, PRs, or commit messages. Demo data must be invented from scratch.

Never commit credentials or secrets. See `SECURITY.md`.

## AI integration rule

AI integrations are opt-in runtime features. Never commit a user's provider configuration or credentials. AI mutations must use the same domain operations and validation as direct UI actions.
