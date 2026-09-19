# Spec: Character Sheet

## Purpose

Defines the requirements for viewing, editing, persisting, and exporting a player character sheet in the Fabula Creator application.

---

## Requirements

### Requirement: Export Character Sheet as PDF
The character sheet view MUST allow exporting the sheet as a formatted PDF using native browser/webview printing.

#### Scenario: User exports sheet to PDF
- **GIVEN** the user is viewing a character sheet in `CharacterSheetView`
- **WHEN** the user clicks "Export" and selects "PDF (Visual)"
- **THEN** the system triggers `window.print()` with print styles applied
- **AND** top action buttons are hidden (`.no-print`)
- **AND** the layout is optimized to fit on a single A4 page with exact color retention (`print-color-adjust: exact`)
- **AND** no white page margins are rendered (`@page { margin: 0 }`) with internal padding provided by the container instead.

---

### Requirement: Dual Export Options
The export action MUST present the user with a choice between visual PDF export and JSON data backup export.

#### Scenario: User opens export menu
- **GIVEN** the user clicks the "Export" button
- **WHEN** the export menu opens
- **THEN** two options are displayed: "Export PDF (Visual)" and "Export JSON (Data)".

---

### Requirement: Display collapsed power rank
The character sheet view MUST list each owned power once per class, showing the current rank and catalog maximum (NP), e.g. `NP 2/3`. It MUST NOT render duplicate cards for the same `(className, power.name)`.

#### Scenario: Stacked power on the sheet
- **GIVEN** a sheet with Papo de Taverna rank 2 and `maxLevel` 3
- **WHEN** the user views the character sheet
- **THEN** Papo de Taverna appears once
- **AND** the rank is shown as NP 2/3 (or an equivalent localized label)

---

### Requirement: Exported sheet includes rank
JSON export of a character sheet MUST include `rank` on each selected power and MUST keep catalog `maxLevel` unchanged on the nested power object.

#### Scenario: JSON backup has rank
- **GIVEN** a character with Magia Elemental rank 2
- **WHEN** the user exports JSON
- **THEN** the powers array contains one Magia Elemental entry
- **AND** that entry has `"rank": 2`
- **AND** `power.maxLevel` is 10

