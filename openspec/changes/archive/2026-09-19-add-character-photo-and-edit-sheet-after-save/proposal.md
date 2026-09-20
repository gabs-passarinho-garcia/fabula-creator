# Proposal: Add Character Photo and Editable Sheet After Save

## Context

Fabula Creator currently lets players create heroes, save them to a local SQLite gallery, and reopen them for viewing or leveling up. Once a character is saved, the `name`, `identity`, and `theme` fields are locked, and there is no way to attach a portrait/photo to a character card. Players who want to personalize a saved hero or fix a typo after saving have no in-app path to do so.

## Goals / Non-Goals

**Goals:**
- Let players attach a photo/portrait to a character sheet, persisted alongside the sheet and visible in the hero gallery card and character sheet header.
- Let players edit `name`, `identity`, and `theme` on an already-saved character after reopening it from the gallery.
- When a saved character is opened from the gallery, the character sheet view offers an inline-edit affordance for those three fields so players can patch them without re-entering the full creation wizard.
- Persist every edit (photo change, name edit, identity edit, theme edit) back to the same gallery record via the existing repository `update` path.

**Non-Goals:**
- Bulk image editing, cropping, or filters.
- Storing multiple photos per character.
- Editing other sheet fields (level, classes, powers, equipment, attributes) through the gallery flow — those remain in the existing level-up path or creation wizard.
- Cloud sync or image upload to remote storage.

## In-Scope

- New `photo_path` column (nullable) on the `characters` table, surfaced as `photoPath?: string` in `SavedCharacter` and the repository record type.
- Tauri command `save_character_photo(state, id, photo_path)` that writes the photo asset to the app's local data directory and records the path; a `delete_character_photo(state, id)` to clear it.
- UI in the character sheet header: a small portrait area showing the photo (or a fallback silhouette placeholder), with a "Change Photo" button that opens a file picker for JPG/PNG.
- UI in the hero gallery card: each card shows a small thumbnail of the character's photo (or fallback) when present.
- When `activeRecordId !== null` (sheet was loaded from the gallery), the `name`, `identity`, and `theme` fields in the sheet header become editable text/select controls; edits update the in-memory `activeSheet` immediately and are persisted on the existing "Salvar Herói" action (no separate "commit" step — reuse the same save affordance with an edit indicator).
- Backward compatibility: existing records without a photo render the fallback placeholder; missing/null `photoPath` is treated as "no photo".

## Out of Scope

- Anything that changes how leveling, random generation, manual wizard, equipment, spells, or bonding works.
- Export formats beyond what already exists (PDF/JSON).

## Decision Summary

- Photo storage model: file on disk in the app's local data directory, path stored in SQLite. Rationale: avoids bloating the database with binary blobs, plays well with Tauri's scoped filesystem, and keeps the `sheet_json` column free of image data.
- Photo change flow: new file written to disk, old file deleted when a new photo is set for the same character.
- Edit affordance location: inline in the `CharacterSheetView` header for `name`/`identity`/`theme`, reusing the same Save button that already persists the sheet. A small "editing saved hero" indicator appears when `activeRecordId` is set.
- Gallery thumbnail: small circular/square thumbnail in `HeroGallery` card derived from the photo path.

## Risks / Trade-offs

- File cleanup on photo replacement: if the write of a new photo fails after deleting the old one, the character briefly has no photo. Mitigate by writing the new file first, then updating the DB, then deleting the old file.
- Gallery card layout: adding a thumbnail increases card height; keep it small (CSS-constrained) so the grid remains usable.
- File picker availability: Tauri's webview supports `<input type="file">`; on some platforms a custom native dialog may be preferable later, but the web picker is sufficient for v1.
- Localization: new UI strings for "Change Photo", "No photo", "Edit saved hero", and the editable field placeholders must be added to both `pt` and `en` locales.
