# Studio — Product Principles

## Product definition

Studio is a production planning and shoot-day command center. It connects the information a crew needs before and during a shoot without turning the workflow into an ERP-style management system.

## Primary promise

A user should be able to answer three questions immediately:

1. What are we shooting and when?
2. Is everything ready?
3. What do I need right now?

## Core product rules

### Schedule is the primary surface
The schedule is the fastest representation of the production day. Studio should open with useful production context rather than forcing users to choose a management module first.

### Content is the context hub
A content item is the practical shooting unit. Its script, cast, crew, camera setup, references, equipment, location, and schedule should be reachable without losing context.

### Connect information; do not duplicate it
People, equipment, references, files, and locations are reusable entities. Features link to them rather than creating disconnected copies.

### Planning and shooting are different modes
Planning Mode supports preparation and management. Shoot Mode is mobile-first and reduces the interface to current/next content, assignments, script, references, readiness, and completion.

### Progressive disclosure
Show the information required to understand the current state first. Reveal advanced details only when requested.

### Direct interaction before AI
Frequent/simple actions use normal UI. AI assists with complex, cross-feature, or occasional operations. AI must use the same domain operations as the direct UI.

### Privacy by architecture
Studio's public repository contains no user data or credentials. User data and integrations live behind runtime boundaries described in `SECURITY.md`.

## V0.1 scope

- Production overview and readiness
- Schedule
- Content detail
- Embedded script preview + original download
- Members
- Equipment with owner and shoot-day assignee
- Camera layout
- Visual reference boards linked to cameras
- Mobile Shoot Mode
- Settings surface for optional user-configured AI integration

## Not V0.1

- Shot list as a required workflow
- Full post-production workflow
- Messaging/chat product
- Full accounting suite
- Advanced rental vendor management

## Product test

Before adding a feature, ask:

- Does it make the production state easier to understand?
- Does it reduce duplicate input or navigation?
- Is it useful at the moment the user sees it?
- Can it reuse an existing entity or UI module?
- Does it preserve the user's current production/content context?
- Is it safe for a public-source application architecture?
