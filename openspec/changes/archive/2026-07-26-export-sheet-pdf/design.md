# Design: Export Character Sheet to PDF

## Architectural Decisions

### 1. Print Engine Selection: Native Webview Print (`window.print()`) + `@media print`
- **Rationale**: Utilizing `@media print` with native webview printing provides crystal-clear vector text, zero additional npm dependencies, and exact color rendering via CSS `print-color-adjust: exact`.
- **Alternative Considered**: `html2canvas` + `jsPDF` was evaluated, but rejected because canvas rasterization turns text into images (losing crispness/searchability) and introduces external bundle overhead.

### 2. Page Constraints & Styling Architecture
- **Page Size**: `@page { size: A4 portrait; margin: 8mm; }`
- **Color & Aesthetic Retention**:
  ```css
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
  ```
- **Hiding UI Chrome**: Elements marked with `.no-print` (action buttons, main menu button, top header bar) are hidden during printing (`display: none !important`).
- **Page Break Guards**: Apply `break-inside: avoid` on `.jrpg-panel` and combat cards to prevent awkward breaks across panels.

### 3. User Experience (Export Menu)
- Clicking the **Exportar / Export** button opens an interactive modal or dropdown offering two distinct choices:
  - **Exportar PDF (Visual)**: Triggers `window.print()` with sheet layout focused for PDF saving/printing.
  - **Exportar JSON (Dados)**: Triggers JSON file download for backup/import.

## Data Flow Diagram

```
[ User Clicks 'Export' ]
           │
           ▼
┌───────────────────────────┐
│   Export Options Modal    │
└─────────────┬─────────────┘
              │
      ┌───────┴───────┐
      ▼               ▼
[ Export PDF ]  [ Export JSON ]
      │               │
      │               ▼
      │       Download JSON file
      ▼
Triggers window.print()
      │
      ▼
Browser / Tauri Webview Print Dialog
(Renders A4 @media print stylesheet)
```
