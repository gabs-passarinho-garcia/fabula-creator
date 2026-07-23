# project-documentation

## Purpose
Maintains complete project documentation and build guidance for the Fabula Creator application.

## Requirements

### Requirement: Comprehensive README Document
The project SHALL maintain a complete, epic, Portuguese (BR) README document located at `README.md` that describes the Fabula Creator application.

#### Scenario: User visits the repository root
- **WHEN** a user or developer views the repository root
- **THEN** `README.md` renders an epic ASCII header banner, project badges, feature summary, screenshot placeholders, dev setup & cross-compilation instructions, architecture overview, and licensing information.

### Requirement: Development and Build Guidance
The README SHALL provide clear, actionable instructions for executing development scripts and producing release builds for Linux and Windows using Bun and Tauri v2.

#### Scenario: Developer reads build documentation
- **WHEN** a developer seeks to build the application locally
- **THEN** `README.md` details the prerequisites (Bun, Rust), dev command (`bun dev`), Linux build command (`bun build:linux`), and Windows cross-compilation command (`bun build:windows`).
