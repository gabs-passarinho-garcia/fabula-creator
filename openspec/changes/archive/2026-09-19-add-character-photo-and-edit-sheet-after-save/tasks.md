# Tasks: Add Character Photo and Editable Sheet After Save

## 1. Extend data model and Rust commands for photo support

- [x] 1.1 Add `photo_path: Option<String>` to `SavedCharacter` in `src-tauri/src/database.rs`
- [x] 1.2 Add `ALTER TABLE` migration guard adding `photo_path` column only if missing
- [x] 1.3 Implement `save_character_photo`, `delete_character_photo`, and `get_character_photo` persistence (relative path under `<app_data_dir>/photos/<uuid>.jpg`; replacing deletes old file first)
- [x] 1.4 Unit tests: photo round-trip, null photo_path, migration guard on existing DB
- [x] 1.5 Wire the commands in `src-tauri/src/lib.rs` (`save_character_photo`, `delete_character_photo`, `get_character_photo`) and register them in the invoke handler

**Files:**
- `src-tauri/src/database.rs`
- `src-tauri/src/lib.rs`

**Tests:**
- Add unit tests for `save_character_photo`, `delete_character_photo`, and `get_character_photo` in `src-tauri/src/database.rs` (or `src-tauri/src/lib.rs` if commands are tested at that layer).
- Verify that `SavedCharacter` round-trips with `photo_path` null and with a value.
- Verify that the `ALTER TABLE` migration guard works on an existing DB without the column.

**Acceptance:**
- `SavedCharacter` has an optional `photo_path` field.
- `save_character_photo` persists a relative path; `delete_character_photo` clears it.
- `get_character_photo` returns the file contents as base64 when the file exists, `None` otherwise.
- Photo files are written to `<app_data_dir>/photos/<uuid>.jpg`.
- Replacing a photo deletes the old file before writing the new one.
- Schema migration adds `photo_path` column only if missing.

## 2. Extend the character repository interface and Tauri implementation

- [x] 2.1 Add optional `photo_path` to `SavedCharacterRecord` in `frontend/src/services/characterRepository.ts`
- [x] 2.2 Add `savePhoto`, `deletePhoto`, and `getPhoto` to the `CharacterRepository` interface
- [x] 2.3 Implement all three in `TauriCharacterRepository`, invoking the new Tauri commands

**Files:**
- `frontend/src/services/characterRepository.ts`
- `frontend/src/services/tauriCharacterRepository.ts`

**Acceptance:**
- `SavedCharacterRecord` has optional `photo_path`.
- `CharacterRepository` interface adds `savePhoto`, `deletePhoto`, `getPhoto`.
- `TauriCharacterRepository` implements all three by invoking the new Tauri commands.
- Existing `load`, `save`, `update`, `delete` behavior for non-photo fields is unchanged.
- Photo-related fields are carried through `load()` so the gallery and sheet can render thumbnails/photos.

## 3. Add locale strings for photo and editable-saved-hero UX

- [x] 3.1 Add `changePhoto`, `noPhoto`, `editingSavedHero`, `photoPlaceholder`, `selectPhotoHint` keys to `LocaleStrings.sheet` in `frontend/src/i18n/types.ts`
- [x] 3.2 Add the same keys with Portuguese values in `frontend/src/i18n/pt.ts`
- [x] 3.3 Add the same keys with English values in `frontend/src/i18n/en.ts`

**Files:**
- `frontend/src/i18n/pt.ts`
- `frontend/src/i18n/en.ts`
- `frontend/src/i18n/types.ts` (if new keys change the `LocaleStrings` shape)

**Acceptance:**
- New `sheet` keys are present in both locales: `changePhoto`, `noPhoto`, `editingSavedHero`, `photoPlaceholder`, `selectPhotoHint`.
- Types reflect any new keys so consumers get type errors for missing translations.

## 4. Add photo state and attach/replace UI to the character sheet

- [x] 4.1 Add `photoBase64`, `onChangePhoto`, and `isEditing` props to `CharacterSheetView` (header photo area, fallback placeholder, Change Photo button, editing indicator)
- [x] 4.2 In `App.tsx`, add `currentPhotoBase64` state and a `handleChangePhotoFile` handler (file picker -> base64 -> `repository.savePhoto(activeRecordId, base64)`)
- [x] 4.3 Update `openHero` to fetch the photo via `repository.getPhoto` and store it
- [x] 4.4 Pass `photoBase64`/`onChangePhoto`/`isEditing` to `CharacterSheetView` at render time

