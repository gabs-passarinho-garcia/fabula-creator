# Spec: Character Sheet

## Purpose

Defines the requirements for viewing, editing, persisting, and exporting a player character sheet in the Fabula Creator application.

---

## ADDED Requirements

### Requirement: Photo Attachment on Character Sheet
A character sheet MUST display an attached photo/portrait in the sheet header and MUST allow the user to attach or replace that photo.

#### Scenario: Sheet with photo displays photo
- **GIVEN** a character sheet loaded from the gallery that has a `photoPath`
- **WHEN** the user views the character sheet
- **THEN** the sheet header renders the photo from that path
- **AND** a "Change Photo" control is available

#### Scenario: Sheet without photo displays fallback
- **GIVEN** a character sheet with no photo (null/empty `photoPath`)
- **WHEN** the user views the character sheet
- **THEN** the sheet header renders a fallback silhouette/placeholder in place of a photo

#### Scenario: User attaches a photo
- **GIVEN** the user is viewing a character sheet
- **WHEN** the user clicks "Change Photo" and selects a JPG or PNG file
- **THEN** the photo is written to the app's local data directory
- **AND** the sheet header immediately displays the new photo
- **AND** the photo path is persisted to the character record via the repository

#### Scenario: User replaces an existing photo
- **GIVEN** a character sheet that already has a photo attached
- **WHEN** the user attaches a new photo for the same character
- **THEN** the old photo file is removed from disk
- **AND** the new photo is written and displayed
- **AND** the record's `photoPath` is updated

---

### Requirement: Name/Identity/Theme Are Editable After Save
When a character sheet is opened from the gallery (i.e., it is backed by a persisted record), the `name`, `identity`, and `theme` fields in the sheet header MUST be editable inline.

#### Scenario: Reopened gallery sheet shows editable fields
- **GIVEN** the user opens a saved hero from the gallery
- **WHEN** the character sheet view renders
- **THEN** the `name`, `identity`, and `theme` fields are presented as editable controls (text input / select) rather than read-only text
- **AND** an "editing saved hero" indicator is shown

#### Scenario: Editing name updates the sheet
- **GIVEN** the user is viewing an editable saved hero sheet
- **WHEN** the user changes the name field
- **THEN** the in-memory `activeSheet.name` updates immediately
- **AND** the gallery list (if visible) reflects the new name after the next load

#### Scenario: Editing identity updates the sheet
- **GIVEN** the user is viewing an editable saved hero sheet
- **WHEN** the user changes the identity field (concept/adjective/detail composed string)
- **THEN** the in-memory `activeSheet.identity` updates immediately

#### Scenario: Editing theme updates the sheet
- **GIVEN** the user is viewing an editable saved hero sheet
- **WHEN** the user changes the theme field
- **THEN** the in-memory `activeSheet.theme` updates immediately

#### Scenario: Saving an edited gallery sheet persists fields
- **GIVEN** the user has edited name/identity/theme (and/or photo) on a gallery-opened sheet
- **WHEN** the user clicks "Salvar Herói"
- **THEN** the repository `update` is called with the modified sheet and the record id
- **AND** the success confirmation is shown
- **AND** the gallery list reflects the changes after the next load

#### Scenario: Unsaved (fresh) sheet does not show edit affordance
- **GIVEN** a character sheet created via random or manual wizard that has not been saved yet (activeRecordId is null)
- **WHEN** the character sheet view renders
- **THEN** the name/identity/theme fields are read-only (no inline edit controls)
- **AND** no "editing saved hero" indicator is shown

---

### Requirement: Preserve Existing Sheet Behavior
All existing character sheet requirements (PDF export, dual export options, collapsed power rank display, JSON export including rank) MUST continue to behave as before.

#### Scenario: Existing export and rank behavior unchanged
- **GIVEN** any character sheet view
- **WHEN** the user exports PDF, exports JSON, or views power ranks
- **THEN** the behavior matches the previously defined requirements for those features

