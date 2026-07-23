## Context

The repository contains a Tauri v2 + React 19 + TypeScript + Bun application for Fabula Ultima TTRPG character creation, but lacks a full `README.md`.

## Goals / Non-Goals

**Goals:**
- Provide a visually engaging, epic JRPG/pixel-art styled `README.md` written in Portuguese (BR).
- Document all core features, technologies, and cross-platform build commands (`bun dev`, `bun build:linux`, `bun build:windows`).
- Diagram the high-level architecture (React UI <-> Tauri IPC <-> Rust/SQLite).

**Non-Goals:**
- Creating actual png screenshot files in this step (placeholders will be defined).

## Decisions

- **Language**: Portuguese (BR) as requested by user.
- **Visual Style**: Centered banner with ASCII art `FABULA CREATOR`, Badges (shields.io), ASCII boxes for features/architecture, and Romanos 11:36 footer (Soli Deo Gloria).

## Risks / Trade-offs

- [Risk] Image placeholders point to non-existent `./docs/screenshots/` images until screenshots are added → Mitigation: Use standard markdown image syntax with alt text and a subtle note.
