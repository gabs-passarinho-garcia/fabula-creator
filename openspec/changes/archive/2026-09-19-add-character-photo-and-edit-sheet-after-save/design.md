## Context

Fabula Creator stores heroes in a local SQLite database (`fabula_characters.db`) with one row per character: `id`, `name`, `created_at`, `sheet_json`. The sheet is a JSON serialization of `CharacterSheet`. Today there is no photo field and no way to edit identity properties (name/identity/theme) after a sheet is saved. Reopening a hero from the gallery drops the user into a read-only sheet view whose Save button calls `repository.save` — which for the Tauri backend is an INSERT, so it would create a duplicate row instead of updating in place.

## Goals / Non-Goals

**Goals:**
- Attach a photo to a character, visible in the gallery card and sheet header.
- Edit name, identity, and theme on an already-saved hero without re-entering the wizard.
- Persist every edit (photo, name, identity, theme) back to the same gallery record.
- Reopen a saved hero from the gallery as an editable sheet.

**Non-Goals:**
- Inline editing of level, classes, powers, equipment, spells, or attributes from the gallery.
- Multiple photos, cropping, filters, cloud storage.
- Changing the save/update semantics for fresh (unsaved) heroes.

## Decision: Save vs Update semantics

`CharacterSheetView` calls `onSave(sheet)` which in `App.tsx` calls `repository.save` regardless of whether the hero is new or persisted. For Tauri, `save` is an INSERT and `update` is an UPDATE. For a gallery-loaded hero we want an UPDATE.

**Decision:** When `activeRecordId` is set, the Save action calls `repository.update(activeRecordId, activeSheet)`. When `activeRecordId` is null, it calls `repository.save(activeSheet)` and sets `activeRecordId` to the returned id. The same Save button does the right thing in both cases.

## Architecture Diagram

```
React Frontend (App.tsx)
  HeroGallery ──onOpen──▶ setActiveSheet + setActiveRecordId ──▶ CharacterSheetView
  App state: activeSheet, activeRecordId
  Repository: CharacterRepository (Tauri or LocalStorage)
    load() save() update() delete() savePhoto() deletePhoto() getPhoto()

Tauri invoke ▼
Rust backend
  SQLite table: characters (id, name, created_at, sheet_json, photo_path TEXT nullable)
  Commands: save_character, load_characters, update_character, delete_character,
            save_character_photo, delete_character_photo, get_character_photo
  Photo storage: <app_data_dir>/photos/<uuid>.jpg
```

## Data Model Changes

### Rust — `database.rs`
`SavedCharacter` gains `photo_path: Option<String>`. Schema migration adds column via `ALTER TABLE` guarded by a `PRAGMA table_info` check.

### Rust — new commands in `lib.rs`
- `save_character_photo(id, photo_path) -> Result<(), String>`
- `delete_character_photo(id) -> Result<(), String>`
- `get_character_photo(id) -> Result<Option<String>, String>` (returns base64)

### Frontend — `characterRepository.ts` / `tauriCharacterRepository.ts`
`SavedCharacterRecord` gains `photo_path?: string`. `CharacterRepository` gains `savePhoto`, `deletePhoto`, `getPhoto`.

### Photo path convention
Photos stored at `<app_data_dir>/photos/<uuid>.jpg`. DB stores relative path `photos/<uuid>.jpg`. Display uses `get_character_photo(id)` returning base64 to avoid `file://` webview issues.

## UI Design

### Sheet header
Photo area (~64-80px square, object-fit cover, JRPG border) + fallback placeholder when no photo + "Change Photo" button. When `activeRecordId` is set: name → text input, identity → editable, theme → select. "editando herói salvo" indicator shown.

### Gallery card thumbnail
Small photo thumbnail (40-48px) next to hero name when present; text-only when absent.

## Localization additions

New keys under `sheet` in `pt` and `en`:

| Key | PT | EN |
|-----|----|----|
| `changePhoto` | "Alternar Foto" | "Change Photo" |
| `noPhoto` | "Sem foto" | "No photo" |
| `editingSavedHero` | "Editando herói salvo" | "Editing saved hero" |
| `photoPlaceholder` | "Foto do herói" | "Hero photo" |
| `selectPhotoHint` | "Selecione uma imagem (JPG/PNG)" | "Select an image (JPG/PNG)" |

## Edge Cases

- Photo file write fails: show error, do not update DB, keep old photo.
- Photo file delete fails: log and continue; DB update proceeds (best-effort cleanup).
- Old DB missing `photo_path` column: `initialize_schema` must guard ALTER with `PRAGMA table_info` check.
- No size cap in v1; future enhancement may cap at 2MB.
- `activeRecordId` set but `photo_path` null: render fallback, Change Photo active.