**Files:**
- `frontend/src/App.tsx`
- `frontend/src/components/CharacterSheetView.tsx`
- `frontend/src/components/HeroGallery.tsx` (thumbnail pass-through)
- `frontend/src/types.ts` (optional: extend `CharacterSheet` with `photoPath?` if you want the photo on the sheet object itself; otherwise keep it on the record layer only)

**Acceptance:**
- When a sheet is open and `activeRecordId` is set, the header shows a photo area.
- If `photo_path` is present on the backing record, the photo is displayed (fetched via `getPhoto`).
- A "Change Photo" button opens a file picker for images.
- On file selection, the photo is written to disk, the old photo is cleaned up, and the record is updated via `savePhoto`.
- The header also shows the "editing saved hero" indicator when `activeRecordId` is set.
- When `activeRecordId` is null, the photo area shows the fallback placeholder and no Change Photo affordance (or the button is disabled/omitted).

## 5. Make name, identity, and theme editable on a gallery-reopened sheet

- [x] 5.1 When `activeRecordId` is set, render `name`, `identity`, and `theme` as editable controls in `CharacterSheetView`
- [x] 5.2 Wire an `onEditField` handler in `App.tsx` that updates `activeSheet` immediately (no separate commit step)
- [x] 5.3 Make "Salvar Herói" call `repository.update(activeRecordId, activeSheet)` when `activeRecordId` is set, and `repository.save` + set `activeRecordId` when null
- [x] 5.4 Refresh the gallery list after a successful update/save

**Files:**
- `frontend/src/components/CharacterSheetView.tsx`
- `frontend/src/App.tsx` (wiring of edit handlers and save path)

**Acceptance:**
- When `activeRecordId` is set, the `name` field is rendered as a text input bound to `activeSheet.name`.
- When `activeRecordId` is set, the `identity` field is rendered as an editable control.
- When `activeRecordId` is set, the `theme` field is rendered as a select (or text) bound to `activeSheet.theme`.
- Typing/changing a field updates `activeSheet` immediately and does not require a separate "commit" step.
- Clicking "Salvar Herói" calls `repository.update(activeRecordId, activeSheet)` when `activeRecordId` is set, and `repository.save(activeSheet)` then sets `activeRecordId` when it is null.
- The success path refreshes the gallery list after an update.

## 6. Add photo thumbnail to hero gallery cards

- [x] 6.1 Render a small photo thumbnail on gallery cards when the backing record has `photo_path` (fetched via `getPhoto`, loaded lazily)
- [x] 6.2 Keep the existing text-only card appearance when there is no photo

**Files:**
- `frontend/src/components/HeroGallery.tsx`
- `frontend/src/App.tsx` (pass photo data through `onOpen` or preload thumbnails)

**Acceptance:**
- Each gallery card shows a small photo thumbnail when the backing record has a `photo_path`.
- When there is no photo, the card keeps its existing text-only appearance.
- Thumbnails are loaded efficiently (e.g., only the visible card's photo is fetched, or a small base64 is fetched for the thumbnail).

## 7. End-to-end verification and README/documentation update if needed

- [x] 7.1 Run Rust unit tests (`cargo test` in `src-tauri/`) and frontend build/typecheck (`npm run build` or equivalent) to validate everything compiles
- [ ] 7.2 Verify end-to-end: reopen a saved hero, edit name/identity/theme, attach/replace photo, persist across restart, no duplicate gallery rows
- [x] 7.3 Update `README.md` with a short note about the new feature (if applicable)

**Files:**
- `README.md` (optional update to note the new feature)
- Manual test script/notes (in `openspec/changes/.../tasks.md` or inline here)

**Acceptance:**
- A saved hero can be opened from the gallery, renamed, had its identity and theme changed, and had a photo attached/replaced, and all of those changes persist across app restarts.
- A fresh wizard-created hero can be saved and then later edited in the same way.
- Old saved heroes without a photo still render correctly with the fallback placeholder.
- The gallery list does not duplicate rows after editing and saving an existing hero.
