# Proposal: Export Character Sheet to PDF

## Why
Currently, the application only supports exporting character sheets as raw JSON files for data backup and re-importing. Players and Game Masters playing *Fabula Ultima* need a printable or shareable PDF document that maintains the app's signature JRPG visual aesthetic (dark blue gradients, pixel typography, stat panels, borders) for use during tabletop RPG sessions.

## What
Implement PDF export capabilities for character sheets using native browser/webview print functionality (`window.print()`) combined with dedicated `@media print` CSS styling.

Key deliverables:
1. **Print Stylesheet Optimization**: Add CSS rules (`@media print`) in `index.css` with exact background color rendering (`print-color-adjust: exact`), A4 page setup, and page break guards (`break-inside: avoid`).
2. **Export Options UI**: Enhance the export flow in `CharacterSheetView.tsx` so users can choose between exporting as a visual **PDF (Print)** document or a **JSON (Data)** backup file.
3. **Single-Page A4 Layout**: Ensure all character details (attributes, derived stats, equipped armor/weapons, classes, skills) fit neatly onto a single A4 page without truncating JRPG panels.

## Capabilities

### Modified Capabilities
- `character-sheet`: Added PDF visual export option alongside JSON data export, with custom print layout rules.

## Impact
- **Frontend (`frontend/src`)**:
  - `components/CharacterSheetView.tsx`: Updated with printable layout classes, export menu modal, and `no-print` directives.
  - `index.css`: Added `@media print` rules for A4 dimensions, background color retention, and typography adjustments.
  - `services/characterFileService.ts`: Added helper functions for triggering PDF print export.
- **Dependencies**: No external dependencies added (uses Webview / browser native print engine).
