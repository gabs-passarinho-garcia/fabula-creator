# Spec: Character Editor (Inline Post-Save Editing)

## Purpose

Defines the behavior for editing a saved hero's photo, name, identity, and theme after the hero has been persisted to the gallery, and for reopening a gallery hero as an editable sheet.

---

## ADDED Requirements

### Requirement: Saved Hero Reopened From Gallery Is Editable
When the user opens a hero from the gallery, the character sheet view MUST enter an "editing mode" for the photo, name, identity, and theme fields.

#### Scenario: Gallery open transitions to editable sheet
- **GIVEN** the user is on the hero gallery screen
- **WHEN** the user clicks a hero card
- **THEN** `activeSheet` is set to the parsed sheet and `activeRecordId` is set to the record id
- **AND** `currentScreen` becomes `"sheet"`
- **AND** the sheet view renders in editable mode for photo/name/identity/theme

### Requirement: Editable Fields Are Scoped to Identity Properties
Only `name`, `identity`, and `theme` MUST be editable in the gallery-reopened sheet. Structural fields (level, classes, powers, spells, equipment, attributes, derived stats) MUST remain read-only in this view.

#### Scenario: Structural fields stay read-only
- **GIVEN** the user is viewing an editable saved hero sheet
- **WHEN** the user inspects the classes, powers, equipment, or stats sections
- **THEN** those sections are displayed as read-only (same as the current sheet view)
- **AND** no inline editing affordance is offered for them

### Requirement: Photo Upload and Replacement
The sheet header MUST provide a photo area with a "Change Photo" action that opens a file picker limited to image files (JPG, PNG).

#### Scenario: Upload photo for hero without photo
- **GIVEN** an editable saved hero with no photo
- **WHEN** the user clicks "Change Photo" and selects an image file
- **THEN** the file is saved to the app's local data directory
- **AND** the photo area updates immediately with the new image
- **AND** the repository is called to persist the photo path

#### Scenario: Replace existing photo
- **GIVEN** an editable saved hero with a photo already attached
- **WHEN** the user clicks "Change Photo" and selects a different image file
- **THEN** the old photo file is deleted from disk
- **AND** the new photo is saved and displayed
- **AND** the repository persists the new photo path

#### Scenario: Cancel photo selection
- **GIVEN** the user opened the file picker
- **WHEN** the user cancels the picker
- **THEN** no photo is changed and no file operation occurs

### Requirement: Name Editing
The name field MUST become a text input when editing a saved hero. Changes update the sheet in memory immediately.

#### Scenario: Rename a saved hero
- **GIVEN** an editable saved hero sheet
- **WHEN** the user types a new name and the field loses focus (or the user confirms)
- **THEN** `activeSheet.name` reflects the new value
- **AND** the gallery card preview (if loaded) will show the new name on next refresh

### Requirement: Identity Editing
The identity field (composed of concept + adjective + detail) MUST become editable when editing a saved hero. The existing sheet stores identity as a single string; editing may allow re-rolling or manually typing the composed identity.

#### Scenario: Edit identity string
- **GIVEN** an editable saved hero sheet
- **WHEN** the user modifies the identity field
- **THEN** `activeSheet.identity` reflects the new value immediately

### Requirement: Theme Editing
The theme field MUST become a select (or text) control when editing a saved hero, scoped to the available themes in the current locale data.

#### Scenario: Change hero theme
- **GIVEN** an editable saved hero sheet and a set of themes available in the current locale
- **WHEN** the user selects a different theme
- **THEN** `activeSheet.theme` reflects the new value immediately

### Requirement: Persist Button Reuses Existing Save Affordance
The existing "Salvar Herói" button on the character sheet MUST continue to work for saved heroes that have been edited, calling `repository.update` when `activeRecordId` is set, and `repository.save` when it is not.

#### Scenario: Save edited gallery hero
- **GIVEN** an editable saved hero sheet with `activeRecordId` set
- **WHEN** the user clicks "Salvar Herói"
- **THEN** `repository.update(activeRecordId, activeSheet)` is called
- **AND** the success message indicates the hero was updated
- **AND** the gallery list is refreshed from the repository

#### Scenario: Save fresh (unsaved) hero
- **GIVEN** a hero sheet created via wizard with `activeRecordId` null
- **WHEN** the user clicks "Salvar Herói"
- **THEN** `repository.save(activeSheet)` is called
- **AND** `activeRecordId` is set to the returned id
- **AND** the gallery list is refreshed

### Requirement: Editing Indicator
When `activeRecordId` is set, the character sheet header MUST show a subtle indicator that the hero is a saved hero being edited (e.g., " editando herói salvo" / "editing saved hero").

#### Scenario: Indicator visible for gallery-opened sheet
- **GIVEN** a sheet opened from the gallery
- **WHEN** the sheet view renders
- **THEN** the editing indicator is visible in the header area

#### Scenario: Indicator hidden for fresh sheet
- **GIVEN** a fresh wizard-created sheet with no record id
- **WHEN** the sheet view renders
- **THEN** no editing indicator is shown

### Requirement: Locale Strings
All new user-facing strings MUST be added to both `pt` and `en` locale bundles.

#### Strings required
- "Change Photo" / "Alternar Foto"
- "No photo" / "Sem foto"
- "Editing saved hero" / "Editando herói salvo"
- Photo placeholder alt text
- File picker accept hint

