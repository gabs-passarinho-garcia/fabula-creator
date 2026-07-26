# Delta Spec: Character Sheet PDF Export

## Added Requirements

### Requirement: Export Character Sheet as PDF
The character sheet view MUST allow exporting the sheet as a formatted PDF using native browser/webview printing.

#### Scenario: User exports sheet to PDF
- **GIVEN** the user is viewing a character sheet in `CharacterSheetView`
- **WHEN** the user clicks "Export" and selects "PDF (Visual)"
- **THEN** the system triggers `window.print()` with print styles applied
- **AND** top action buttons are hidden (`.no-print`)
- **AND** the layout is optimized to fit on a single A4 page with exact color retention (`print-color-adjust: exact`).

### Requirement: Dual Export Options
The export action MUST present the user with a choice between visual PDF export and JSON data backup export.

#### Scenario: User opens export menu
- **GIVEN** the user clicks the "Export" button
- **WHEN** the export menu opens
- **THEN** two options are displayed: "Export PDF (Visual)" and "Export JSON (Data)".
