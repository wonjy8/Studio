# Studio — Product Principles

## Product definition

Studio is a production planning and shoot-day command center. It connects the information a crew needs before and during a shoot without turning the workflow into an ERP-style management system.

## Product hierarchy

`Workspace → Project → Shoot`

- **Project** is the overall production project.
- **Shoot** is the practical shooting unit inside a project. This replaces the previous user-facing term **Content**.
- Schedule, script, people, equipment, camera setup, references, and location connect around a Shoot.

## Primary promise

A user should be able to answer three questions immediately:

1. What are we shooting and when?
2. Is everything ready?
3. What do I need right now?

## Core product rules

### Schedule is the primary surface
The schedule is the fastest representation of the production day. Studio should open with useful project context rather than forcing users to choose a management module first.

### Shoot is the context hub
A Shoot is the practical shooting unit. Its script, cast, crew, camera setup, references, equipment, location, and schedule should be reachable without losing context.

### Connect information; do not duplicate it
People, equipment, references, files, and locations are reusable entities. Features link to them rather than creating disconnected copies.

### Planning and shooting are different modes
Planning Mode supports preparation and management. Shoot Mode is mobile-first and reduces the interface to current/next Shoot, assignments, script, references, readiness, and completion.

### Progressive disclosure
Show the information required to understand the current state first. Reveal advanced details only when requested.

### Direct interaction before AI
Frequent/simple actions use normal UI. AI assists with complex, cross-feature, or occasional operations. AI must use the same domain operations as the direct UI.

### Privacy by architecture
Studio's public repository contains no user data or credentials. User data and integrations live behind runtime boundaries described in `SECURITY.md`.

## V0.1 scope

- Project overview and readiness
- Schedule
- Shoot detail
- Embedded script preview + original download
- Members
- Equipment with owner and shoot-day assignee
- Camera layout
- Visual reference boards linked to cameras
- Mobile Shoot Mode
- Settings for private external ChatGPT app connections; no embedded API-key assistant

## Not V0.1

- Shot list as a required workflow
- Full post-production workflow
- Messaging/chat product
- Full accounting suite
- Advanced rental vendor management

## Product test

Before adding a feature, ask:

- Does it make the project state easier to understand?
- Does it reduce duplicate input or navigation?
- Is it useful at the moment the user sees it?
- Can it reuse an existing entity or UI module?
- Does it preserve the user's current Project/Shoot context?
- Is it safe for a public-source application architecture?
