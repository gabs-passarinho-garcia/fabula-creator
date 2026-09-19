## ADDED Requirements

### Requirement: Display collapsed power rank
The character sheet view MUST list each owned power once per class, showing the current rank and catalog maximum (NP), e.g. `NP 2/3`. It MUST NOT render duplicate cards for the same `(className, power.name)`.

#### Scenario: Stacked power on the sheet
- **GIVEN** a sheet with Papo de Taverna rank 2 and `maxLevel` 3
- **WHEN** the user views the character sheet
- **THEN** Papo de Taverna appears once
- **AND** the rank is shown as NP 2/3 (or an equivalent localized label)

### Requirement: Exported sheet includes rank
JSON export of a character sheet MUST include `rank` on each selected power and MUST keep catalog `maxLevel` unchanged on the nested power object.

#### Scenario: JSON backup has rank
- **GIVEN** a character with Magia Elemental rank 2
- **WHEN** the user exports JSON
- **THEN** the powers array contains one Magia Elemental entry
- **AND** that entry has `"rank": 2`
- **AND** `power.maxLevel` is 10
